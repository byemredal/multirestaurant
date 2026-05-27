import { expect, test } from '@playwright/test';
import { SMOKE_CONFIG, freshTenantPayload } from './helpers/config';

/**
 * Smoke 1 — Partner landing + application form happy path.
 *
 * Verifies the public-facing tenant entry page:
 *   - Loads the landing.
 *   - Form renders with the expected inputs.
 *   - Submit disabled until terms accepted.
 *   - Successful submit creates a tenant via the real API and routes the
 *     browser to /onboarding/[stateToken]/welcome.
 *
 * No preconditions. Each invocation creates a fresh tenant.
 */
test.describe('Smoke 1 — Partner landing + form happy path', () => {
  test('lands on tenant home, fills form, submits, lands on welcome step', async ({ page }) => {
    const payload = freshTenantPayload('partner');

    await page.goto(`${SMOKE_CONFIG.tenantBaseUrl}/`, { waitUntil: 'networkidle' });

    // Landing has the hero CTA and the form is rendered behind it (scroll
    // anchor is #tenant-register-form). The form is in the same DOM tree,
    // so we can interact with selectors directly without scrolling.
    await expect(page.locator('#tenant-register-form')).toBeVisible();
    await expect(page.locator('#tenant-company-name')).toBeVisible();
    await expect(page.locator('#tenant-accept-terms')).not.toBeChecked();

    // Submit button MUST be disabled while terms are unchecked. We assert on
    // the disabled state via the role to avoid coupling to button text
    // copy that may change.
    const submit = page.getByRole('button', { name: /başvuruyu gönder|başvuru gönderiliyor/i });
    await expect(submit).toBeDisabled();

    await page.fill('#tenant-company-name', payload.companyName);
    await page.fill('#tenant-company-address', payload.companyAddress);
    await page.fill('#tenant-full-name', payload.fullName);
    await page.fill('#tenant-email', payload.email);
    await page.fill('#tenant-phone', payload.phoneNumberNational);
    await page.check('#tenant-accept-terms');

    // After terms are checked the submit is enabled unless dialCode is
    // still loading. The page surfaces a "platform yapılandırması yükleniyor…"
    // hint when dialCode is empty; we wait for it to disappear if present.
    await page.waitForFunction(() => {
      const btn = document.querySelector(
        'button.h-12.w-full',
      ) as HTMLButtonElement | null;
      return btn && !btn.disabled;
    }, undefined, { timeout: 10_000 });

    await Promise.all([
      page.waitForURL(/\/onboarding\/[^/]+\/welcome/, { timeout: 30_000 }),
      submit.click(),
    ]);

    // The redirect target is /onboarding/[stateToken]/welcome. The token is
    // the encrypted state token from the API.
    const url = page.url();
    expect(url).toMatch(/\/onboarding\/[^/]+\/welcome/);

    // localStorage MUST hold the same token so the "resume your application"
    // affordance shows up on the next public landing visit.
    const tokenFromStorage = await page.evaluate(() =>
      window.localStorage.getItem('auth.tenant-onboarding-state-token'),
    );
    expect(tokenFromStorage).toBeTruthy();
    expect(url).toContain(encodeURIComponent(tokenFromStorage!));
  });
});
