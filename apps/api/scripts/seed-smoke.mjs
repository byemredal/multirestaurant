#!/usr/bin/env node
/**
 * MR-SMOKE-02 — dev-only smoke fixture seed.
 *
 * Inserts (idempotently) the minimum DB state Playwright smokes need to drive
 * admin approve / resend / password-setup flows end-to-end against a local
 * stack. Refuses to run when:
 *   - NODE_ENV=production (hard fail).
 *   - DATABASE_URL points anywhere other than localhost / 127.0.0.1.
 *
 * Idempotent: every smoke-* row is upserted by deterministic UUID, so a
 * repeated run cleans the password-setup tokens, resets the application
 * status, and keeps every other row in the DB untouched. NEVER deletes
 * anything outside the smoke-prefixed UUID space.
 *
 * Reads DATABASE_URL from apps/api/.env (Node 22's process.loadEnvFile) when
 * not already in the environment.
 */
import { resolve } from 'node:path';
import { Pool } from 'pg';

const API_ROOT = resolve(import.meta.dirname, '..');
const API_ENV = resolve(API_ROOT, '.env');

if (!process.env.DATABASE_URL && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(API_ENV);
  } catch {
    /* Falling through — the explicit DATABASE_URL guard below handles missing */
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[seed-smoke] DATABASE_URL is required.');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  console.error('[seed-smoke] Refusing to run with NODE_ENV=production.');
  process.exit(1);
}

const dbHostMatch = DATABASE_URL.match(/@([^:/?]+)/);
const dbHost = dbHostMatch ? dbHostMatch[1].toLowerCase() : null;
if (dbHost && !['localhost', '127.0.0.1', '::1'].includes(dbHost)) {
  console.error(
    `[seed-smoke] Refusing to run against non-local DATABASE_URL host "${dbHost}".`,
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Deterministic IDs — every smoke row uses the smoke- prefix in TEXT columns
// and a deterministic UUID so re-runs replace cleanly. Anything OUTSIDE these
// IDs is untouched.
// ---------------------------------------------------------------------------

const SMOKE_ADMIN = {
  id: '00000000-5170-4001-8000-000000000001',
  email: 'smoke-admin@lieferzonen.test',
  password: 'SmokeAdmin!2026',
  // Pre-computed bcrypt(10) of the password above. Re-generated when this
  // password literal changes; check by running:
  //   node -e "import('bcryptjs').then(m => m.default.hash('SmokeAdmin!2026', 10).then(console.log))"
  passwordHash: '$2b$10$cDHBv24JIEIw8Ezd6FOJk.jx5dxrP6s/TLSo5ckTEEcKGOkugbuJ.',
  firstName: 'Smoke',
  lastName: 'Admin',
  role: 'super_admin',
};

const TENANT_A_ACCOUNT_ID = '00000000-5170-4001-8000-00000000000a';
const TENANT_A_BUSINESS_ID = '00000000-5170-4001-8000-00000000000b';
const TENANT_A_APP_ID = '00000000-5170-4001-8000-00000000000c';

const TENANT_B_ACCOUNT_ID = '00000000-5170-4001-8000-00000000000d';
const TENANT_B_BUSINESS_ID = '00000000-5170-4001-8000-00000000000e';
const TENANT_B_APP_ID = '00000000-5170-4001-8000-00000000000f';

// Required document types per the onboarding compliance catalog. Approving
// the application checks `isCurrent && isRequired` against the catalog —
// we ship two generic types here that the catalog accepts as required.
const REQUIRED_DOC_TYPES = ['business_registration', 'tax_certificate'];

const FILE_ASSET_BASE_ID = '00000000-5170-4001-8000-aaaaaaaaaa00';

function fileAssetId(index) {
  // Deterministic per-document FileAsset ID. Two digits of index → up to 99
  // assets which is far more than we need.
  return `${FILE_ASSET_BASE_ID.slice(0, -2)}${String(index).padStart(2, '0')}`;
}

function tenantADocId(index) {
  return `00000000-5170-4001-8000-bbbbbbbb${String(index).padStart(4, '0')}`;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const pool = new Pool({ connectionString: DATABASE_URL });

async function withClient(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function upsertAdmin(client) {
  const now = new Date().toISOString();
  await client.query(
    `INSERT INTO "AdminAccount"
       ("id","email","passwordHash","firstName","lastName","role","isActive","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7,$7)
     ON CONFLICT ("id") DO UPDATE SET
       "email" = EXCLUDED."email",
       "passwordHash" = EXCLUDED."passwordHash",
       "firstName" = EXCLUDED."firstName",
       "lastName" = EXCLUDED."lastName",
       "role" = EXCLUDED."role",
       "isActive" = TRUE,
       "updatedAt" = EXCLUDED."updatedAt"`,
    [
      SMOKE_ADMIN.id,
      SMOKE_ADMIN.email,
      SMOKE_ADMIN.passwordHash,
      SMOKE_ADMIN.firstName,
      SMOKE_ADMIN.lastName,
      SMOKE_ADMIN.role,
      now,
    ],
  );
}

async function upsertTenantShell(client, opts) {
  const {
    accountId,
    businessId,
    email,
    companyName,
    onboardingStatus,
  } = opts;
  const now = new Date().toISOString();

  await client.query(
    `INSERT INTO "TenantAccount"
       ("id","email","passwordHash","firstName","lastName","phoneNumber",
        "isActive","isVerified","createdAt","updatedAt")
     VALUES ($1,$2,'',$3,$4,$5,TRUE,TRUE,$6,$6)
     ON CONFLICT ("id") DO UPDATE SET
       "email" = EXCLUDED."email",
       -- passwordHash MUST stay empty so the password-setup gate
       -- (passwordHash !== '') keeps recognising this tenant as eligible.
       "passwordHash" = '',
       "firstName" = EXCLUDED."firstName",
       "lastName" = EXCLUDED."lastName",
       "phoneNumber" = EXCLUDED."phoneNumber",
       "isActive" = TRUE,
       "isVerified" = TRUE,
       "updatedAt" = EXCLUDED."updatedAt"`,
    [accountId, email, 'Smoke', 'Tenant', '+41760000000', now],
  );

  await client.query(
    `INSERT INTO "TenantBusiness"
       ("id","tenantAccountId","companyName","companyAddress",
        "tenantType","deliveryModel","verificationStatus","onboardingStatus",
        "createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,'food_service','platform_fleet',$5,$6,$7,$7)
     ON CONFLICT ("tenantAccountId") DO UPDATE SET
       "companyName" = EXCLUDED."companyName",
       "companyAddress" = EXCLUDED."companyAddress",
       "verificationStatus" = EXCLUDED."verificationStatus",
       "onboardingStatus" = EXCLUDED."onboardingStatus",
       "updatedAt" = EXCLUDED."updatedAt"`,
    [
      businessId,
      accountId,
      companyName,
      'Bahnhofstrasse 1, 6300 Zug',
      onboardingStatus === 'approved' ? 'verified' : 'pending',
      onboardingStatus,
      now,
    ],
  );
}

async function upsertApplication(client, opts) {
  const { applicationId, tenantAccountId, status } = opts;
  const now = new Date().toISOString();
  const submittedAt = status === 'submitted' || status === 'approved' ? now : null;
  const approvedAt = status === 'approved' ? now : null;

  await client.query(
    `INSERT INTO "TenantOnboardingApplication"
       ("id","tenantAccountId","status","submittedAt","approvedAt",
        "lastSubmittedAt","currentRevisionNumber","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$4,0,$6,$6)
     ON CONFLICT ("id") DO UPDATE SET
       "status" = EXCLUDED."status",
       "submittedAt" = EXCLUDED."submittedAt",
       "approvedAt" = EXCLUDED."approvedAt",
       "lastSubmittedAt" = EXCLUDED."lastSubmittedAt",
       "updatedAt" = EXCLUDED."updatedAt"`,
    [applicationId, tenantAccountId, status, submittedAt, approvedAt, now],
  );
}

async function upsertRequiredApprovedDocs(client, opts) {
  const { applicationId, adminId } = opts;
  const now = new Date().toISOString();

  for (let i = 0; i < REQUIRED_DOC_TYPES.length; i++) {
    const type = REQUIRED_DOC_TYPES[i];
    const docId = tenantADocId(i);
    const assetId = fileAssetId(i);

    // FileAsset shell — the smoke flow never actually opens these so we use
    // a placeholder publicUrl. The api validates only that the asset row
    // exists when reading a TenantDocument.
    await client.query(
      `INSERT INTO "FileAsset"
         ("id","ownerTenantId","storageKey","originalFileName","mimeType",
          "sizeBytes","publicUrl","uploadedAt")
       VALUES ($1,$2,$3,$4,'application/pdf',1024,$5,$6)
       ON CONFLICT ("id") DO UPDATE SET
         "originalFileName" = EXCLUDED."originalFileName",
         "publicUrl" = EXCLUDED."publicUrl"`,
      [
        assetId,
        TENANT_A_ACCOUNT_ID,
        `smoke/${type}-${i}.pdf`,
        `smoke-${type}.pdf`,
        `data:application/pdf;base64,smoke-${type}`,
        now,
      ],
    );

    await client.query(
      `INSERT INTO "TenantDocument"
         ("id","applicationId","fileAssetId","type","status","isRequired",
          "version","isCurrent","uploadedAt","reviewedAt","reviewedByAdminId",
          "createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,'approved',TRUE,1,TRUE,$5,$5,$6,$5,$5)
       ON CONFLICT ("id") DO UPDATE SET
         "status" = 'approved',
         "isRequired" = TRUE,
         "isCurrent" = TRUE,
         "reviewedAt" = EXCLUDED."reviewedAt",
         "reviewedByAdminId" = EXCLUDED."reviewedByAdminId",
         "updatedAt" = EXCLUDED."updatedAt"`,
      [docId, applicationId, assetId, type, now, adminId],
    );
  }
}

async function clearPasswordSetupTokens(client, tenantAccountId) {
  // Always reset cooldown / consume state — each smoke run starts clean.
  await client.query(
    `DELETE FROM "TenantPasswordSetupToken" WHERE "tenantAccountId" = $1`,
    [tenantAccountId],
  );
}

async function clearApprovalArtifacts(client, applicationId) {
  // Re-running the seed against an already-approved Tenant A would leave a
  // stale TenantApplicationReview / AdminNote row from a previous browser
  // approve click. Clear those so the smoke can re-approve cleanly.
  await client.query(
    `DELETE FROM "TenantApplicationReview" WHERE "applicationId" = $1`,
    [applicationId],
  );
  await client.query(
    `DELETE FROM "AdminNote" WHERE "applicationId" = $1`,
    [applicationId],
  );
}

await withClient(async (client) => {
  await upsertAdmin(client);

  // Tenant A — ready to be approved through the admin modal.
  await upsertTenantShell(client, {
    accountId: TENANT_A_ACCOUNT_ID,
    businessId: TENANT_A_BUSINESS_ID,
    email: 'smoke-tenant-a@lieferzonen.test',
    companyName: 'Smoke Tenant A (submitted)',
    onboardingStatus: 'submitted',
  });
  await upsertApplication(client, {
    applicationId: TENANT_A_APP_ID,
    tenantAccountId: TENANT_A_ACCOUNT_ID,
    status: 'submitted',
  });
  await upsertRequiredApprovedDocs(client, {
    applicationId: TENANT_A_APP_ID,
    adminId: SMOKE_ADMIN.id,
  });
  await clearApprovalArtifacts(client, TENANT_A_APP_ID);
  await clearPasswordSetupTokens(client, TENANT_A_ACCOUNT_ID);

  // Tenant B — already approved, ready for resend + password-setup smokes.
  await upsertTenantShell(client, {
    accountId: TENANT_B_ACCOUNT_ID,
    businessId: TENANT_B_BUSINESS_ID,
    email: 'smoke-tenant-b@lieferzonen.test',
    companyName: 'Smoke Tenant B (approved)',
    onboardingStatus: 'approved',
  });
  await upsertApplication(client, {
    applicationId: TENANT_B_APP_ID,
    tenantAccountId: TENANT_B_ACCOUNT_ID,
    status: 'approved',
  });
  await clearPasswordSetupTokens(client, TENANT_B_ACCOUNT_ID);
});

await pool.end();

// Machine-readable payload for the Playwright helper to consume.
const payload = {
  admin: {
    email: SMOKE_ADMIN.email,
    password: SMOKE_ADMIN.password,
  },
  tenantA: {
    accountId: TENANT_A_ACCOUNT_ID,
    applicationId: TENANT_A_APP_ID,
    email: 'smoke-tenant-a@lieferzonen.test',
    companyName: 'Smoke Tenant A (submitted)',
  },
  tenantB: {
    accountId: TENANT_B_ACCOUNT_ID,
    applicationId: TENANT_B_APP_ID,
    email: 'smoke-tenant-b@lieferzonen.test',
    companyName: 'Smoke Tenant B (approved)',
  },
};

console.log('[seed-smoke] OK');
console.log(JSON.stringify(payload, null, 2));
