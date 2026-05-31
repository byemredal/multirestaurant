# Admin Role — Source of Truth

- Status: Accepted
- Date: 2026-05-31
- Sprint: MR-DB-HARDENING-01 (Slice 6)
- Related: `apps/api/db/migrations/0002_identity_and_auth.sql`,
  `apps/api/src/common/security/guards/admin-role.guard.ts`

## 1. Context

Two columns can plausibly describe an admin's role:

- **`AdminAccount.role`** — a single role string on the admin identity row
  (`super_admin`, …). Seeded by the platform setup wizard
  (`setup.store.ts` → `INSERT INTO "AdminAccount" (..., "role", ...)`).
- **`AdminMembership.role`** — a row in a 1:N membership table
  (`AdminMembership`) with an optional `scope` JSONB, intended for a future
  scoped/multi-role RBAC model.

An audit (MR-DB-HARDENING-01) found this is ambiguous: the schema implies two
role sources, but only one is wired into authorization. The risk is **silent
permission drift** — future code assuming `AdminMembership.role` is canonical
and granting/denying access from a column that nothing keeps in sync.

## 2. Decision

**`AdminAccount.role` is the single canonical admin authorization source for the
current MVP.**

The live authorization chain is:

```
AdminAccount.role            (DB, seeded by setup)
  → AdminAuthService.login/refresh   issues JWT claims: { role: admin.role }
  → AccessTokenGuard                 sets request.user.role = admin.role
  → AdminRoleGuard / @AdminRoles()   checks request.user.role
```

`AdminMembership.role` is **not** an authorization source today. It is read by
**no** service, store, or guard — it exists only as a table (0002) and a TS
entity interface. It is retained as a forward-looking placeholder for a future
scoped-RBAC design; it is **not** dropped in this slice (low value, and removing
it now would only invite re-adding it later).

### Why not switch / unify now

- `AdminAccount.role` already drives every check; switching would be a net-new
  RBAC system, which is explicitly out of scope.
- `AdminMembership` has no writers, so it carries no data to migrate and no
  drift today — the only real risk is *future misuse*, which this ADR + the
  code guardrails address.

## 3. Do-not-use rule

> Do **NOT** read `AdminMembership.role` (or `AdminMembership.scope`) for any
> authorization / permission decision until a scoped-RBAC ADR is written and
> implemented. All admin permission checks must flow from `AdminAccount.role`
> via `request.user.role`.

Guardrail comments are placed at the two central points:
`AccessTokenGuard` (claim construction) and the `AdminMembership` entity.

## 4. Future migration path (if scoped admin RBAC is needed)

When per-resource / multi-role admin permissions are actually required:

1. Write a dedicated scoped-RBAC ADR (roles, scopes, precedence rules).
2. Backfill `AdminMembership` from `AdminAccount.role` (one membership per
   existing admin) in a forward-only, idempotent migration.
3. Introduce a resolver that derives effective permissions from
   `AdminMembership` (+ scope), and switch `AccessTokenGuard` / `AdminRoleGuard`
   to it behind that ADR.
4. Decide `AdminAccount.role`'s fate then (keep as a coarse cache, or drop).

Until all of the above lands, `AdminAccount.role` remains canonical.

## 5. Test expectations

- Admin login/refresh JWT `claims.role` is sourced from `AdminAccount.role`.
- `AdminMembership.role` does not override `AdminAccount.role` in any auth path
  (there is no code reading it).
- Existing admin-auth tests continue to pass unchanged.
