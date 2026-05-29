'use client';

import { apiBaseUrl } from '@/lib/config';
import {
  readAdminSession,
  writeAdminSession,
  type StoredAdminSession,
} from '@/lib/storage/admin-session';
import { triggerAdminAuthExpiry } from './auth-expiry';

/**
 * Thrown by the centralized admin fetch wrapper when the session is no longer
 * usable (no stored session, 401 after a single silent refresh, or refresh
 * call itself failed). The wrapper has already cleared the session, broadcast
 * the cross-tab event, and started the redirect to /login?reason=session_expired
 * by the time this error is thrown — consumers should let it propagate and
 * MUST NOT surface its message in a danger/error card.
 */
export class AuthExpiredError extends Error {
  constructor(public readonly reason: 'session_expired' | 'refresh_failed' = 'session_expired') {
    super(`admin_${reason}`);
    this.name = 'AuthExpiredError';
  }
}

export function isAuthExpiredError(error: unknown): error is AuthExpiredError {
  return error instanceof AuthExpiredError;
}

type AdminAuthRefreshPayload = {
  accessToken: string;
  csrfToken: string;
  admin: StoredAdminSession['admin'];
};

let refreshInFlight: Promise<StoredAdminSession> | null = null;

async function refreshAdminAccessToken(): Promise<StoredAdminSession> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const current = readAdminSession();
    if (!current) {
      throw new Error('no_admin_session');
    }
    const response = await fetch(`${apiBaseUrl}/admin/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': current.csrfToken },
    });
    if (!response.ok) {
      throw new Error(`admin_refresh_failed_${response.status}`);
    }
    const payload = (await response.json()) as AdminAuthRefreshPayload;
    const next: StoredAdminSession = {
      accessToken: payload.accessToken,
      csrfToken: payload.csrfToken,
      admin: payload.admin,
    };
    writeAdminSession(next);
    return next;
  })();
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

function buildHeaders(
  init: RequestInit | undefined,
  session: StoredAdminSession,
): HeadersInit {
  const hasJsonBody = init?.body && !(init.body instanceof FormData);
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${session.accessToken}`,
    ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
    ...(init?.headers ?? {}),
  };
}

/**
 * Centralized authed fetch for the admin app. All admin API clients route
 * through this helper so a single place owns the 401 → refresh → retry-1 →
 * expire chain. 403 is intentionally passed through unchanged — permission
 * denials are NOT auth-expiry and must not log the operator out.
 *
 * Callers receive a regular Response and continue with their own error/body
 * parsing on non-401 statuses. On unrecoverable auth failure the wrapper
 * throws AuthExpiredError after triggering the cross-tab broadcast + redirect.
 */
export async function adminAuthedFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const session = readAdminSession();
  if (!session) {
    triggerAdminAuthExpiry('session_expired');
    throw new AuthExpiredError('session_expired');
  }

  const firstResponse = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: buildHeaders(init, session),
  });

  if (firstResponse.status !== 401) {
    return firstResponse;
  }

  // Silent refresh once; concurrent 401s share the same in-flight promise.
  let refreshed: StoredAdminSession;
  try {
    refreshed = await refreshAdminAccessToken();
  } catch {
    triggerAdminAuthExpiry('refresh_failed');
    throw new AuthExpiredError('refresh_failed');
  }

  const retryResponse = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: buildHeaders(init, refreshed),
  });

  if (retryResponse.status === 401) {
    triggerAdminAuthExpiry('session_expired');
    throw new AuthExpiredError('session_expired');
  }

  return retryResponse;
}
