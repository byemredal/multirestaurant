# ADR — Terminology Mapping / UI Label System

- Status: Proposed
- Date: 2026-05-25
- Sprint: MR-ARCH-05
- Related: `ADR-architecture-reset-track.md`, `ADR-country-pack-platform-schema.md`

## 1. Context

Internal canonical names are `Tenant` and `Store`. Different markets and
operator-types use different words for the same concept:

| Concept | CH (food) | TR (food) | Generic retail |
|---|---|---|---|
| Tenant | Partner | İş Ortağı | Merchant |
| Store | Restaurant | Restoran | Shop |
| Customer | Kunde | Müşteri | Customer |
| Order | Bestellung | Sipariş | Order |

We do **not** want to rename DB tables. We do want each surface (web,
partner, admin) to display the right word per install.

We also do not want to introduce a runtime i18n engine in this sprint — the
existing per-surface text is mostly hard-coded in components.

## 2. Decision

Introduce a thin **terminology layer** with three concerns kept separate:

1. **Canonical names** — DB tables and TypeScript types stay `Tenant`/`Store`.
   No renames, ever.
2. **Terminology keys** — a small fixed set of label keys (`tenant_singular`,
   `tenant_plural`, `store_singular`, `store_plural`, `customer_singular`,
   `customer_plural`, `order_singular`, `order_plural`).
3. **Resolution** — at boot, each app reads the install's terminology from
   the country pack (`pack.terminology`) and exposes it through one helper.

### 2.1 Country-pack source of truth

In `packages/config/countries/<CODE>.ts`:

```ts
terminology: {
  tenant_singular: 'Partner',
  tenant_plural: 'Partners',
  store_singular: 'Restaurant',
  store_plural: 'Restaurants',
  customer_singular: 'Customer',
  customer_plural: 'Customers',
  order_singular: 'Order',
  order_plural: 'Orders',
}
```

### 2.2 DB persistence (optional override)

A single-row `TerminologySetting` table lets the admin override the country
default without code change:

```sql
CREATE TABLE "TerminologySetting" (
  "id" TEXT PRIMARY KEY DEFAULT 'terminology' CHECK ("id" = 'terminology'),
  "overridesJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedByAdminId" UUID REFERENCES "AdminAccount"("id") ON DELETE SET NULL
);
```

Effective terminology = pack defaults **merged with** overrides JSON.

### 2.3 Public API

`GET /v1/platform/terminology` — returns the resolved label map. Cached at
the client for the session. Added to `api-groups.ts`.

### 2.4 Frontend helper

Each app gets one small module:

```ts
// apps/{tenant,web,admin}/src/lib/terminology.ts
const map = await fetchTerminology();
export function term(key: TerminologyKey): string { return map[key]; }
```

Components call `term('store_plural')` instead of hard-coded strings. No
React i18n library is introduced.

### 2.5 What does NOT get a label key

- Field labels on forms (those stay as raw strings or move to a real i18n
  layer later).
- Email/notification bodies (handled by template strings in
  `NotificationModule`).
- DTO field names, JSON property names, API paths — all stay in canonical
  English.

The label system is **navigation + section headers + entity names in copy**,
nothing more. This is the guardrail against scope creep into a full i18n
engine.

## 3. Why not "just rename"

If we renamed `Tenant` → `Partner`:

- Migrations across 24 files, plus DTO/entity churn.
- Two markets later we'd want a third name.
- The DB is supposed to be the stable boring layer.

The label layer is small, reversible, and matches how customers will actually
ask for changes (admin clicks a setting, not a deploy).

## 4. Migration plan (lands in MR-ARCH-01)

- `0006_terminology.sql` (or similar) — `TerminologySetting` single-row table.
- Pack defaults shipped in code.

## 5. Risks

- **Translation creep.** Mitigation: ADR enumerates the *exact* allowed keys;
  PR review rejects new keys without a follow-up ADR.
- **Inconsistent label usage.** Mitigation: ESLint rule (follow-up) flags
  literal use of words like `'Restaurant'`/`'Partner'` in JSX files outside
  the terminology module.
- **Cache staleness when admin updates terminology.** Mitigation: bump a
  version field returned by `GET /platform/terminology`; clients refetch on
  version change.
