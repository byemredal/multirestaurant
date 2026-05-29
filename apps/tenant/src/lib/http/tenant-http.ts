import { resolveApiBaseUrl } from '@shared/api-base-url';
import type { StoredTenantSession } from '@/lib/storage/tenant-session';

export const apiBaseUrl = resolveApiBaseUrl();

export async function tenantRequest<T>(
  path: string,
  session: StoredTenantSession,
  init?: RequestInit,
) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      ...(
        init?.body && !(init.body instanceof FormData) // init.body FormData sınıfından değilse, Content-Type başlığını application/json olarak ayarla
          ? { 'Content-Type': 'application/json' }
          : {}
      ),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let errorMessage = `tenant_request_failed_${response.status}`;

    try {
      const payload = await response.json();
      if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
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
