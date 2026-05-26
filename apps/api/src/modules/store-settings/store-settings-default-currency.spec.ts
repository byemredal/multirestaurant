import { StoreSettingsStore } from './store-settings.store';

/**
 * Confirms StoreSettingsStore picks defaults from the active
 * InstallationProfile rather than the previously-hardcoded CHF/tr-TR.
 */
describe('StoreSettingsStore default currency resolution', () => {
  function makeStore(activeCurrency: string | null) {
    const installationProfileService = {
      findActiveCountryPolicy: jest.fn().mockResolvedValue(
        activeCurrency
          ? {
              countryCode: activeCurrency === 'TRY' ? 'TR' : 'CH',
              locale: activeCurrency === 'TRY' ? 'tr-TR' : 'de-CH',
              currencyCode: activeCurrency,
              timezone:
                activeCurrency === 'TRY' ? 'Europe/Istanbul' : 'Europe/Zurich',
              pack: {} as any,
            }
          : null,
      ),
    };
    return new StoreSettingsStore({} as any, installationProfileService as any);
  }

  function callPrivate<T>(store: StoreSettingsStore, name: string): Promise<T> {
    return (store as any)[name]();
  }

  it('returns the TR install currency for a TR deployment', async () => {
    const store = makeStore('TRY');
    await expect(callPrivate<string>(store, 'resolveInstallCurrencyCode')).resolves.toBe(
      'TRY',
    );
  });

  it('returns the CH install currency for a CH deployment', async () => {
    const store = makeStore('CHF');
    await expect(callPrivate<string>(store, 'resolveInstallCurrencyCode')).resolves.toBe(
      'CHF',
    );
  });

  it('falls back to CHF when the install profile is missing (legacy DB)', async () => {
    const store = makeStore(null);
    await expect(callPrivate<string>(store, 'resolveInstallCurrencyCode')).resolves.toBe(
      'CHF',
    );
  });

  it('resolves locale from the active profile for the seed-currency lookup', async () => {
    const store = makeStore('TRY');
    await expect(callPrivate<string>(store, 'resolveInstallLocale')).resolves.toBe(
      'tr-TR',
    );
  });
});
