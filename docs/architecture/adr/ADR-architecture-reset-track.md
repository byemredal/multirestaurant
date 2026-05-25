# ADR — Architecture Reset + Productization Track

- Status: Proposed
- Date: 2026-05-25
- Scope: Marketplace platform (admin / tenant-partner / customer / future staff)
- Owners: Platform/Backend + Frontend leads
- Supersedes: ad-hoc onboarding-v2 + ad-hoc setup notes under `docs/architecture/`

## 1. Context

The platform is a multirestaurant SaaS marketplace (Eat.ch / Yemeksepeti style).
We have four surfaces: **admin**, **tenant/partner**, **customer**, and a planned
**staff** surface. The internal canonical model is `Tenant` (business) → `Store`
(operational location). A tenant may own multiple stores.

The database is **pre-production / empty**, so we can rebase migrations and
adjust the schema cleanly before real data exists. The window for this is now.

The current state has accumulated visible drift:

- 24 SQL migrations (0001–0025, gap at 0005). 5 contain `ALTER TABLE`; several
  are correction/fix migrations (0015, 0017, 0018, 0020, 0021).
- Three identity tables (`CustomerAccount`, `TenantAccount`, `AdminAccount`)
  each duplicating `email`, `passwordHash`, `lastLoginAt`. `TenantAccount` mixes
  identity with business/onboarding columns (`tenantType`, `companyAddress`,
  `verificationStatus`, `onboardingStatus`).
- A `StaffAccount` table exists (0007) but has no `passwordHash`/login,
  no permissions, no `RefreshSession` link.
- **Three** legal-document systems coexist: `StoreLegalDocument` (0007),
  `PlatformLegalDocument`/`PlatformLegalDocumentVersion`/`ConsentEvent` (0010),
  and a minimal `LegalDocument` for setup (0016). 0010 itself notes 0007 is
  deprecated but not removed.
- `0007_tenant_business_management.sql` packs 22 unrelated tables (settings,
  staff, devices, slider, legal) into a single migration.
- Country handling is intentionally **code-driven** (`packages/config`, only
  `CH`) and stored once in single-row `PlatformSetup` (0013/0015). Setup is
  CHECK-constrained to one canonical row, so "one country per deployment" is
  already structurally implied.
- `apps/tenant/src/components/tenant/TenantStudio.tsx` is **2267 lines** — a
  single component handling catalog, menu, modifiers, options, etc.

This ADR is the umbrella. Detailed decisions live in the six sibling ADRs.

## 2. Goals

1. Lock decisions before more code arrives.
2. Produce a clean, well-named **schema baseline** while the DB is still empty.
3. Separate **identity** from **business / membership / permissions**.
4. Pick a deliberately small **country pack / installation profile** model — no
   no-code schema builder.
5. Decide **plan / commission** scope (tenant vs store) and the store-count
   policy.
6. Introduce a small **terminology layer** without renaming canonical DB names.
7. Break the studio mega-component into **route pages + drawers + modals**.
8. Define **one country per deployment** as the MVP shape; allow future
   multi-country if we ever need it.
9. Keep `api-groups.ts` in lockstep with API surfaces — every slice must update it.

## 3. Non-goals

- Building a runtime database-driven country engine.
- Building a plug-in marketplace or no-code form builder.
- Rewriting the customer storefront in this phase (it is the productization
  track that *follows* this reset).
- Multi-country single-deployment routing in the MVP.

## 4. Decision summary

| Track | Decision | Detail |
|---|---|---|
| Migrations | Rebase to a clean baseline (DB is empty) | 7–9 grouped files, no ALTER-only files, no fix/backfill seeds. See `ADR-…-(implicit)` migration plan below + sprint MR-ARCH-01. |
| Identity | Three account tables stay but identity is **decoupled from membership**. Staff becomes a first-class identity row. | See `ADR-account-identity-contexts.md`. |
| Country | Code-driven `packages/config` continues. Add a tiny `installation_profile` DB row (read-only at runtime) for country/locale/currency/tax-defaults. No DB-driven schema engine. | See `ADR-country-pack-platform-schema.md`. |
| Deployment | **One deployment per country.** Same codebase, different installation profile. CH and TR can each be tested locally via mock providers and seeded profiles. | See `ADR-country-pack-platform-schema.md` §6. |
| Plan/Commission | **Plan is tenant-level subscription.** Commission, payout, ad credit, visibility boosts are **store-level enrollment**. Plan defines an `activeStoreLimit` (soft cap on active stores; draft creation is never blocked). | See `ADR-plan-commission-store-model.md`. |
| Terminology | DB stays `Tenant`/`Store`. A `TerminologySetting` (single row) provides per-surface label keys: `partner_term`, `merchant_term`, `restaurant_term`. UI uses an i18n-friendly resolver. | See `ADR-terminology-mapping.md`. |
| Catalog/Menu UX | Replace `TenantStudio.tsx` with **route pages + right-side drawers** for create/edit, **modal** for destructive actions. Platform taxonomy (cuisines / dietary / allergens) is admin-owned and lives in its own routes. | See `ADR-catalog-menu-ux-organization.md`. |

## 5. Track structure (sprints)

| Phase | Title | Status |
|---|---|---|
| MR-ARCH-00 | Decision Audit + Sprint Setup (this ADR set + planning) | proposed |
| MR-ARCH-01 | Migration Rebase / Clean DB Baseline | proposed |
| MR-ARCH-02 | Identity / Account Context Refactor | proposed |
| MR-ARCH-03 | Country Pack / Platform Schema Foundation | proposed |
| MR-ARCH-04 | Plan / Commission / Store Enrollment Model | proposed |
| MR-ARCH-05 | Terminology Mapping / UI Label System | proposed |
| MR-ARCH-06 | Catalog/Menu UX Refactor | proposed |

Sprint detail lives in `docs/planning/mr-architecture-reset-track.md`.

## 6. Risks

- **Rebasing migrations while team is mid-feature.** Mitigation: do MR-ARCH-01
  on a dedicated branch, gate other DB-touching PRs for the week.
- **Identity refactor leaks permissions across surfaces.** Mitigation: a
  dedicated permission-boundary test pack in MR-ARCH-02.
- **Country pack scope creep into no-code.** Mitigation: this ADR explicitly
  forbids it; reviewer must reject PRs that try.
- **Terminology layer turning into a runtime i18n engine.** Mitigation: scope
  is *labels*, not translated content; copy a label map at build/boot.
- **Catalog refactor regressing menu editing.** Mitigation: ship behind a
  per-tenant feature flag during MR-ARCH-06 if needed.

## 7. Open questions (resolve before MR-ARCH-01 starts)

1. Do we keep `0007`'s 22-table grouping as a single new file or split into
   `settings`, `staff`, `devices`, `legal-store`? **Recommendation: split.**
2. Do we keep `StoreLegalDocument` (0007) or remove it in the rebase since the
   newer `PlatformLegalDocument` system covers it? **Recommendation: remove.**
3. Onboarding state-token vs tokenSalt (0021): rebase decides — keep `tokenSalt`
   only. **Recommendation: tokenSalt only.**
4. Do we keep three account tables or unify to a single `Identity` row +
   per-context membership rows? **Recommendation: keep three account tables
   for now — see ADR-account-identity-contexts §4 for the trade-off — but split
   business profile out of `TenantAccount`.**

## 8. Consequences

- Short-term: a focused 1–2 sprint freeze on DB-touching feature work.
- Mid-term: schema is product-shaped instead of incident-shaped.
- Long-term: country pack + plan/commission model unblock the marketplace
  product story (Switzerland MVP, with Turkey as the next install profile).
