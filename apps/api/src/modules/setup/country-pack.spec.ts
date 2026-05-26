import {
  COUNTRY_PACKS,
  CH_PACK,
  TR_PACK,
  SUPPORTED_COUNTRY_CODES,
  getCountryConfig,
  getCountryPack,
  isSupportedCountry,
  toCountryPackClientView,
} from '@lieferzonen/config';

/**
 * Acceptance tests for the CountryPack registry. These exist in the API
 * package because @lieferzonen/config ships only a TypeScript build (no
 * jest harness of its own) but is consumed via the workspace from here.
 */
describe('CountryPack registry', () => {
  it('lists exactly the supported countries', () => {
    expect(SUPPORTED_COUNTRY_CODES.sort()).toEqual(['CH', 'TR']);
    expect(Object.keys(COUNTRY_PACKS).sort()).toEqual(['CH', 'TR']);
  });

  it('resolves the CH pack with Swiss localization + tax + bank values', () => {
    const pack = getCountryPack('CH');
    expect(pack).toBe(CH_PACK);
    expect(pack.country).toBe('CH');
    expect(pack.locale).toBe('de-CH');
    expect(pack.currency).toBe('CHF');
    expect(pack.timezone).toBe('Europe/Zurich');
    expect(pack.phone.e164Country).toBe('+41');
    expect(pack.phone.otpLength).toBe(6);
    expect(pack.tax.label).toBe('VAT');
    expect(pack.tax.defaultRate).toBe(7.7);
    expect(pack.bank.ibanCountryCode).toBe('CH');
    expect(pack.bank.ibanLength).toBe(21);
    expect(pack.address.stateOrCanton).toBe('canton');
    expect(pack.invoicing.taxIdLabel).toBe('UID');
  });

  it('resolves the TR pack with Turkish localization + tax + bank values', () => {
    const pack = getCountryPack('TR');
    expect(pack).toBe(TR_PACK);
    expect(pack.country).toBe('TR');
    expect(pack.locale).toBe('tr-TR');
    expect(pack.currency).toBe('TRY');
    expect(pack.timezone).toBe('Europe/Istanbul');
    expect(pack.phone.e164Country).toBe('+90');
    expect(pack.tax.label).toBe('KDV');
    expect(pack.tax.defaultRate).toBe(10);
    expect(pack.bank.ibanCountryCode).toBe('TR');
    expect(pack.bank.ibanLength).toBe(26);
    expect(pack.invoicing.requireTaxId).toBe(true);
    expect(pack.invoicing.taxIdLabel).toBe('VKN');
  });

  it('flags supported countries via isSupportedCountry', () => {
    expect(isSupportedCountry('CH')).toBe(true);
    expect(isSupportedCountry('TR')).toBe(true);
    expect(isSupportedCountry('US')).toBe(false);
    expect(isSupportedCountry('')).toBe(false);
  });

  it('throws on an unsupported country code (fails closed)', () => {
    expect(() => getCountryPack('US')).toThrow(/Unsupported country code: US/);
    expect(() => getCountryConfig('XX')).toThrow(/Unsupported country code/);
  });

  it('returns the legacy CountryConfig shape from the same pack', () => {
    const config = getCountryConfig('CH');
    expect(config).toEqual({
      country: 'CH',
      locale: 'de-CH',
      currency: 'CHF',
      timezone: 'Europe/Zurich',
    });
  });

  it('projects to a client-safe view that hides server-only policy fields', () => {
    const view = toCountryPackClientView(CH_PACK);
    expect(view.country).toBe('CH');
    expect(view.currency).toBe('CHF');
    expect(view.phone.e164Country).toBe('+41');
    expect(view.tax.defaultRate).toBe(7.7);
    expect(view.address.postalCodeRegex).toBe('^\\d{4}$');
    // The OTP provider and IBAN length are server-side decisions and must
    // not leak through the client view.
    expect(view).not.toHaveProperty('bank');
    expect(view.phone).not.toHaveProperty('otpProvider');
    expect(view.phone).not.toHaveProperty('localNumberRegex');
  });

  it('phone regex validates an example TR mobile number and rejects landlines', () => {
    const regex = new RegExp(TR_PACK.phone.localNumberRegex);
    expect(regex.test('5301234567')).toBe(true);
    // Landlines (start with 2/3/4) are not OTP-eligible — must fail.
    expect(regex.test('2121234567')).toBe(false);
    expect(regex.test('530123456')).toBe(false); // too short
  });

  it('postal code regex validates a CH four-digit code and rejects others', () => {
    const regex = new RegExp(CH_PACK.address.postalCodeRegex);
    expect(regex.test('8001')).toBe(true);
    expect(regex.test('800')).toBe(false);
    expect(regex.test('80012')).toBe(false);
    expect(regex.test('AB12')).toBe(false);
  });

  it('every pack carries a packVersion (drift mitigation contract)', () => {
    expect(CH_PACK.packVersion).toMatch(/^CH-\d+$/);
    expect(TR_PACK.packVersion).toMatch(/^TR-\d+$/);
  });
});
