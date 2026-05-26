// Generic compile-time fallback. The runtime brand name is resolved from the
// public `/config/branding` endpoint via `useBranding()` — see BrandingProvider.
export const adminAppName =
  process.env.NEXT_PUBLIC_ADMIN_APP_NAME ?? 'Admin';

export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
