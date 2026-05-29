import type { StoredAdminSession } from '@/lib/storage/admin-session';
import { adminAuthedFetch } from './authed-fetch';

export type GeoProviderId = 'locationiq' | 'none';

export type GeoProviderConfig = {
  provider: GeoProviderId;
  apiKeyConfigured: boolean;
  active: boolean;
  availableProviders: ReadonlyArray<{ id: GeoProviderId; label: string }>;
};

async function adminRequest<T>(
  _session: StoredAdminSession,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await adminAuthedFetch(path, init);
  if (!response.ok) {
    let message = `admin_platform_settings_failed_${response.status}`;
    try {
      const payload = await response.json();
      if (typeof payload?.message === 'string' && payload.message) {
        message = payload.message;
      }
    } catch {
      /* keep status fallback */
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export function getGeoProviderConfig(session: StoredAdminSession) {
  return adminRequest<GeoProviderConfig>(session, '/admin/platform-settings/geo-provider');
}

export function setGeoProvider(
  session: StoredAdminSession,
  provider: GeoProviderId,
) {
  return adminRequest<Omit<GeoProviderConfig, 'availableProviders'>>(
    session,
    '/admin/platform-settings/geo-provider',
    {
      method: 'PUT',
      body: JSON.stringify({ provider }),
    },
  );
}
