# ADR — Account / Identity Contexts

- Status: Proposed
- Date: 2026-05-25
- Sprint: MR-ARCH-02
- Related: `ADR-architecture-reset-track.md`, migrations 0001, 0006, 0007

## 1. Context

Today there are three account tables:

- `CustomerAccount` — email, password, profile, social-auth providers (0004).
- `TenantAccount` — email, password **plus** `companyName`, `companyAddress`,
  `tenantType`, `deliveryModel`, `verificationStatus`, `onboardingStatus`.
- `AdminAccount` — email, password, single `role` enum.

There is one shared `RefreshSession` table with three optional FKs (one per
subject type) discriminated by `subjectType`.

A `StaffAccount` table exists (0007) under a tenant + optional store, but it
has **no login fields** (no `passwordHash`, no `email` is `NOT NULL`, no
refresh-session linkage). It is currently an HR-style record, not an identity.

Problems:

1. `TenantAccount` mixes **identity** (login) with **business profile** (the
   thing that owns stores and goes through onboarding). The same row is the
   "person who logs in" and the "company that is verified".
2. Staff cannot actually log in. The tenant/partner surface will need staff
   sessions (cashier, kitchen, manager).
3. There is no concept of **membership** — a person who is staff at multiple
   stores cannot exist; an admin granted scoped review rights cannot exist.
4. Permission boundaries between surfaces rely only on `subjectType` in JWT.
   That works today, but staff and multi-store memberships will need explicit
   scope checks per request.

## 2. Decision

Adopt a **three-account + membership** model, **not** a unified `User` table.
The boundaries stay strong (different login pages, different JWT audiences,
different cookies), but business data moves out of the identity row.

### 2.1 Identity tables (login)

| Table | Purpose | Surface |
|---|---|---|
| `CustomerAccount` | Customer identity (unchanged in shape) | customer web/app |
| `TenantAccount` | Tenant owner identity (stripped to identity fields only) | partner panel |
| `AdminAccount` | Platform admin identity (unchanged in shape) | admin panel |
| `StaffAccount` (extended) | Staff identity — adds `passwordHash` / `pinHash`, `email` `NOT NULL`, `lastLoginAt`. Already FK'd to tenant + optional store. | partner panel (separate login) |

Each identity table keeps its own `passwordHash` + email-uniqueness. They do
**not** share a row.

### 2.2 Business profile (split out of `TenantAccount`)

New table `TenantBusiness` (or rename — see §6) holds the business side of a
tenant: `companyName`, `companyAddress`, `tenantType`, `deliveryModel`,
`verificationStatus`, `onboardingStatus`. One row per `TenantAccount`.

`TenantAccount` keeps only: `id`, `email`, `passwordHash`, `firstName`,
`lastName`, `phoneNumber`, `isActive`, `isVerified`, `lastLoginAt`, `createdAt`,
`updatedAt`.

### 2.3 Membership tables

| Table | Purpose |
|---|---|
| `AdminMembership` | (`adminAccountId`, `role`, optional `scope`). MVP: `role` enum stays (`super_admin`, `review_admin`, `operations_admin`). Future: `scope` JSON for restricted reviewers. |
| `TenantMembership` | (`tenantAccountId`, `tenantBusinessId`, `role`). MVP: a tenant owner has exactly one row; future: co-owners / accountants. |
| `StaffMembership` | (`staffAccountId`, `storeId`, `role`, `isActive`). Lets one staff person work at multiple stores under the same tenant. Existing `StaffAccount.storeId` becomes nullable home-store; the membership is the source of truth. |

### 2.4 Refresh sessions

Keep `RefreshSession` with one nullable FK per subject type, **add**
`staffAccountId UUID NULL`. Add an index on it.

### 2.5 JWT subject types

`subjectType IN ('customer', 'tenant', 'staff', 'admin')`. Each issued JWT
carries `subjectType`, `subjectId`, and (for staff/tenant) a derived
`storeScope: string[]` of accessible store IDs at issue time. Per-request,
guards still re-verify membership in the DB for any mutating call (defense in
depth — token cache is not authority).

## 3. Security boundary rules

1. Customer JWTs are **never** accepted on tenant/admin/staff routes, and
   vice-versa. Existing `AuthTypes()` decorator stays as the enforcement seam.
2. Staff JWTs carry an **explicit `storeScope`**. Any store-scoped query MUST
   `WHERE storeId = ANY($scope)` *and* re-check membership in the store's row.
3. Admin JWTs do **not** grant tenant impersonation. If admin needs to act as
   tenant, that is a separate, audit-logged `act_as` token issuance (deferred
   beyond MVP; not in MR-ARCH-02 scope).
4. Cross-tenant access is a **bug, not a feature** — every store-scoped repo
   call takes a tenant id and asserts ownership.

## 4. Trade-off considered (rejected)

A unified `Identity` table with `subjectType` and per-context profile tables
was considered. Rejected because:

- It collapses three security boundaries into one table — a misrouted query
  can leak a customer into an admin response. The current shape makes that a
  type error.
- Email uniqueness becomes painful: the same human is allowed to be a
  customer AND a tenant under different orgs. With one identity table that's
  a composite unique key per role.
- Migration churn would be largest here, with zero product benefit at MVP
  scale.

We keep the three identity tables; the win comes from splitting **business**
out of `TenantAccount` and adding **memberships**.

## 5. Tests required in MR-ARCH-02

A dedicated permission-boundary spec pack must cover:

- Customer JWT → tenant endpoint → 401/403.
- Tenant A JWT → reads/writes against tenant B store → 403.
- Staff JWT scoped to store X → action against store Y → 403.
- Admin JWT → cannot mutate customer cart / orders.
- Refresh-session revoke for subject A does not revoke subject B even on the
  same email.

## 6. Naming

`TenantBusiness` is the working name. Alternatives considered:
`TenantProfile`, `TenantOrganization`. **Decision: `TenantBusiness`** — the
existing onboarding tables already use `TenantBusinessDetail`/`TenantLegalDetail`,
so this keeps prefix-consistency.

## 7. Migration notes (executed in MR-ARCH-01 rebase, not standalone)

Because the DB is empty, the rebase produces:

- `0001_identity.sql` — `CustomerAccount`, `TenantAccount` (identity-only),
  `AdminAccount`, `StaffAccount` (extended), `RefreshSession`.
- `0002_membership.sql` — `AdminMembership`, `TenantMembership`,
  `StaffMembership`.
- `0003_tenant_business.sql` — `TenantBusiness` + its onboarding child tables.

See `docs/planning/mr-architecture-reset-track.md` §MR-ARCH-01 for the full
file plan.

## 8. Risks

- **Forgetting to enforce membership in a new endpoint.** Mitigated by a
  shared `assertStoreAccess(storeId, request.user)` helper and a lint rule
  that flags store-scoped DB calls missing the helper (follow-up).
- **JWT bloat** if `storeScope` includes many stores. Mitigation: keep store
  count per staff small; if a staff is platform-fleet wide, issue a special
  `*` scope and check role separately.
