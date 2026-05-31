import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * MR-DB-HARDENING-01 Slice 2 — static guard for the ownership-invariant
 * migration. The DB-level behavior itself needs a live Postgres, which is out
 * of scope for unit tests, so this locks the migration's *intent* in place:
 * the preflight scan, the composite uniqueness targets, both composite FKs and
 * the defaultStoreId trigger must remain present and reference the right
 * (id, tenant) columns. It exists to stop a silent regression of the invariant.
 */
describe('0020 staff/store/tenant ownership invariant migration', () => {
  const sql = readFileSync(
    join(
      __dirname,
      '../../../db/migrations/0020_staff_store_tenant_ownership_invariant.sql',
    ),
    'utf8',
  );

  it('keeps a read-only preflight that aborts on pre-existing violations', () => {
    expect(sql).toMatch(/RAISE EXCEPTION/);
    expect(sql).toMatch(/preflight failed/i);
    // No destructive remediation — preflight only counts + raises.
    expect(sql).not.toMatch(/\bDELETE FROM\b/i);
    expect(sql).not.toMatch(/\bUPDATE "Staff/i);
  });

  it('adds composite uniqueness targets for the tenant-scoped FKs', () => {
    expect(sql).toMatch(
      /ADD CONSTRAINT "UQ_Store_id_ownerTenantId" UNIQUE \("id", "ownerTenantId"\)/,
    );
    expect(sql).toMatch(
      /ADD CONSTRAINT "UQ_StaffAccount_id_tenantId" UNIQUE \("id", "tenantId"\)/,
    );
  });

  it('enforces StaffMembership(storeId, tenantId) -> Store(id, ownerTenantId)', () => {
    expect(sql).toMatch(/"StaffMembership_store_tenant_fkey"/);
    expect(sql).toMatch(
      /FOREIGN KEY \("storeId", "tenantId"\)\s*REFERENCES "Store" \("id", "ownerTenantId"\) ON DELETE CASCADE/,
    );
  });

  it('enforces StaffMembership(staffAccountId, tenantId) -> StaffAccount(id, tenantId)', () => {
    expect(sql).toMatch(/"StaffMembership_staff_tenant_fkey"/);
    expect(sql).toMatch(
      /FOREIGN KEY \("staffAccountId", "tenantId"\)\s*REFERENCES "StaffAccount" \("id", "tenantId"\) ON DELETE CASCADE/,
    );
  });

  it('guards StaffAccount.defaultStoreId via a same-tenant trigger that allows NULL', () => {
    expect(sql).toMatch(/CREATE TRIGGER "trg_staffaccount_default_store_tenant"/);
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE OF "defaultStoreId", "tenantId"/);
    expect(sql).toMatch(/NEW\."defaultStoreId" IS NULL/);
    expect(sql).toMatch(/s\."ownerTenantId" = NEW\."tenantId"/);
  });

  it('preserves the existing simple FKs (does not drop them)', () => {
    expect(sql).not.toMatch(/DROP CONSTRAINT/i);
  });
});
