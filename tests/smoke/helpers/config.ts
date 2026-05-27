/**
 * Smoke harness configuration. Each URL is overridable via env so the same
 * suite can run against a docker-compose preview or a staging deploy later.
 */
export const SMOKE_CONFIG = {
  apiBaseUrl: process.env.SMOKE_API_URL ?? 'http://localhost:4000/api/v1',
  tenantBaseUrl: process.env.SMOKE_TENANT_URL ?? 'http://localhost:3060',
  adminBaseUrl: process.env.SMOKE_ADMIN_URL ?? 'http://localhost:3051',
  setupBaseUrl: process.env.SMOKE_SETUP_URL ?? 'http://localhost:3070',
  adminEmail: process.env.SMOKE_ADMIN_EMAIL ?? '',
  adminPassword: process.env.SMOKE_ADMIN_PASSWORD ?? '',
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
