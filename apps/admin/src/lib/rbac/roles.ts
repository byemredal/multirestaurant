/**
 * Frontend RBAC scaffolding.
 *
 * The backend does not yet enforce these roles. This module exists so
 * navigation, page guards and UI affordances can already be written in a
 * role-aware way — when the backend lands, only the role *source* changes.
 */

export type AdminRole =
  | 'super_admin'
  | 'finance_admin'
  | 'operations_admin'
  | 'support_agent'
  | 'tenant_owner'
  | 'store_manager';

export type RoleMeta = {
  id: AdminRole;
  label: string;
  description: string;
};

export const adminRoles: Record<AdminRole, RoleMeta> = {
  super_admin: {
    id: 'super_admin',
    label: 'Super Admin',
    description: 'Full platform access across every operational domain.',
  },
  finance_admin: {
    id: 'finance_admin',
    label: 'Finance Admin',
    description: 'Transactions, payouts, commissions, refunds and reporting.',
  },
  operations_admin: {
    id: 'operations_admin',
    label: 'Operations Admin',
    description: 'Orders, delivery, availability and operational timeline.',
  },
  support_agent: {
    id: 'support_agent',
    label: 'Support Agent',
    description: 'Read-mostly access for resolving customer and tenant issues.',
  },
  tenant_owner: {
    id: 'tenant_owner',
    label: 'Tenant Owner',
    description: 'Scoped to a single tenant and its stores.',
  },
  store_manager: {
    id: 'store_manager',
    label: 'Store Manager',
    description: 'Scoped to a single store within a tenant.',
  },
};

export const adminRoleList = Object.values(adminRoles);

/**
 * Navigation/section visibility groups. A sidebar group declares which
 * groups can see it; an empty/undefined list means "visible to all".
 */
export type AccessGroup =
  | 'overview'
  | 'tenants'
  | 'operations'
  | 'finance'
  | 'platform'
  | 'ai'
  | 'crm'
  | 'system';

const roleAccess: Record<AdminRole, AccessGroup[] | 'all'> = {
  super_admin: 'all',
  finance_admin: ['overview', 'finance', 'tenants'],
  operations_admin: ['overview', 'operations', 'tenants', 'crm'],
  support_agent: ['overview', 'operations', 'tenants'],
  tenant_owner: ['overview', 'tenants', 'finance'],
  store_manager: ['overview', 'operations'],
};

export function canAccess(role: AdminRole, group: AccessGroup): boolean {
  const access = roleAccess[role];
  return access === 'all' || access.includes(group);
}
