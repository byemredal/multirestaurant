import { resolveApiBaseUrl } from '@shared/api-base-url';

// Generic compile-time fallback. The runtime brand name is resolved from the
// public `/config/branding` endpoint via `useBranding()` — see BrandingProvider.
export const adminAppName =
  process.env.NEXT_PUBLIC_ADMIN_APP_NAME ?? 'Admin';

export const apiBaseUrl = resolveApiBaseUrl();
