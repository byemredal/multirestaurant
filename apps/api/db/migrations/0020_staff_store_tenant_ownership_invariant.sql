-- 0020 — Staff / Store / Tenant ownership invariant (MR-DB-HARDENING-01 Slice 2).
--
-- Defense-in-depth ONLY. The application guards stay the first line of defense
-- (TenantStaffService.assertStoresOwnedByTenant + requireOwnStaff, and the
-- server-derived staffStoreScope used by the order APIs). This migration makes
-- it structurally impossible for ANY future write path to persist a
-- StaffMembership or a StaffAccount.defaultStoreId that crosses tenant lines.
--
-- Invariants enforced here:
--   (a) StaffMembership.tenantId = Store.ownerTenantId        (store ↔ tenant)
--   (b) StaffMembership.tenantId = StaffAccount.tenantId      (staff ↔ tenant)
--   (c) StaffAccount.defaultStoreId, when set, references a Store whose
--       ownerTenantId = StaffAccount.tenantId
--
-- (a)+(b) are declarative composite foreign keys. (c) uses a narrowly-scoped
-- BEFORE trigger instead of a composite FK because defaultStoreId is nullable
-- AND its existing FK is ON DELETE SET NULL; a composite FK there would have to
-- null the NOT NULL tenantId column when a Store is deleted, which Postgres
-- cannot express portably (per-column ON DELETE SET NULL is PG15+). The trigger
-- leaves the existing SET NULL delete behavior completely untouched.
--
-- Existing simple FKs are PRESERVED (not dropped): the composite FKs are added
-- alongside them, so all existing cascade/delete semantics are unchanged.

-- ===========================================================================
-- 0. PREFLIGHT — abort loudly on pre-existing violations (no silent mutation).
-- ===========================================================================
-- The three COUNT queries below are the exact, read-only scan. They are also
-- runnable standalone for an operator pre-check:
--   -- (a) membership store crosses tenant:
--   SELECT sm."id", sm."tenantId", s."ownerTenantId"
--   FROM "StaffMembership" sm JOIN "Store" s ON s."id" = sm."storeId"
--   WHERE sm."tenantId" <> s."ownerTenantId";
--   -- (b) membership staff crosses tenant:
--   SELECT sm."id", sm."tenantId", sa."tenantId"
--   FROM "StaffMembership" sm JOIN "StaffAccount" sa ON sa."id" = sm."staffAccountId"
--   WHERE sm."tenantId" <> sa."tenantId";
--   -- (c) default store crosses tenant:
--   SELECT sa."id", sa."defaultStoreId", sa."tenantId", s."ownerTenantId"
--   FROM "StaffAccount" sa JOIN "Store" s ON s."id" = sa."defaultStoreId"
--   WHERE sa."defaultStoreId" IS NOT NULL AND s."ownerTenantId" <> sa."tenantId";
DO $$
DECLARE
  bad_store_membership BIGINT;
  bad_staff_membership BIGINT;
  bad_default_store    BIGINT;
BEGIN
  SELECT COUNT(*) INTO bad_store_membership
  FROM "StaffMembership" sm
  JOIN "Store" s ON s."id" = sm."storeId"
  WHERE sm."tenantId" <> s."ownerTenantId";

  SELECT COUNT(*) INTO bad_staff_membership
  FROM "StaffMembership" sm
  JOIN "StaffAccount" sa ON sa."id" = sm."staffAccountId"
  WHERE sm."tenantId" <> sa."tenantId";

  SELECT COUNT(*) INTO bad_default_store
  FROM "StaffAccount" sa
  JOIN "Store" s ON s."id" = sa."defaultStoreId"
  WHERE sa."defaultStoreId" IS NOT NULL
    AND s."ownerTenantId" <> sa."tenantId";

  IF bad_store_membership > 0
     OR bad_staff_membership > 0
     OR bad_default_store > 0 THEN
    RAISE EXCEPTION
      'MR-DB-HARDENING-01 Slice 2 preflight failed: % cross-tenant membership(store), % cross-tenant membership(staff), % cross-tenant defaultStoreId row(s). Remediate the offending rows before re-running.',
      bad_store_membership, bad_staff_membership, bad_default_store;
  END IF;
END $$;

-- ===========================================================================
-- 1. Composite uniqueness targets for the tenant-scoped FKs.
-- ===========================================================================
-- "id" is already the PRIMARY KEY on both tables, so these UNIQUE constraints
-- add no new row-level restriction — they only give the composite FKs below a
-- referenceable (id, tenant) target.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UQ_Store_id_ownerTenantId'
  ) THEN
    ALTER TABLE "Store"
      ADD CONSTRAINT "UQ_Store_id_ownerTenantId" UNIQUE ("id", "ownerTenantId");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UQ_StaffAccount_id_tenantId'
  ) THEN
    ALTER TABLE "StaffAccount"
      ADD CONSTRAINT "UQ_StaffAccount_id_tenantId" UNIQUE ("id", "tenantId");
  END IF;
END $$;

-- ===========================================================================
-- 2. Composite FKs on StaffMembership (invariants a + b).
-- ===========================================================================
-- ON DELETE CASCADE mirrors the existing simple FKs (storeId → Store,
-- staffAccountId → StaffAccount were both CASCADE), so deleting a Store, a
-- StaffAccount, or a TenantAccount removes the membership exactly as before.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StaffMembership_store_tenant_fkey'
  ) THEN
    ALTER TABLE "StaffMembership"
      ADD CONSTRAINT "StaffMembership_store_tenant_fkey"
        FOREIGN KEY ("storeId", "tenantId")
        REFERENCES "Store" ("id", "ownerTenantId") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StaffMembership_staff_tenant_fkey'
  ) THEN
    ALTER TABLE "StaffMembership"
      ADD CONSTRAINT "StaffMembership_staff_tenant_fkey"
        FOREIGN KEY ("staffAccountId", "tenantId")
        REFERENCES "StaffAccount" ("id", "tenantId") ON DELETE CASCADE;
  END IF;
END $$;

-- ===========================================================================
-- 3. Trigger guard for StaffAccount.defaultStoreId (invariant c).
-- ===========================================================================
-- Fires on INSERT and on UPDATE of the two columns that can break the invariant.
-- A NULL defaultStoreId is always allowed (no assignment). The existing
-- ON DELETE SET NULL FK on defaultStoreId is intentionally left in place.
CREATE OR REPLACE FUNCTION "staffaccount_default_store_tenant_guard"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."defaultStoreId" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "Store" s
    WHERE s."id" = NEW."defaultStoreId"
      AND s."ownerTenantId" = NEW."tenantId"
  ) THEN
    RAISE EXCEPTION
      'StaffAccount.defaultStoreId % does not belong to tenant %',
      NEW."defaultStoreId", NEW."tenantId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_staffaccount_default_store_tenant" ON "StaffAccount";
CREATE TRIGGER "trg_staffaccount_default_store_tenant"
  BEFORE INSERT OR UPDATE OF "defaultStoreId", "tenantId"
  ON "StaffAccount"
  FOR EACH ROW
  EXECUTE FUNCTION "staffaccount_default_store_tenant_guard"();
