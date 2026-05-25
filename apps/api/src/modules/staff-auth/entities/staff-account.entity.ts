/**
 * StaffAccount: the identity row for a tenant-scoped staff login. Created
 * either by an admin inviting a staff member or by the tenant owner from
 * the partner panel. `passwordHash` is nullable during the invite-pending
 * window; the auth service refuses login until the staff sets a password.
 */
export type StaffType =
  | 'cashier'
  | 'delivery_admin'
  | 'kitchen'
  | 'manager'
  | 'host'
  | 'other';

export type StaffEmploymentStatus = 'active' | 'invited' | 'suspended';

export interface StaffAccount {
  id: string;
  tenantId: string;
  defaultStoreId: string | null;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  passwordHash: string | null;
  staffType: StaffType;
  employmentStatus: StaffEmploymentStatus;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * StaffMembership: binds a StaffAccount to a specific Store. A staff person
 * may carry several memberships within the same tenant; the staff JWT's
 * `staffStoreScope` is the set of `storeId`s with `status='active'`.
 */
export type StaffMembershipRole = StaffType;
export type StaffMembershipStatus = 'active' | 'suspended';

export interface StaffMembership {
  id: string;
  staffAccountId: string;
  tenantId: string;
  storeId: string;
  role: StaffMembershipRole;
  status: StaffMembershipStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * What the staff-side store and AccessTokenGuard pass back to the request
 * once auth succeeds: identity + the live store scope derived from
 * active memberships.
 */
export interface StaffSessionView {
  account: StaffAccount;
  storeScope: readonly string[];
}
