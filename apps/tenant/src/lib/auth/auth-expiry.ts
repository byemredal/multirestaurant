import { resolveApiBaseUrl } from '@shared/api-base-url';
import {
  clearTenantSession,
  readTenantSession,
  writeTenantSession,
  type StoredTenantSession,
} from '@/lib/storage/tenant-session';
import {
  clearStaffSession,
  readStaffSession,
  writeStaffSession,
  type StaffAccountSession,
  type StoredStaffSession,
} from '@/lib/storage/staff-session';

const apiBaseUrl = resolveApiBaseUrl();

type TenantPayload = {
  accessToken: string;
  csrfToken: string;
  tenant: StoredTenantSession['tenant'];
};

type StaffSessionPayload = {
  accessToken: string;
  csrfToken: string;
  staff: StaffAccountSession & Record<string, unknown>;
};

// Owner and staff are distinct subjects with isolated storage; each gets its
// own single-flight refresh promise and its own one-shot expiry guard.
let tenantRefreshInFlight: Promise<StoredTenantSession | null> | null = null;
let staffRefreshInFlight: Promise<StoredStaffSession | null> | null = null;
let tenantExpiryHandled = false;
let staffExpiryHandled = false;

function redirectToLogin(loginPath: string, returnToParam: 'returnTo' | 'next') {
  if (typeof window === 'undefined') {
    return;
  }
  const returnTo = `${window.location.pathname}${window.location.search}`;
  const params = new URLSearchParams();
  params.set('reason', 'session_expired');
  if (returnTo && returnTo !== loginPath) {
    params.set(returnToParam, returnTo);
  }
  window.location.assign(`${loginPath}?${params.toString()}`);
}

export function onTenantAuthExpired() {
  if (tenantExpiryHandled) return;
  tenantExpiryHandled = true;
  clearTenantSession();
  redirectToLogin('/login', 'returnTo');
}

export function onStaffAuthExpired() {
  if (staffExpiryHandled) return;
  staffExpiryHandled = true;
  clearStaffSession();
  redirectToLogin('/staff/login', 'next');
}

export function resetTenantExpiryGuard() {
  tenantExpiryHandled = false;
}

export function resetStaffExpiryGuard() {
  staffExpiryHandled = false;
}

export function refreshTenantSession(): Promise<StoredTenantSession | null> {
  if (tenantRefreshInFlight) {
    return tenantRefreshInFlight;
  }

  tenantRefreshInFlight = (async () => {
    const current = readTenantSession();
    if (!current) return null;

    try {
      const response = await fetch(`${apiBaseUrl}/tenants/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': current.csrfToken },
      });
      if (!response.ok) return null;

      const payload = (await response.json()) as TenantPayload;
      const next: StoredTenantSession = {
        accessToken: payload.accessToken,
        csrfToken: payload.csrfToken,
        tenant: payload.tenant,
      };
      writeTenantSession(next);
      return next;
    } catch {
      return null;
    }
  })();

  void tenantRefreshInFlight.finally(() => {
    tenantRefreshInFlight = null;
  });

  return tenantRefreshInFlight;
}

export function refreshStaffSession(): Promise<StoredStaffSession | null> {
  if (staffRefreshInFlight) {
    return staffRefreshInFlight;
  }

  staffRefreshInFlight = (async () => {
    const current = readStaffSession();
    if (!current) return null;

    try {
      const response = await fetch(`${apiBaseUrl}/staff/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': current.csrfToken },
      });
      if (!response.ok) return null;

      const payload = (await response.json()) as StaffSessionPayload;
      const next: StoredStaffSession = {
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
      writeStaffSession(next);
      return next;
    } catch {
      return null;
    }
  })();

  void staffRefreshInFlight.finally(() => {
    staffRefreshInFlight = null;
  });

  return staffRefreshInFlight;
}
