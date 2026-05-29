'use client';

import { apiBaseUrl } from '@/lib/config';
import {
  readAuthSession,
  writeAuthSession,
  type StoredAuthSession,
} from '@/lib/storage/auth-session';
import { triggerWebAuthExpiry } from '@/lib/auth/auth-expiry';

/**
 * AuthExpiredError is thrown by webAuthedFetch after an unrecoverable auth
 * failure. By the time it is thrown, the local session has been cleared,
 * the cross-tab event has been broadcast and the redirect to /login has
 * been kicked off. Callers should let it propagate and must NOT surface the
 * message in an error/danger card — the page is already navigating away.
 */
export class AuthExpiredError extends Error {
  constructor(public readonly reason: 'session_expired' | 'refresh_failed' = 'session_expired') {
    super(`web_${reason}`);
    this.name = 'AuthExpiredError';
  }
}

export function isAuthExpiredError(error: unknown): error is AuthExpiredError {
  return error instanceof AuthExpiredError;
}

type AuthRefreshPayload = {
  accessToken: string;
  csrfToken: string;
  account: StoredAuthSession['account'];
};

let refreshInFlight: Promise<StoredAuthSession> | null = null;

async function refreshCustomerAccessToken(): Promise<StoredAuthSession> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const current = readAuthSession();
    if (!current) {
      throw new Error('no_customer_session');
    }
    const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': current.csrfToken },
    });
    if (!response.ok) {
      throw new Error(`customer_refresh_failed_${response.status}`);
    }
    const payload = (await response.json()) as AuthRefreshPayload;
    const next: StoredAuthSession = {
      accessToken: payload.accessToken,
      csrfToken: payload.csrfToken,
      account: payload.account,
    };
    writeAuthSession(next);
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
  accessToken: string,
): HeadersInit {
  const hasJsonBody = init?.body && !(init.body instanceof FormData);
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
    ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
    ...(init?.headers ?? {}),
  };
}

/**
 * Centralized authed fetch for the customer (web) app. Use this for any
 * protected customer endpoint (orders/rewards/stampcards/account/cart-side
 * mutations). 401 triggers a single silent refresh; concurrent 401s share
 * the same in-flight refresh promise. 403 is intentionally passed through —
 * permission denials and business-rule rejections must not log the customer
 * out. Public endpoints (discovery, public store data) should NOT use this
 * helper — they have no token to attach.
 */
export async function webAuthedFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const current = readAuthSession();
  if (!current) {
    triggerWebAuthExpiry('session_expired');
    throw new AuthExpiredError('session_expired');
  }

  const url = path.startsWith('http') ? path : `${apiBaseUrl}${path}`;

  const firstResponse = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: buildHeaders(init, current.accessToken),
  });

  if (firstResponse.status !== 401) {
    return firstResponse;
  }

  let refreshed: StoredAuthSession;
  try {
    refreshed = await refreshCustomerAccessToken();
  } catch {
    triggerWebAuthExpiry('refresh_failed');
    throw new AuthExpiredError('refresh_failed');
  }

  const retryResponse = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: buildHeaders(init, refreshed.accessToken),
  });

  if (retryResponse.status === 401) {
    triggerWebAuthExpiry('session_expired');
    throw new AuthExpiredError('session_expired');
  }

  return retryResponse;
}
