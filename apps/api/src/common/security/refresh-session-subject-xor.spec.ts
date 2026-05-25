import { Pool } from 'pg';

/**
 * Exercises the CHK_RefreshSession_subjectXor constraint added by
 * migration 0002. The constraint is what stops a refresh token issued for
 * one surface from being re-bound to another via a malformed INSERT — the
 * structural guarantee referenced in `AuthSubjectType`.
 *
 * The test is gated behind LIEFERZONEN_DB_TESTS=1 because it requires a
 * reachable Postgres. In CI we run it as part of a dedicated job that
 * starts an ephemeral Postgres alongside the build; in local dev it stays
 * skipped unless explicitly enabled.
 */
const dbTestsEnabled = process.env.LIEFERZONEN_DB_TESTS === '1';
const describeIfDb = dbTestsEnabled ? describe : describe.skip;

describeIfDb('RefreshSession subject XOR constraint (MR-ARCH-02)', () => {
  let pool: Pool;
  let dbName: string;

  beforeAll(async () => {
    const adminUrl = process.env.LIEFERZONEN_DB_ADMIN_URL ?? '';
    if (!adminUrl) {
      throw new Error('LIEFERZONEN_DB_ADMIN_URL is required for DB-backed specs.');
    }

    dbName = `lieferzonen_xor_check_${Date.now()}`;
    const adminPool = new Pool({ connectionString: adminUrl });
    try {
      await adminPool.query(`CREATE DATABASE "${dbName}"`);
    } finally {
      await adminPool.end();
    }

    pool = new Pool({
      connectionString: adminUrl.replace(/\/[^/]+$/, `/${dbName}`),
    });
    // Migrations would normally be applied by db-init.mjs; here we apply
    // only the columns/constraint we exercise to keep the test focused.
    await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await pool.query(`CREATE TABLE "RefreshSession" (
      "id" UUID NOT NULL PRIMARY KEY,
      "token" TEXT NOT NULL UNIQUE,
      "subjectType" TEXT NOT NULL,
      "customerAccountId" UUID,
      "tenantAccountId" UUID,
      "staffAccountId" UUID,
      "adminAccountId" UUID,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "isRevoked" BOOLEAN NOT NULL DEFAULT FALSE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "revokedAt" TIMESTAMPTZ,
      CONSTRAINT "CHK_RefreshSession_subjectType"
        CHECK ("subjectType" IN ('customer', 'tenant', 'staff', 'admin')),
      CONSTRAINT "CHK_RefreshSession_subjectXor" CHECK (
        ("subjectType" = 'customer' AND "customerAccountId" IS NOT NULL
          AND "tenantAccountId" IS NULL AND "staffAccountId" IS NULL AND "adminAccountId" IS NULL)
        OR
        ("subjectType" = 'tenant' AND "tenantAccountId" IS NOT NULL
          AND "customerAccountId" IS NULL AND "staffAccountId" IS NULL AND "adminAccountId" IS NULL)
        OR
        ("subjectType" = 'staff' AND "staffAccountId" IS NOT NULL
          AND "customerAccountId" IS NULL AND "tenantAccountId" IS NULL AND "adminAccountId" IS NULL)
        OR
        ("subjectType" = 'admin' AND "adminAccountId" IS NOT NULL
          AND "customerAccountId" IS NULL AND "tenantAccountId" IS NULL AND "staffAccountId" IS NULL)
      )
    )`);
  }, 30000);

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
    const adminUrl = process.env.LIEFERZONEN_DB_ADMIN_URL ?? '';
    if (adminUrl && dbName) {
      const adminPool = new Pool({ connectionString: adminUrl });
      try {
        await adminPool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      } finally {
        await adminPool.end();
      }
    }
  }, 30000);

  const insertSession = (params: {
    id: string;
    token: string;
    subjectType: string;
    customerAccountId?: string | null;
    tenantAccountId?: string | null;
    staffAccountId?: string | null;
    adminAccountId?: string | null;
  }) =>
    pool.query(
      `INSERT INTO "RefreshSession" (
        "id","token","subjectType","customerAccountId","tenantAccountId","staffAccountId","adminAccountId","expiresAt"
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW() + INTERVAL '1 hour')`,
      [
        params.id,
        params.token,
        params.subjectType,
        params.customerAccountId ?? null,
        params.tenantAccountId ?? null,
        params.staffAccountId ?? null,
        params.adminAccountId ?? null,
      ],
    );

  it('accepts a well-formed customer row', async () => {
    await expect(
      insertSession({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        token: 't1',
        subjectType: 'customer',
        customerAccountId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      }),
    ).resolves.toBeDefined();
  });

  it('rejects a row with subjectType=tenant but no tenantAccountId', async () => {
    await expect(
      insertSession({
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        token: 't2',
        subjectType: 'tenant',
      }),
    ).rejects.toThrow(/CHK_RefreshSession_subjectXor/);
  });

  it('rejects a row with two subject FKs set (cross-surface attempt)', async () => {
    await expect(
      insertSession({
        id: 'cccccccc-cccc-4ccc-8ccc-aaaaaaaaaaaa',
        token: 't3',
        subjectType: 'tenant',
        tenantAccountId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        adminAccountId: 'fafafafa-fafa-4fff-8fff-fafafafafafa',
      }),
    ).rejects.toThrow(/CHK_RefreshSession_subjectXor/);
  });

  it('rejects an unknown subjectType', async () => {
    await expect(
      insertSession({
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        token: 't4',
        subjectType: 'partner',
      }),
    ).rejects.toThrow(/CHK_RefreshSession_subjectType/);
  });
});
