import { expect, test } from '@playwright/test';
import { SMOKE_CONFIG, SMOKE_FIXTURES } from './helpers/config';
import { reseedSmokeFixtures } from './helpers/reseed';

/**
 * Smoke 2 — Admin login + approve modal + delivery banner.
 *
 * Drives the admin panel through the same UI a reviewer uses:
 *   1. Logs into /admin/login with the smoke super-admin (seeded by
 *      apps/api/scripts/seed-smoke.mjs).
 *   2. Navigates to /tenants, finds Tenant A (submitted, required docs
 *      already approved) and opens the modal.
 *   3. Clicks Approve and asserts the password-setup delivery banner shows
 *      a result. In a local dev stack with EMAIL_TRANSPORT=log the result
 *      is "unavailable" (no SMTP wired); the test accepts any of the
 *      honest banner copies — sent / queued / unavailable / failed — so a
 *      future EMAIL_TRANSPORT=smtp dev wiring doesn't flake this smoke.
 *
 * Precondition: `node apps/api/scripts/seed-smoke.mjs` has been run since
 * the most recent destructive DB reset. The seed is idempotent and the
 * admin-approve flow itself flips Tenant A's status to "approved" — re-run
 * the seed before re-running this smoke.
 */
test.describe('Smoke 2 — Admin approve + delivery banner', () => {
  test.beforeAll(async () => {
    // Smoke 2 flips Tenant A from 'submitted' to 'approved'; re-seeding
    // before the run guarantees a clean baseline regardless of file order.
    await reseedSmokeFixtures();
  });

  test('logs in, opens Tenant A modal, approves, sees password-setup banner', async ({ page }) => {
    // 1) Admin login.
    await page.goto(`${SMOKE_CONFIG.adminBaseUrl}/login`, { waitUntil: 'networkidle' });
    await page.fill('#admin-email', SMOKE_CONFIG.adminEmail);
    await page.fill('#admin-password', SMOKE_CONFIG.adminPassword);
    await Promise.all([
      page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 }),
      page.getByRole('button', { name: /Giriş yap/i }).click(),
    ]);

    // 2) Navigate to tenants list and find the smoke row. The list defaults
    // to "pending review" which is exactly where a 'submitted' application
    // shows up, so no status-filter dance is needed.
    await page.goto(`${SMOKE_CONFIG.adminBaseUrl}/tenants`, { waitUntil: 'networkidle' });
    const smokeRow = page.locator('.admin-list-row', {
      hasText: SMOKE_FIXTURES.tenantA.companyName,
    });
    await expect(smokeRow).toBeVisible({ timeout: 15_000 });

    // 3) Open the modal via the per-row Manage button.
    await smokeRow.getByRole('button', { name: 'Manage' }).click();
    const modal = page.locator('.admin-modal');
    await expect(modal).toBeVisible();

    // 4) Click Approve. With seeded required documents pre-approved the
    // button is enabled immediately; no document review step in this smoke.
    const approveButton = modal.getByRole('button', { name: 'Approve' });
    await expect(approveButton).toBeEnabled({ timeout: 10_000 });
    await approveButton.click();

    // 5) The approve response is rendered into the `approveNotice` banner.
    // Accept any of the honest delivery copies so a future SMTP-wired dev
    // env still passes this smoke; the matrix is documented in
    // docs/architecture/notification-transport.md.
    const banner = modal.getByRole('status').first();
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText(/Şifre belirleme bağlantısı/i);

    // The banner MUST show the recipient e-mail (masked or full) so the
    // admin can confirm we sent to the right address.
    await expect(banner).toContainText(SMOKE_FIXTURES.tenantA.email);
  });
});
