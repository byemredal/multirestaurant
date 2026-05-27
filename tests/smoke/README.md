# MR-SMOKE-01 — Browser smoke harness

Playwright-driven browser smoke tests for the onboarding production UX hat.
Run **after** the dev stack is up:

```bash
# In separate terminals
pnpm run dev:api      # localhost:4000
pnpm run dev:tenant   # localhost:3060
pnpm run dev:admin    # localhost:3051
pnpm run dev:setup    # localhost:3070
# (Postgres on host port 5433 via infra/docker-compose)
```

## Run

```bash
pnpm smoke               # headless
pnpm smoke:headed        # opens chromium so the run is visible
pnpm smoke:ui            # Playwright UI mode
```

The harness only requires chromium (`npx playwright install chromium`).

## What's covered

| # | Flow | File | Status |
|---|------|------|--------|
| 1 | Partner landing + application form happy path | `partner-form.smoke.ts` | ✅ Active |
| 2 | Password setup page happy path + token replay | — | ⏸ Deferred (needs admin auth wired into the harness; see below) |
| 3 | Admin approve modal + delivery banner | — | ⏸ Deferred (needs admin auth wired into the harness; see below) |

## Deferred flows

Smoke 2 and Smoke 3 were planned but require a super-admin login + an
end-to-end onboarding-to-approval bootstrap to produce a real password-setup
token. The MR-SMOKE-01 cleanup decision was to keep the slice focused; those
flows will be added in a follow-up slice (proposed: MR-SMOKE-02) with:

- A `tests/smoke/helpers/admin-auth.ts` that logs in via
  `POST /admin/auth/login` and reuses the access token.
- A bootstrap fixture that drives a tenant from `start` → all onboarding
  steps → submission, then approves via the admin endpoint and captures
  the `passwordSetup.debugLink` from the response (non-production only).

## Environment overrides

| Env var | Default | Purpose |
|---|---|---|
| `SMOKE_API_URL` | `http://localhost:4000/api/v1` | Backend base |
| `SMOKE_TENANT_URL` | `http://localhost:3060` | Tenant app base |
| `SMOKE_ADMIN_URL` | `http://localhost:3051` | Admin app base |
| `SMOKE_SETUP_URL` | `http://localhost:3070` | Setup wizard base |
| `SMOKE_ADMIN_EMAIL` | _empty_ | Required by deferred Smoke 2/3 |
| `SMOKE_ADMIN_PASSWORD` | _empty_ | Required by deferred Smoke 2/3 |

## Artifacts

- `playwright-report/` — HTML report after a run.
- `test-results/` — traces + screenshots on failure (retained per the
  `trace: 'retain-on-failure'` and `screenshot: 'only-on-failure'`
  defaults in `playwright.config.ts`).
