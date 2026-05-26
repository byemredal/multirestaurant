import { PaymentsService } from './payments.service';

/**
 * Currency fallback resolution for Stripe Checkout sessions.
 *
 * Two contracts:
 *   1. An order's frozen `currencySnapshot` ALWAYS wins — historical orders
 *      pay in their original currency even if the install changes (a TR
 *      install reopening a CH order keeps the CHF receipt).
 *   2. When the snapshot is missing/blank, fall back to the active
 *      InstallationProfile currency rather than the previous hardcoded CHF.
 */
describe('PaymentsService.resolveCheckoutCurrency', () => {
  function makeService(activeCurrency: string | null) {
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
    const service = new PaymentsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      installationProfileService as any,
    );
    return { service, installationProfileService };
  }

  function resolve(service: PaymentsService, snapshot: string | null) {
    // Reach the private through bracket access — narrow, deliberate, scoped
    // to this test file.
    return (service as any).resolveCheckoutCurrency(snapshot) as Promise<string>;
  }

  it("prefers the order's frozen currencySnapshot when present", async () => {
    const { service, installationProfileService } = makeService('TRY');
    await expect(resolve(service, 'CHF')).resolves.toBe('CHF');
    // No need to read the profile when the snapshot is good.
    expect(installationProfileService.findActiveCountryPolicy).not.toHaveBeenCalled();
  });

  it('falls back to the active InstallationProfile currency when snapshot is empty', async () => {
    const { service } = makeService('TRY');
    await expect(resolve(service, '')).resolves.toBe('TRY');
  });

  it('falls back to the active InstallationProfile currency when snapshot is null', async () => {
    const { service } = makeService('CHF');
    await expect(resolve(service, null)).resolves.toBe('CHF');
  });

  it("uses CHF as a last-resort default when no install profile exists (legacy DB)", async () => {
    const { service } = makeService(null);
    await expect(resolve(service, null)).resolves.toBe('CHF');
  });
});
