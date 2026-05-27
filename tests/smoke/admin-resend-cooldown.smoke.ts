import { expect, test } from '@playwright/test';
import { SMOKE_CONFIG, SMOKE_FIXTURES } from './helpers/config';
import { reseedSmokeFixtures } from './helpers/reseed';

/**
 * Smoke 3 — Admin resend password-setup link + cooldown.
 *
 * Tenant B is seeded already-approved with no outstanding setup token, so
 * the first resend succeeds and the immediate second resend hits the
 * per-tenant cooldown gate (BadRequest, code='resend_cooldown_active').
 * The admin client surfaces the BadRequest message as the modal `error`
 * banner — we assert on that copy.
 *
 * Precondition: seed-smoke.mjs has been run since the last destructive DB
 * reset. Re-run the seed if a previous smoke session left a token within
 * the cooldown window (default 60s).
 */
test.describe('Smoke 3 — Admin resend + cooldown', () => {
  test.beforeAll(async () => {
    // Smoke 3 inserts a TenantPasswordSetupToken; re-seed clears any prior
    // token so the first resend in this test is not stuck behind a stale
    // cooldown window.
    await reseedSmokeFixtures();
  });

  test('first resend succeeds, immediate second resend is rejected with cooldown', async ({
    page,
  }) => {
    // Login.
    await page.goto(`${SMOKE_CONFIG.adminBaseUrl}/login`, { waitUntil: 'networkidle' });
    await page.fill('#admin-email', SMOKE_CONFIG.adminEmail);
    await page.fill('#admin-password', SMOKE_CONFIG.adminPassword);
    await Promise.all([
      page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 }),
      page.getByRole('button', { name: /Giriş yap/i }).click(),
    ]);

    // Tenant B is approved → it lives under /tenants filtered by lifecycle.
    // The default "pending review" list does not include 'approved'; the
    // workspace exposes a status filter at the top — click Approved.
    await page.goto(`${SMOKE_CONFIG.adminBaseUrl}/tenants`, { waitUntil: 'networkidle' });

    // Use the URL-scoped status filter pill. The workspace exposes a
    // "Onaylı" / "Approved" filter button; fall through to clicking by
    // accessible name to keep this resilient if the label changes.
    const approvedFilter = page.getByRole('button', { name: /Approved|Onaylı/i }).first();
    if (await approvedFilter.isVisible().catch(() => false)) {
      await approvedFilter.click();
      await page.waitForLoadState('networkidle');
    }

    const smokeRow = page.locator('.admin-list-row', {
      hasText: SMOKE_FIXTURES.tenantB.companyName,
    });
    await expect(smokeRow).toBeVisible({ timeout: 15_000 });
    await smokeRow.getByRole('button', { name: 'Manage' }).click();

    const modal = page.locator('.admin-modal');
    await expect(modal).toBeVisible();

    // First resend.
    const resendButton = modal.getByRole('button', {
      name: 'Şifre bağlantısını yeniden gönder',
    });
    await expect(resendButton).toBeVisible({ timeout: 10_000 });
    await resendButton.click();

    const banner = modal.getByRole('status').first();
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText(/Şifre belirleme bağlantısı/i);

    // Immediate second resend → cooldown.
    await resendButton.click();

    // The BadRequest is surfaced via the same setError used elsewhere in
    // the modal; the .admin-state--error block holds the human copy.
    const errorBlock = modal.locator('.admin-state--error');
    await expect(errorBlock).toBeVisible({ timeout: 10_000 });
    await expect(errorBlock).toContainText(/Yeniden gönderim için lütfen \d+ saniye bekleyin/i);
  });
});
