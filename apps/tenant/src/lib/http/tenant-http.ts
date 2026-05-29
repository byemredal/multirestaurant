import { resolveApiBaseUrl } from '@shared/api-base-url';
import type { StoredTenantSession } from '@/lib/storage/tenant-session';
import { onTenantAuthExpired, refreshTenantSession } from '@/lib/auth/auth-expiry';

export const apiBaseUrl = resolveApiBaseUrl();

/**
 * Stable backend error codes → user-facing Turkish messages. Keeps raw codes
 * out of the UI and gives a consistent message even if the backend wording
 * changes. Unknown codes fall back to the backend `message`.
 */
const ERROR_CODE_MESSAGES: Record<string, string> = {
  store_currency_mismatch:
    'Mağaza para birimi platformun aktif para birimiyle uyumlu olmalıdır.',
  store_country_mismatch:
    'Restoran adresi platformun aktif ülkesiyle uyumlu değil.',
  invalid_postal_code:
    'Posta kodu platformun aktif ülkesiyle uyumlu değil.',
  invalid_coverage_postal_code:
    'Teslimat bölgesi posta kodu platformun aktif ülkesiyle uyumlu değil.',
  geo_country_mismatch: 'Adres, platformun aktif ülkesiyle uyumlu değil.',
};

function rawTenantFetch(accessToken: string, path: string, init?: RequestInit) {
  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(
        init?.body && !(init.body instanceof FormData) // init.body FormData sınıfından değilse, Content-Type başlığını application/json olarak ayarla
          ? { 'Content-Type': 'application/json' }
          : {}
      ),
      ...(init?.headers ?? {}),
    },
  });
}

export async function tenantRequest<T>(
  path: string,
  session: StoredTenantSession,
  init?: RequestInit,
) {
  let response = await rawTenantFetch(session.accessToken, path, init);

  // Expired access token — single-flight silent refresh, then retry once.
  if (response.status === 401) {
    const refreshed = await refreshTenantSession();
    if (refreshed) {
      response = await rawTenantFetch(refreshed.accessToken, path, init);
      if (response.status === 401) {
        onTenantAuthExpired();
        throw new Error('tenant_session_expired');
      }
    } else {
      onTenantAuthExpired();
      throw new Error('tenant_session_expired');
    }
  }

  if (!response.ok) {
    let errorMessage = `tenant_request_failed_${response.status}`;

    try {
      const payload = await response.json();
      if (typeof payload?.code === 'string' && ERROR_CODE_MESSAGES[payload.code]) {
        errorMessage = ERROR_CODE_MESSAGES[payload.code];
      } else if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
        errorMessage = payload.errors.join(', ');
      } else if (Array.isArray(payload?.missingFields) && payload.missingFields.length > 0) {
        errorMessage = `Missing fields: ${payload.missingFields.join(', ')}`;
      } else if (Array.isArray(payload?.message) && payload.message.length > 0) {
        errorMessage = payload.message.join(', ');
      } else if (typeof payload?.message === 'string' && payload.message.length > 0) {
        errorMessage = payload.message;
      } else if (typeof payload?.error === 'string' && payload.error.length > 0) {
        errorMessage = payload.error;
      }
    } catch {
      // Use the status-based fallback when the error body is not JSON.
    }

    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}
