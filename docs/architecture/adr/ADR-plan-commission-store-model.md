# ADR — Plan / Commission / Store Enrollment Model

- Status: Proposed
- Date: 2026-05-25
- Sprint: MR-ARCH-04
- Related: `ADR-architecture-reset-track.md`, `ADR-account-identity-contexts.md`

## 1. Context

Today:

- A tenant may own multiple stores (`Store.ownerTenantId`).
- `0025_tenant_onboarding_plan_selection.sql` adds plan persistence under
  onboarding, but the runtime model of "what plan does this tenant have, and
  what does it cost per store" is not implemented.
- `StoreSetting`, `StoreTaxSetting`, `StoreDeliveryFeeSetting` already exist
  per store (0007).
- There is no commission table, no payout table, no ad-credit table.

Marketplaces in this space (Yemeksepeti, Eat.ch, Wolt-for-Restaurants) use a
mix of:

- A tenant-level subscription (monthly seat / plan tier).
- A per-order commission % charged to each store.
- Optional add-ons: visibility boost, ad credit, premium placement.

Two real design questions:

1. Should **Plan** be tenant-level, store-level, or hybrid?
2. Should the plan **limit store count**?

## 2. Decision

**Plan is tenant-level. Commission, payout, and add-on enrollment are
store-level.** Plan can declare an `activeStoreLimit` (soft cap). Draft store
creation is **never** blocked by the limit.

### 2.1 Tables (new in MR-ARCH-04)

```sql
-- Catalog of available plans (admin-managed).
CREATE TABLE "Plan" (
  "id" UUID PRIMARY KEY,
  "code" VARCHAR(40) UNIQUE NOT NULL,           -- 'starter','growth','scale'
  "displayName" VARCHAR(160) NOT NULL,
  "monthlyPrice" NUMERIC(10,2) NOT NULL,
  "currencyCode" VARCHAR(8) NOT NULL,
  "activeStoreLimit" INTEGER,                   -- NULL = unlimited
  "defaultCommissionPct" NUMERIC(5,2) NOT NULL, -- per-order commission %
  "defaultDeliveryCommissionPct" NUMERIC(5,2) NOT NULL DEFAULT 0,
  "includesAdCredit" NUMERIC(10,2) NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per tenant. Enforces "one active plan per tenant".
CREATE TABLE "TenantPlan" (
  "id" UUID PRIMARY KEY,
  "tenantAccountId" UUID NOT NULL UNIQUE REFERENCES "TenantAccount"("id") ON DELETE CASCADE,
  "planId" UUID NOT NULL REFERENCES "Plan"("id") ON DELETE RESTRICT,
  "status" VARCHAR(24) NOT NULL,                -- 'active','past_due','cancelled'
  "startedAt" TIMESTAMPTZ NOT NULL,
  "renewsAt" TIMESTAMPTZ,
  "cancelledAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_TenantPlan_status"
    CHECK ("status" IN ('active','past_due','cancelled'))
);

-- Per-store enrollment: which commission rate, which add-ons apply.
-- Created when a store transitions to active. Defaults copied from the plan,
-- editable by admin per store.
CREATE TABLE "StoreEnrollment" (
  "id" UUID PRIMARY KEY,
  "storeId" UUID NOT NULL UNIQUE REFERENCES "Store"("id") ON DELETE CASCADE,
  "tenantPlanId" UUID NOT NULL REFERENCES "TenantPlan"("id") ON DELETE RESTRICT,
  "commissionPct" NUMERIC(5,2) NOT NULL,
  "deliveryCommissionPct" NUMERIC(5,2) NOT NULL DEFAULT 0,
  "visibilityBoost" SMALLINT NOT NULL DEFAULT 0,  -- 0..100
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "activatedAt" TIMESTAMPTZ NOT NULL,
  "deactivatedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-order commission snapshot — frozen at order time, never recomputed.
CREATE TABLE "OrderCommission" (
  "id" UUID PRIMARY KEY,
  "orderId" UUID NOT NULL UNIQUE REFERENCES "Order"("id") ON DELETE CASCADE,
  "storeEnrollmentId" UUID NOT NULL REFERENCES "StoreEnrollment"("id") ON DELETE RESTRICT,
  "commissionPctSnapshot" NUMERIC(5,2) NOT NULL,
  "commissionAmount" NUMERIC(10,2) NOT NULL,
  "deliveryCommissionPctSnapshot" NUMERIC(5,2) NOT NULL DEFAULT 0,
  "deliveryCommissionAmount" NUMERIC(10,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.2 Store-count policy

- A tenant can create **draft** stores freely. Drafts do not count toward
  `activeStoreLimit`.
- Activating a store creates a `StoreEnrollment` row.
- Activation is **blocked** when `count(active StoreEnrollment) >= plan.activeStoreLimit`.
  The error surfaces as a domain error with `code: 'plan.active_store_limit_reached'`
  and tells the user which plan tier removes the cap.
- Deactivating a store frees a slot.

This avoids the worst Yemeksepeti-clone UX: blocking onboarding/draft work
because of a paywall.

### 2.3 Commission resolution at order time

1. Order is created in store X.
2. Service reads `StoreEnrollment` for store X.
3. Snapshot the current `commissionPct` and `deliveryCommissionPct` into
   `OrderCommission`.
4. Never recompute. Future plan changes do not retroactively change past
   orders.

### 2.4 Admin overrides

- Admin can edit `StoreEnrollment.commissionPct` for individual stores
  (negotiated rates). Change takes effect for *new* orders.
- Admin can change a tenant's plan; new enrollments inherit the new defaults;
  existing enrollments keep their current commission unless explicitly reset.

### 2.5 Ad credit / boosts

- `Plan.includesAdCredit` seeds a per-period budget; a separate `AdCreditLedger`
  table (deferred to a follow-up sprint) tracks consumption. For MVP this is
  display-only on plan cards.
- `StoreEnrollment.visibilityBoost` is read by the discovery ranker (already
  has `rankingSignals` per 0017).

## 3. API surface (added to `api-groups.ts`)

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /v1/admin/plans` | admin | List plans. |
| `POST /v1/admin/plans` | admin | Create plan. |
| `PATCH /v1/admin/plans/:id` | admin | Update plan. |
| `GET /v1/tenant/plan` | tenant | Current `TenantPlan` + plan details. |
| `POST /v1/tenant/plan/select` | tenant | Choose / change plan. |
| `GET /v1/tenant/stores/:id/enrollment` | tenant | Store enrollment + commission. |
| `PATCH /v1/admin/stores/:id/enrollment` | admin | Override commission. |
| `GET /v1/admin/orders/:id/commission` | admin | View frozen commission snapshot. |

## 4. UI implications

- Tenant **billing** page shows: current plan, active/draft store counts,
  per-store commission table, link to upgrade.
- Tenant **store list** shows a chip per store: "Active — 18% commission",
  "Draft — not counted toward limit".
- Activating a store past the cap shows a clear inline error with a CTA to
  upgrade — not a generic toast.

## 5. Trade-offs considered (rejected)

- **Store-level plans.** Rejected: makes single-tenant billing painful (one
  invoice per store), confuses operators with multiple plan upgrades, and
  doesn't match how marketplaces in this segment actually sell.
- **Hybrid: plan tier per store, billing rolled up.** Rejected for MVP — too
  many edge cases (downgrade mid-cycle, mixed-tier ad budget). Re-evaluate
  in v2 if customers ask.
- **Hard-block draft store creation by plan.** Rejected: pushes the paywall
  too early in the funnel and blocks onboarding edits.

## 6. Risks

- **Negotiated rates drift from plan defaults.** Mitigation: an admin report
  flags stores where `enrollment.commissionPct != plan.defaultCommissionPct`.
- **Commission edit applied retroactively by mistake.** Mitigation:
  `OrderCommission` snapshot is immutable; commission changes only affect new
  orders by construction.
- **Plan cap surprises a tenant mid-month.** Mitigation: the cap counts
  *currently active* enrollments — deactivating one frees a slot
  immediately; the UI surfaces the count + cap on every store action.
