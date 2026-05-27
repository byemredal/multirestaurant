import { expect, test } from '@playwright/test';
import { SMOKE_CONFIG, SMOKE_FIXTURES } from './helpers/config';
import { loginAdminViaApi, resendPasswordSetupViaApi } from './helpers/admin-auth';
import { reseedSmokeFixtures } from './helpers/reseed';

/**
 * Smoke 4 — Password setup page happy path + token replay.
 *
 * Drives the public set-password page end-to-end:
 *   1. Re-seed Tenant B so cooldown is clean + passwordHash is empty.
 *   2. Hit the admin API directly (no UI) to log in and call the resend
 *      endpoint, which in non-production returns a `debugLink` carrying
 *      the raw token. This is the same fallback documented in the
 *      tenant-password-setup.service.ts header.
 *   3. Drive the browser to that link, fill the new password, submit, and
 *      assert the success copy renders.
 *   4. Re-visit the same URL — the consumed token MUST surface as
 *      "Bağlantı geçersiz".
 */
test.describe('Smoke 4 — Password setup happy + token replay', () => {
  test.beforeAll(async () => {
    await reseedSmokeFixtures();
  });

  test('renders the form, accepts a new password, then rejects a replay', async ({ page }) => {
    // 1) API-side: capture a fresh debugLink without driving the admin UI.
    const adminSession = await loginAdminViaApi();
    const resendResult = await resendPasswordSetupViaApi(
      adminSession,
      SMOKE_FIXTURES.tenantB.applicationId,
    );
    expect(resendResult.passwordSetup.tokenIssued).toBe(true);
    const debugLink = resendResult.passwordSetup.debugLink;
    expect(
      debugLink,
      'Smoke env should expose debugLink (non-production). If null, NODE_ENV may have been set to production for the API.',
    ).toBeTruthy();

    // 2) Open the partner-facing set-password page through the dev URL the
    // resend wrote into debugLink. We don't trust localhost rewrites; the
    // value is the canonical TENANT_APP_URL + /onboarding/set-password/...
    await page.goto(debugLink!, { waitUntil: 'networkidle' });

    // 3) Form should render in 'ready' view with the seeded tenant e-mail
    // visible (so the partner can confirm they're setting the right
    // account's password).
    await expect(page.locator('#new-password')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=' + SMOKE_FIXTURES.tenantB.email)).toBeVisible();

    // 4) Set a valid password — must satisfy upper + lower + digit, ≥ 8.
    const newPassword = 'SmokePass1!';
    await page.fill('#new-password', newPassword);
    await page.fill('#new-password-confirm', newPassword);
    const submit = page.getByRole('button', { name: /Şifreyi kaydet ve giriş yap/i });
    await expect(submit).toBeEnabled();
    await submit.click();

    // 5) Success view.
    await expect(page.getByRole('heading', { name: 'Şifreniz oluşturuldu' })).toBeVisible({
      timeout: 15_000,
    });

    // 6) Token replay — same URL, fresh navigation. The status endpoint now
    // sees consumedAt != null and returns redeemable:false, so the page
    // renders the "Bağlantı geçersiz" view.
    await page.goto(debugLink!, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Bağlantı geçersiz' })).toBeVisible({
      timeout: 15_000,
    });
  });
});
