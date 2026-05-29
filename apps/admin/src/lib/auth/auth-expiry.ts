import { apiBaseUrl } from '@/lib/config';
import {
  clearAdminSession,
  readAdminSession,
  writeAdminSession,
  type StoredAdminSession,
} from '@/lib/storage/admin-session';
import { parseJsonResponse } from '@/lib/admin-api/http';

type AdminAuthPayload = {
  accessToken: string;
  csrfToken: string;
  admin: StoredAdminSession['admin'];
};

let refreshInFlight: Promise<StoredAdminSession | null> | null = null;
let expiryHandled = false;

export function clearAuthState() {
  clearAdminSession();
}

export function redirectToLogin(options?: { reason?: string; returnTo?: string }) {
  if (typeof window === 'undefined') {
    return;
  }

  const params = new URLSearchParams();
  params.set('reason', options?.reason ?? 'session_expired');

  const returnTo =
    options?.returnTo ?? `${window.location.pathname}${window.location.search}`;
  if (returnTo && returnTo !== '/login') {
    params.set('returnTo', returnTo);
  }

  window.location.assign(`/login?${params.toString()}`);
}

export function onAuthExpired() {
  if (expiryHandled) {
    return;
  }
  expiryHandled = true;

  clearAuthState();
  redirectToLogin({ reason: 'session_expired' });
}

export function resetAuthExpiryGuard() {
  expiryHandled = false;
}

/**
 * Single-flight refresh of the admin session via the HttpOnly refresh cookie +
 * stored CSRF token. Persists and returns the new session, or null on failure.
 */
export function refreshAdminSession(): Promise<StoredAdminSession | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const current = readAdminSession();
    if (!current) {
      return null;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/admin/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': current.csrfToken,
        },
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await parseJsonResponse(response)) as AdminAuthPayload;
      const next: StoredAdminSession = {
        accessToken: payload.accessToken,
        csrfToken: payload.csrfToken,
        admin: payload.admin,
      };
      writeAdminSession(next);
      return next;
    } catch {
      return null;
    }
  })();

  void refreshInFlight.finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}
