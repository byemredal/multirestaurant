import { resolveApiBaseUrl } from '@shared/api-base-url';

// Generic fallback. The operator-configured platform name only becomes
// available after this wizard finishes, so the setup app cannot dynamically
// read it — but the fallback must NOT burn the previous brand back in.
export const setupAppName =
  process.env.NEXT_PUBLIC_SETUP_APP_NAME ?? 'Platform Setup';

export const apiBaseUrl = resolveApiBaseUrl();

/**
 * Admin panel sign-in URL. After setup completes the wizard hands off to the
 * admin login, where the freshly created super admin signs in.
 */
export const adminLoginUrl = `${(
  process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3051'
).replace(/\/$/, '')}/login`;

/**
 * Countries the wizard offers. Sourced indirectly from `packages/config`'s
 * CountryPack registry — we hand-curate the display strings (name, flag) but
 * the country codes themselves come from the typed pack registry so the
 * wizard and the backend cannot drift.
 *
 * The MVP launches with Switzerland and Türkiye. Adding a country is a new
 * CountryPack file in `packages/config/countries/` plus one entry here.
 */
export const SETUP_COUNTRIES = [
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', currency: 'CHF', locale: 'de-CH' },
  { code: 'TR', name: 'Türkiye', flag: '🇹🇷', currency: 'TRY', locale: 'tr-TR' },
] as const;

export type SetupCountryCode = (typeof SETUP_COUNTRIES)[number]['code'];

/** Largest logo file accepted, kept small so it fits the API request body. */
export const MAX_LOGO_BYTES = 64 * 1024;
