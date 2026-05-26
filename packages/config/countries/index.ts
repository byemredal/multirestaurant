import { CH_PACK } from './CH';
import { TR_PACK } from './TR';
import type { CountryPack, SupportedCountryCode } from './country-pack';

export type { CountryPack, SupportedCountryCode } from './country-pack';
export {
  toCountryPackClientView,
  type CountryPackClientView,
  type CountryPhonePolicy,
  type CountryTaxPolicy,
  type CountryBankPolicy,
  type CountryAddressPolicy,
  type CountryInvoicingPolicy,
  type CountryOnboardingPolicy,
  type CountryLegalDocumentDefault,
  type CountryTerminologyOverrides,
} from './country-pack';

/**
 * Legacy shape preserved for callers that only need the localization triple.
 * New code should consume `CountryPack` directly. `CountryConfig` is a strict
 * subset and is derived from the registered pack so the two cannot drift.
 */
export interface CountryConfig {
  country: string;
  locale: string;
  currency: string;
  timezone: string;
}

/**
 * Registry of supported country packs. Adding a country is a new file +
 * one line here — no schema engine, no dynamic registration.
 */
export const COUNTRY_PACKS: Record<SupportedCountryCode, CountryPack> = {
  CH: CH_PACK,
  TR: TR_PACK,
};

export const SUPPORTED_COUNTRY_CODES: SupportedCountryCode[] = Object.keys(
  COUNTRY_PACKS,
) as SupportedCountryCode[];

export function isSupportedCountry(code: string): code is SupportedCountryCode {
  return Object.prototype.hasOwnProperty.call(COUNTRY_PACKS, code);
}

/** Returns the full CountryPack for a country code, or throws on unknown codes. */
export function getCountryPack(code: string): CountryPack {
  if (!isSupportedCountry(code)) {
    throw new Error(`Unsupported country code: ${code}`);
  }
  return COUNTRY_PACKS[code];
}

/**
 * Legacy alias kept for callers that only need the localization triple.
 * Built from `getCountryPack` so the two views stay in lockstep.
 */
export const COUNTRY_CONFIGS: Record<string, CountryConfig> = Object.fromEntries(
  Object.entries(COUNTRY_PACKS).map(([code, pack]) => [
    code,
    {
      country: pack.country,
      locale: pack.locale,
      currency: pack.currency,
      timezone: pack.timezone,
    } satisfies CountryConfig,
  ]),
);

/** Returns the legacy `{country, locale, currency, timezone}` view. */
export function getCountryConfig(code: string): CountryConfig {
  const pack = getCountryPack(code);
  return {
    country: pack.country,
    locale: pack.locale,
    currency: pack.currency,
    timezone: pack.timezone,
  };
}

export { CH_PACK, TR_PACK };

/**
 * Legacy named exports for `CH_CONFIG` — the previous shape. Kept so callers
 * that imported the old constant keep working through the rebase.
 */
export const CH_CONFIG: CountryConfig = {
  country: CH_PACK.country,
  locale: CH_PACK.locale,
  currency: CH_PACK.currency,
  timezone: CH_PACK.timezone,
};
