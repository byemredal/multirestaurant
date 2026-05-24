import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BrandingConfig,
  CountryConfig,
  getCountryConfig,
  resolveCountryDefaults,
} from '@lieferzonen/config';
import { SetupStore } from '../setup/setup.store';

@Injectable()
export class PlatformConfigService {
  constructor(private readonly setupStore: SetupStore) {}

  /** Returns the persisted platform branding configuration. */
  async getBranding(): Promise<BrandingConfig> {
    const setup = await this.setupStore.getPlatformSetup();
    if (!setup) {
      throw new NotFoundException('Platform branding is not configured yet.');
    }

    // Older rows may predate the localization columns — fall back to the
    // code-driven country defaults so the response is always complete.
    const fallback = resolveCountryDefaults(setup.primaryCountry);

    return {
      platformName: setup.platformName,
      supportEmail: setup.supportEmail,
      logoUrl: setup.logoUrl,
      defaultCountry: setup.primaryCountry,
      defaultLanguage: setup.defaultLanguage ?? fallback.defaultLanguage,
      defaultCurrency: setup.defaultCurrency ?? fallback.defaultCurrency,
      defaultTimezone: setup.defaultTimezone ?? fallback.defaultTimezone,
    };
  }

  /** Returns the code-driven config for the platform's primary country. */
  async getCurrentCountry(): Promise<CountryConfig> {
    const setup = await this.setupStore.getPlatformSetup();
    if (!setup) {
      throw new NotFoundException('No primary country is configured yet.');
    }

    return getCountryConfig(setup.primaryCountry);
  }
}
