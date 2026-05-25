import type { StoredTenantSession } from '@/lib/storage/tenant-session';
import { apiBaseUrl, tenantRequest as request } from '@/lib/http/tenant-http';

/**
 * Typed wire-shapes for the tenant-side staff management API. These mirror
 * the sanitized projection the backend returns — passwordHash and tokenHash
 * are intentionally NOT modeled here so a future refactor cannot accidentally
 * surface them via this client.
 */

export type StaffMembershipDto = {
  id: string;
  storeId: string;
  role: string;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
};

export type TenantStaff = {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  staffType:
    | 'cashier'
    | 'delivery_admin'
    | 'kitchen'
    | 'manager'
    | 'host'
    | 'other';
  employmentStatus: 'active' | 'invited' | 'suspended';
  isActive: boolean;
  isVerified: boolean;
  defaultStoreId: string | null;
  lastLoginAt: string | null;
  /** False until the staff has accepted the invite and set a password. */
  hasPassword: boolean;
  memberships: StaffMembershipDto[];
  createdAt: string;
  updatedAt: string;
};

export type StaffInvitePayload = {
  token: string;
  expiresAt: string;
  acceptUrl: string;
};

export type InviteStoreAssignment = {
  storeId: string;
  role: TenantStaff['staffType'];
};

export type InviteStaffInput = {
  email: string;
  fullName: string;
  staffType: TenantStaff['staffType'];
  phoneNumber?: string;
  defaultStoreId?: string;
  stores: InviteStoreAssignment[];
};

export type UpdateStaffInput = {
  fullName?: string;
  phoneNumber?: string | null;
  staffType?: TenantStaff['staffType'];
  defaultStoreId?: string | null;
  stores?: InviteStoreAssignment[];
};

export function listStaff(session: StoredTenantSession) {
  return request<{ staff: TenantStaff[] }>('/tenants/me/staff', session);
}

export function getStaff(session: StoredTenantSession, staffId: string) {
  return request<TenantStaff>(`/tenants/me/staff/${staffId}`, session);
}

export function inviteStaff(session: StoredTenantSession, input: InviteStaffInput) {
  return request<{ staff: TenantStaff; invite: StaffInvitePayload }>(
    '/tenants/me/staff',
    session,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function updateStaff(
  session: StoredTenantSession,
  staffId: string,
  input: UpdateStaffInput,
) {
  return request<TenantStaff>(`/tenants/me/staff/${staffId}`, session, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deactivateStaff(session: StoredTenantSession, staffId: string) {
  return request<TenantStaff>(`/tenants/me/staff/${staffId}/deactivate`, session, {
    method: 'POST',
  });
}

export function resendStaffInvite(session: StoredTenantSession, staffId: string) {
  return request<{ invite: StaffInvitePayload }>(
    `/tenants/me/staff/${staffId}/invite/resend`,
    session,
    { method: 'POST' },
  );
}

/**
 * Public accept-invite. Posts the raw token + chosen password. The backend
 * returns a fresh staff session (same shape as /staff/login) which the UI
 * surfaces back to the new hire. Does NOT use tenantRequest — there is no
 * caller session yet.
 */
export type AcceptInviteResult = {
  accessToken: string;
  csrfToken: string;
  staff: {
    id: string;
    email: string;
    fullName: string;
    tenantId: string;
    storeScope: string[];
  };
};

export async function acceptStaffInvite(token: string, password: string): Promise<AcceptInviteResult> {
  const response = await fetch(`${apiBaseUrl}/staff/accept-invite`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });

  if (!response.ok) {
    let message = `staff_accept_failed_${response.status}`;
    try {
      const payload = await response.json();
      if (typeof payload?.message === 'string' && payload.message.length > 0) {
        message = payload.message;
      } else if (Array.isArray(payload?.message) && payload.message.length > 0) {
        message = payload.message.join(', ');
      }
    } catch {
      // Use the status fallback.
    }
    throw new Error(message);
  }

  return (await response.json()) as AcceptInviteResult;
}
