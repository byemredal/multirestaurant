# Lieferzonen — Claude Code Project Instructions

## Project Identity

- **Lieferzonen** is a multi-store SaaS / food ordering marketplace.
- Three surfaces exist: **Customer**, **Partner** (store owners), and **Admin**.
- **Current priority:** Customer storefront productization — make it testable and product-like.
- Backend is relatively ahead; the customer frontend must catch up to a shippable quality level.
- Tech stack: pnpm monorepo, TypeScript, Next.js (`apps/web`), NestJS API (`apps/api`), admin panel (`apps/admin`).

## Working Rules

- Do not do broad unrelated rewrites. Work in small, focused product slices.
- Inspect real API controllers and service files before using or designing around any endpoint.
- Keep `apps/web/src/lib/api/api-groups.ts` in sync whenever API usage changes in the frontend.
- Shared, reusable UI components belong in `packages/ui` (`@lieferzonen/ui`). When you add a new cross-app component, add it there — do not re-implement the same component per app. Consuming a Next app requires the `@lieferzonen/ui` workspace dependency, `transpilePackages`, and the Tailwind `content` glob (see `packages/ui/README.md`).
- Use bounded / timeout-driven shell commands. Do not run commands that may hang indefinitely.
- If a command hangs or fails, stop and report partial evidence — do not wait forever.
- Rapor verirken kopyalanabilir bir blok içinde raporu yaz.

## UI/UX Rules

- Responsive and mobile behavior is **always in scope** — never defer it.
- Avoid generic AI-generated layouts (hero + feature-cards + CTA columns).
- Do not clone eat.ch directly; take inspiration but build an original product feel.
- Use a modern, clean, premium-but-not-luxury, light marketplace style.
- Prioritize real product usability over decorative design.
- Every screen must include **loading, empty, error, and mobile** states.
- The customer storefront must feel testable end-to-end: store → menu → cart → checkout boundary.

## UI/UX Skill

Use the `lieferzonen-ui-ux-pro-max` skill for all customer-facing UI work.
Skill files live in `.claude/skills/lieferzonen-ui-ux-pro-max/`.

## Commands

| Command | Purpose |
|---|---|
| `/ui-audit [target]` | Read-only audit of a page or component |
| `/ui-storefront-pass [description]` | Implement a customer storefront UI slice |
| `/ui-fix [target]` | Apply the top 3–5 practical fixes from an audit |

## Key File Locations

- Web app (customer + partner surfaces): `apps/web/`
  - Routes and pages: `apps/web/src/app/`
  - Shared components: `apps/web/src/components/`
  - API client surface map: `apps/web/src/lib/api/api-groups.ts` — **keep in sync when API usage changes**
- API app: `apps/api/`
- Admin panel: `apps/admin/`
- Tenant/store panel: `apps/tenant/`
- Platform setup wizard: `apps/setup/`
- Shared packages:
  - `packages/ui/` — `@lieferzonen/ui`, shared React UI components — **add new shared UI components here**
  - `packages/config/` — `@lieferzonen/config`, code-driven branding/country config
- Cross-app path-mapped shared source: `shared/` (`@shared/*`)
- Design rules: `.claude/skills/lieferzonen-ui-ux-pro-max/DESIGN_RULES.md`
- Storefront rules: `.claude/skills/lieferzonen-ui-ux-pro-max/CUSTOMER_STOREFRONT_RULES.md`

## GitHub Workflow Rules

From now on, every implementation slice must be tracked through GitHub.

Rules:
- Before coding, create or reference a GitHub issue.
- Work in small, reviewable commits.
- After each completed slice, commit and push to GitHub.
- Each report must include:
  - related issue number
  - branch name
  - commit hash
  - files changed
  - validation commands/results
  - remaining risks
- Do not bundle unrelated refactors into one commit.
- Prefer one issue per focused slice.
- Use clear commit prefixes:
  - `feat:`
  - `fix:`
  - `refactor:`
  - `chore:`
  - `docs:`
  - `test:`
- If a task grows beyond the original issue, stop and propose a new issue.
- If GitHub issue creation fails because `gh` is unavailable, stop and provide a manual issue template. Do not mark the slice as issue-tracked.
