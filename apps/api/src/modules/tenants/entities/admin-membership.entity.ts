/**
 * AdminMembership binds an AdminAccount to a platform role (with an optional
 * structured scope JSON for restricted reviewers etc.). MVP installs create
 * one row per role assignment; a single admin may carry several.
 *
 * ⚠️ NOT AN AUTHORIZATION SOURCE (MR-DB-HARDENING-01 Slice 6).
 * The canonical admin role for the current MVP is `AdminAccount.role`, which is
 * what the JWT claim and `AdminRoleGuard` use. `AdminMembership.role` is an
 * orphaned placeholder for a future scoped-RBAC design and is read by NO auth
 * path today. Do NOT use it for permission checks until a scoped RBAC ADR is
 * implemented — doing so would create silent permission drift.
 * See docs/architecture/admin-role-source-of-truth.md.
 */
export type AdminMembershipRole =
  | 'super_admin'
  | 'review_admin'
  | 'operations_admin';

export type MembershipStatus = 'active' | 'suspended';

export interface AdminMembership {
  id: string;
  adminAccountId: string;
  role: AdminMembershipRole;
  scope: Record<string, unknown> | null;
  status: MembershipStatus;
  createdAt: Date;
  updatedAt: Date;
}
