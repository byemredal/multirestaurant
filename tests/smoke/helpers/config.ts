/**
 * Smoke harness configuration. Each URL is overridable via env so the same
 * suite can run against a docker-compose preview or a staging deploy later.
 */
export const SMOKE_CONFIG = {
  apiBaseUrl: process.env.SMOKE_API_URL ?? 'http://localhost:4000/api/v1',
  tenantBaseUrl: process.env.SMOKE_TENANT_URL ?? 'http://localhost:3060',
  adminBaseUrl: process.env.SMOKE_ADMIN_URL ?? 'http://localhost:3051',
  setupBaseUrl: process.env.SMOKE_SETUP_URL ?? 'http://localhost:3070',
  // Smoke admin credentials. The seed script (apps/api/scripts/seed-smoke.mjs)
  // upserts a known super-admin with these values; tests use them to log in
  // either through the API helper or by typing them into the admin login UI.
  // Override with env vars if a local DB has a different smoke admin.
  adminEmail: process.env.SMOKE_ADMIN_EMAIL ?? 'smoke-admin@lieferzonen.test',
  adminPassword: process.env.SMOKE_ADMIN_PASSWORD ?? 'SmokeAdmin!2026',
};

// Deterministic IDs that mirror apps/api/scripts/seed-smoke.mjs. Smokes refer
// to these constants so a schema/UUID drift between the seed and the tests
// surfaces here, not deep in a test failure.
export const SMOKE_FIXTURES = {
  tenantA: {
    accountId: '00000000-5170-4001-8000-00000000000a',
    applicationId: '00000000-5170-4001-8000-00000000000c',
    email: 'smoke-tenant-a@lieferzonen.test',
    companyName: 'Smoke Tenant A (submitted)',
  },
  tenantB: {
    accountId: '00000000-5170-4001-8000-00000000000d',
    applicationId: '00000000-5170-4001-8000-00000000000f',
    email: 'smoke-tenant-b@lieferzonen.test',
    companyName: 'Smoke Tenant B (approved)',
  },
};

/** Generate a unique-enough tenant payload for tests that need a fresh tenant. */
export function freshTenantPayload(prefix: string) {
  const stamp = Date.now();
  const slug = `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    companyName: `Smoke ${prefix} ${stamp}`,
    companyAddress: `Bahnhofstrasse ${(stamp % 90) + 1}, 6300 Zug`,
    fullName: 'Smoke Tester',
    email: `${slug}@smoke.example.com`,
    // 9-digit national number — backend re-attaches the active CountryPack's
    // +CC prefix. Leading-zero forms are stripped by the start contract.
    phoneNumberNational: `79${String(stamp).slice(-7)}`,
  };
}
