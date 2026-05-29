'use client';

import { apiBaseUrl } from '@/lib/http/tenant-http';
import {
  readStaffSession,
  writeStaffSession,
  type StoredStaffSession,
} from '@/lib/storage/staff-session';
import {
  readTenantSession,
  writeTenantSession,
  type StoredTenantSession,
} from '@/lib/storage/tenant-session';
import {
  triggerStaffAuthExpiry,
  triggerTenantOwnerAuthExpiry,
} from './auth-expiry';

/**
 * AuthExpiredError is thrown by tenant + staff authed fetch wrappers after
 * an unrecoverable auth failure (no stored session, refresh failed, or 401
 * still returned after a single silent refresh). By the time this error
 * reaches caller code the local session has been cleared, the cross-tab
 * event has been broadcast and a redirect to the relevant login route has
 * been kicked off. Components MUST NOT render its message in a danger card.
 */
export class AuthExpiredError extends Error {
  constructor(
    public readonly subject: 'owner' | 'staff',
    public readonly reason: 'session_expired' | 'refresh_failed' = 'session_expired',
  ) {
    super(`${subject}_${reason}`);
    this.name = 'AuthExpiredError';
  }
}

export function isAuthExpiredError(error: unknown): error is AuthExpiredError {
  return error instanceof AuthExpiredError;
}

function buildHeaders(
  init: RequestInit | undefined,
  accessToken: string,
): HeadersInit {
  const hasJsonBody = init?.body && !(init.body instanceof FormData);
  return {
    Authorization: `Bearer ${accessToken}`,
    ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
    ...(init?.headers ?? {}),
  };
}

// ── Tenant owner ────────────────────────────────────────────────────────────

type TenantRefreshPayload = {
  accessToken: string;
  csrfToken: string;
  tenant: StoredTenantSession['tenant'];
};

let tenantRefreshInFlight: Promise<StoredTenantSession> | null = null;

async function refreshTenantAccessToken(): Promise<StoredTenantSession> {
  if (tenantRefreshInFlight) return tenantRefreshInFlight;
  tenantRefreshInFlight = (async () => {
    const current = readTenantSession();
    if (!current) {
      throw new Error('no_tenant_session');
    }
    const response = await fetch(`${apiBaseUrl}/tenants/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': current.csrfToken },
    });
    if (!response.ok) {
      throw new Error(`tenant_refresh_failed_${response.status}`);
    }
    const payload = (await response.json()) as TenantRefreshPayload;
    const next: StoredTenantSession = {
      accessToken: payload.accessToken,
      csrfToken: payload.csrfToken,
      tenant: payload.tenant,
    };
    writeTenantSession(next);
    return next;
  })();
  try {
    return await tenantRefreshInFlight;
  } finally {
    tenantRefreshInFlight = null;
  }
}

export async function tenantAuthedFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const current = readTenantSession();
  if (!current) {
    triggerTenantOwnerAuthExpiry('session_expired');
    throw new AuthExpiredError('owner', 'session_expired');
  }

  const firstResponse = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: buildHeaders(init, current.accessToken),
  });

  if (firstResponse.status !== 401) {
    return firstResponse;
  }

  let refreshed: StoredTenantSession;
  try {
    refreshed = await refreshTenantAccessToken();
  } catch {
    triggerTenantOwnerAuthExpiry('refresh_failed');
    throw new AuthExpiredError('owner', 'refresh_failed');
  }

  const retryResponse = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: buildHeaders(init, refreshed.accessToken),
  });

  if (retryResponse.status === 401) {
    triggerTenantOwnerAuthExpiry('session_expired');
    throw new AuthExpiredError('owner', 'session_expired');
  }

  return retryResponse;
}

// ── Staff ───────────────────────────────────────────────────────────────────

type StaffRefreshPayload = {
  accessToken: string;
  csrfToken: string;
  staff: StoredStaffSession['staff'] & Record<string, unknown>;
};

let staffRefreshInFlight: Promise<StoredStaffSession> | null = null;

async function refreshStaffAccessToken(): Promise<StoredStaffSession> {
  if (staffRefreshInFlight) return staffRefreshInFlight;
  staffRefreshInFlight = (async () => {
    const current = readStaffSession();
    if (!current) {
      throw new Error('no_staff_session');
    }
    const response = await fetch(`${apiBaseUrl}/staff/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': current.csrfToken },
    });
    if (!response.ok) {
      throw new Error(`staff_refresh_failed_${response.status}`);
    }
    const payload = (await response.json()) as StaffRefreshPayload;
    const next: StoredStaffSession = {
      accessToken: payload.accessToken,
      csrfToken: payload.csrfToken,
      staff: {
        id: payload.staff.id,
        email: payload.staff.email,
        fullName: payload.staff.fullName,
        tenantId: payload.staff.tenantId,
        storeScope: (payload.staff as { storeScope?: string[] }).storeScope ?? [],
      },
    };
    writeStaffSession(next);
    return next;
  })();
  try {
    return await staffRefreshInFlight;
  } finally {
    staffRefreshInFlight = null;
  }
}

export async function staffAuthedFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const current = readStaffSession();
  if (!current) {
    triggerStaffAuthExpiry('session_expired');
    throw new AuthExpiredError('staff', 'session_expired');
  }

  const firstResponse = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: buildHeaders(init, current.accessToken),
  });

  if (firstResponse.status !== 401) {
    return firstResponse;
  }

  let refreshed: StoredStaffSession;
  try {
    refreshed = await refreshStaffAccessToken();
  } catch {
    triggerStaffAuthExpiry('refresh_failed');
    throw new AuthExpiredError('staff', 'refresh_failed');
  }

  const retryResponse = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: buildHeaders(init, refreshed.accessToken),
  });

  if (retryResponse.status === 401) {
    triggerStaffAuthExpiry('session_expired');
    throw new AuthExpiredError('staff', 'session_expired');
  }

  return retryResponse;
}
