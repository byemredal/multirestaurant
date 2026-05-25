import { apiBaseUrl } from '@/lib/http/tenant-http';
import type { StaffAccountSession, StoredStaffSession } from '@/lib/storage/staff-session';

/**
 * Typed staff API client. Mirrors `tenant-client` conventions: small
 * functions, no shared mutable state, JSON in/out. passwordHash and
 * tokenHash are not modeled — the wire types only carry what the
 * sanitized backend projection returns.
 */

type StaffSessionPayload = {
  accessToken: string;
  csrfToken: string;
  staff: StaffAccountSession & {
    phoneNumber: string | null;
    defaultStoreId: string | null;
    staffType: string;
    employmentStatus: string;
    isActive: boolean;
    isVerified: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

function toStoredSession(payload: StaffSessionPayload): StoredStaffSession {
  return {
    accessToken: payload.accessToken,
    csrfToken: payload.csrfToken,
    staff: {
      id: payload.staff.id,
      email: payload.staff.email,
      fullName: payload.staff.fullName,
      tenantId: payload.staff.tenantId,
      storeScope: payload.staff.storeScope,
    },
  };
}

async function readJsonError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json();
    if (typeof payload?.message === 'string' && payload.message.length > 0) {
      return payload.message;
    }
    if (Array.isArray(payload?.message) && payload.message.length > 0) {
      return payload.message.join(', ');
    }
  } catch {
    // fall through
  }
  return fallback;
}

export async function loginStaff(email: string, password: string): Promise<StoredStaffSession> {
  const response = await fetch(`${apiBaseUrl}/staff/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(await readJsonError(response, 'staff_login_failed'));
  }
  return toStoredSession((await response.json()) as StaffSessionPayload);
}

export async function logoutStaff(session: StoredStaffSession): Promise<void> {
  await fetch(`${apiBaseUrl}/staff/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'X-CSRF-Token': session.csrfToken,
    },
  });
}

export type StaffMeResponse = {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  tenantId: string;
  defaultStoreId: string | null;
  staffType: string;
  employmentStatus: string;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt: string | null;
  storeScope: string[];
  createdAt: string;
  updatedAt: string;
};

export async function getStaffMe(session: StoredStaffSession): Promise<StaffMeResponse> {
  const response = await fetch(`${apiBaseUrl}/staff/me`, {
    credentials: 'include',
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  if (!response.ok) {
    throw new Error(await readJsonError(response, `staff_me_failed_${response.status}`));
  }
  return (await response.json()) as StaffMeResponse;
}

/**
 * Restores a staff session by re-validating /staff/me, or rotates the
 * cookie via /staff/refresh if the access token has expired. Returns
 * the refreshed session or throws so the gate can bounce to /staff/login.
 */
export async function bootstrapStaffSession(session: StoredStaffSession): Promise<StoredStaffSession> {
  const meResponse = await fetch(`${apiBaseUrl}/staff/me`, {
    credentials: 'include',
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  if (meResponse.ok) {
    return session;
  }

  const refreshResponse = await fetch(`${apiBaseUrl}/staff/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRF-Token': session.csrfToken },
  });
  if (!refreshResponse.ok) {
    throw new Error('staff_refresh_failed');
  }

  return toStoredSession((await refreshResponse.json()) as StaffSessionPayload);
}

/**
 * Public accept-invite — mirrors the existing tenant-staff-client export
 * but parses into the staff session shape so the workspace can persist
 * the result immediately.
 */
export async function acceptStaffInviteSession(
  token: string,
  password: string,
): Promise<StoredStaffSession> {
  const response = await fetch(`${apiBaseUrl}/staff/accept-invite`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  if (!response.ok) {
    throw new Error(await readJsonError(response, `staff_accept_failed_${response.status}`));
  }
  return toStoredSession((await response.json()) as StaffSessionPayload);
}
