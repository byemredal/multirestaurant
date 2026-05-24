import { CH_CONFIG } from './CH';

/** Shape of a single code-driven country configuration. */
export interface CountryConfig {
  country: string;
  locale: string;
  currency: string;
  timezone: string;
}

/**
 * Registry of supported countries. The MVP launches with Switzerland only;
 * adding a country is a one-line change here plus a new config file.
 */
export const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  CH: CH_CONFIG,
};

export const SUPPORTED_COUNTRY_CODES: string[] = Object.keys(COUNTRY_CONFIGS);

export function isSupportedCountry(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(COUNTRY_CONFIGS, code);
}

/** Returns the config for a country code, or throws for an unsupported one. */
export function getCountryConfig(code: string): CountryConfig {
  const config = COUNTRY_CONFIGS[code];
  if (!config) {
    throw new Error(`Unsupported country code: ${code}`);
  }
  return config;
}

export { CH_CONFIG };
