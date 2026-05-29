import type { HttpMethod } from '@/types/api-console';
import { onAuthExpired, refreshAuthSession } from '@/lib/auth/auth-expiry';

export interface ApiClientRequest {
  method: HttpMethod;
  url: string;
  token?: string;
  body?: unknown;
  /** Internal: prevents infinite refresh/retry loops. */
  _isRetry?: boolean;
}

async function rawFetch(method: HttpMethod, url: string, token: string | undefined, body: unknown) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (token?.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  return fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function apiClient({ method, url, token, body, _isRetry }: ApiClientRequest) {
  let response = await rawFetch(method, url, token, body);

  // Authenticated request rejected — try a single-flight silent refresh, then
  // retry once. If the refresh fails, trigger the central expiry handler.
  if (response.status === 401 && token?.trim() && !_isRetry) {
    const refreshed = await refreshAuthSession();
    if (refreshed) {
      response = await rawFetch(method, url, refreshed.accessToken, body);
      if (response.status === 401) {
        onAuthExpired('refresh_failed');
      }
    } else {
      onAuthExpired('refresh_failed');
    }
  }

  const text = await response.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    data,
  };
}
