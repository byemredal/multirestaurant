import { defineConfig, devices } from '@playwright/test';

/**
 * Lieferzonen browser smoke harness — MR-SMOKE-01.
 *
 * Each test bootstraps its own state via the real API on localhost:4000.
 * The dev stack (api/tenant/admin/setup) must be running before invoking
 * `pnpm smoke`; we deliberately do NOT spin servers from inside playwright
 * because the dev servers are PowerShell-launched scripts and Playwright's
 * webServer block does not compose well with the pnpm/npm workspace dance
 * already required for local dev.
 */
export default defineConfig({
  testDir: './tests/smoke',
  testMatch: /.*\.smoke\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    // Default base URL — most flows live on the tenant app. Individual
    // tests override with `await page.goto('http://localhost:30XX/...')`
    // when they need to cross apps.
    baseURL: process.env.SMOKE_TENANT_URL ?? 'http://localhost:3060',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
