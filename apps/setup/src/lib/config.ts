export const setupAppName =
  process.env.NEXT_PUBLIC_SETUP_APP_NAME ?? 'Lieferzonen Setup';

export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

/**
 * Admin panel sign-in URL. After setup completes the wizard hands off to the
 * admin login, where the freshly created super admin signs in.
 */
export const adminLoginUrl = `${(
  process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3051'
).replace(/\/$/, '')}/login`;

/**
 * Countries the wizard offers. The platform launches with Switzerland only;
 * the array is intentionally simple so more countries can be appended later.
 */
export const SETUP_COUNTRIES = [
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', currency: 'CHF' },
] as const;

export type SetupCountryCode = (typeof SETUP_COUNTRIES)[number]['code'];

/** Largest logo file accepted, kept small so it fits the API request body. */
export const MAX_LOGO_BYTES = 64 * 1024;
