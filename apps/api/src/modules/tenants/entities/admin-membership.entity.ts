/**
 * AdminMembership binds an AdminAccount to a platform role (with an optional
 * structured scope JSON for restricted reviewers etc.). MVP installs create
 * one row per role assignment; a single admin may carry several.
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
