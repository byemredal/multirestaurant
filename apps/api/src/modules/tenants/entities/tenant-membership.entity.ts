import { MembershipStatus } from './admin-membership.entity';

/**
 * TenantMembership binds a TenantAccount (identity) to a TenantBusiness
 * (profile) with a role. MVP creates exactly one OWNER row per signup;
 * the table is shaped to allow co-owners / accountants in a future slice.
 */
export type TenantMembershipRole =
  | 'owner'
  | 'co_owner'
  | 'accountant'
  | 'manager';

export interface TenantMembership {
  id: string;
  tenantAccountId: string;
  tenantBusinessId: string;
  role: TenantMembershipRole;
  status: MembershipStatus;
  createdAt: Date;
  updatedAt: Date;
}
