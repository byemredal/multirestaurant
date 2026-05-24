import { getCountryConfig } from './countries';

/**
 * Platform branding configuration. These values are persisted once during
 * setup and are intended to be reusable later across the web, admin, partner
 * and email surfaces.
 */
export interface BrandingConfig {
  platformName: string;
  supportEmail: string;
  logoUrl: string | null;
  defaultCountry: string;
  defaultLanguage: string;
  defaultCurrency: string;
  defaultTimezone: string;
}

/** Localization defaults derived from a country's code-driven config. */
export interface CountryDefaults {
  defaultLanguage: string;
  defaultCurrency: string;
  defaultTimezone: string;
}

/**
 * Resolves the localization defaults for a country from its code-driven
 * config — used at setup time so branding stores concrete values.
 */
export function resolveCountryDefaults(countryCode: string): CountryDefaults {
  const config = getCountryConfig(countryCode);
  return {
    defaultLanguage: config.locale,
    defaultCurrency: config.currency,
    defaultTimezone: config.timezone,
  };
}
