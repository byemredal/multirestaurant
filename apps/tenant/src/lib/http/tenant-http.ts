import { resolveApiBaseUrl } from '@shared/api-base-url';
import type { StoredTenantSession } from '@/lib/storage/tenant-session';

export const apiBaseUrl = resolveApiBaseUrl();

// Lazy import to avoid a top-level circular dependency: tenantAuthedFetch
// imports apiBaseUrl from this module.
let tenantAuthedFetchRef:
  | ((path: string, init?: RequestInit) => Promise<Response>)
  | null = null;

async function getTenantAuthedFetch() {
  if (!tenantAuthedFetchRef) {
    const mod = await import('@/lib/auth/authed-fetch');
    tenantAuthedFetchRef = mod.tenantAuthedFetch;
  }
  return tenantAuthedFetchRef;
}

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

export async function tenantRequest<T>(
  path: string,
  _session: StoredTenantSession,
  init?: RequestInit,
) {
  // Centralized 401 → refresh → retry-1 → expire lives in tenantAuthedFetch.
  // We keep the `session` param for ABI compatibility with the many call
  // sites but ignore it; the wrapper always reads the latest token from
  // storage so a rotated session is picked up automatically.
  const authedFetch = await getTenantAuthedFetch();
  const response = await authedFetch(path, init);

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
