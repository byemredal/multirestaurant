import { apiBaseUrl } from '@/lib/config';
import {
  clearAuthSession,
  readAuthSession,
  writeAuthSession,
  type StoredAuthSession,
} from '@/lib/storage/auth-session';

export type AuthExpiryReason = 'expired' | 'invalid' | 'refresh_failed' | 'forbidden';

type RefreshPayload = {
  accessToken: string;
  csrfToken: string;
  account: StoredAuthSession['account'];
};

// Single-flight: concurrent 401s share one in-flight refresh promise so we
// never fire N parallel /auth/refresh calls.
let refreshInFlight: Promise<StoredAuthSession | null> | null = null;

// Guard so multiple failing requests don't each trigger a redirect.
let expiryHandled = false;

export function clearAuthState() {
  clearAuthSession();
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

export function onAuthExpired(reason: AuthExpiryReason = 'expired') {
  if (expiryHandled) {
    return;
  }
  expiryHandled = true;

  clearAuthState();
  redirectToLogin({ reason: 'session_expired' });
}

/**
 * Attempts a single-flight refresh of the customer session using the HttpOnly
 * refresh cookie + stored CSRF token. Persists and returns the new session on
 * success, or null on failure.
 */
export function refreshAuthSession(): Promise<StoredAuthSession | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const current = readAuthSession();
    if (!current) {
      return null;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': current.csrfToken,
        },
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as RefreshPayload;
      const next: StoredAuthSession = {
        accessToken: payload.accessToken,
        csrfToken: payload.csrfToken,
        account: payload.account,
      };
      writeAuthSession(next);
      return next;
    } catch {
      return null;
    }
  })();

  try {
    return refreshInFlight;
  } finally {
    void refreshInFlight.finally(() => {
      refreshInFlight = null;
    });
  }
}

/**
 * Reset the one-shot expiry guard. Call after a successful login so a later
 * expiry can redirect again within the same page lifetime.
 */
export function resetAuthExpiryGuard() {
  expiryHandled = false;
}
