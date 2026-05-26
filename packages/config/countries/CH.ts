import type { CountryPack } from './country-pack';

/**
 * Switzerland country pack.
 *
 * Legal placeholder text is non-production — production text must replace
 * `placeholderBody` before going live. Tax rates and IBAN length follow
 * Swiss conventions but should be revalidated by finance/legal.
 */
export const CH_PACK: CountryPack = {
  country: 'CH',
  packVersion: 'CH-1',
  locale: 'de-CH',
  supportedLocales: ['de-CH', 'fr-CH', 'it-CH', 'en-CH'],
  currency: 'CHF',
  timezone: 'Europe/Zurich',
  phone: {
    e164Country: '+41',
    // `mock` until production Twilio config lands; switched per-env, not in code.
    otpProvider: 'mock',
    otpLength: 6,
    // Local part after the +41 prefix: 9 digits.
    localNumberRegex: '^[1-9]\\d{8}$',
  },
  tax: {
    label: 'VAT',
    defaultRate: 7.7,
    rateChoices: [0, 2.5, 3.7, 7.7],
    pricesIncludeTaxByDefault: true,
  },
  bank: {
    accountKind: 'IBAN',
    ibanCountryCode: 'CH',
    ibanLength: 21,
    requireSwift: false,
  },
  address: {
    requirePostalCode: true,
    // 4 digits, e.g. 8001.
    postalCodeRegex: '^\\d{4}$',
    stateOrCanton: 'canton',
  },
  invoicing: {
    legalNameField: 'companyName',
    requireTaxId: false,
    taxIdLabel: 'UID',
  },
  onboarding: {
    requiredDocuments: [
      'commercial_register_extract',
      'identity_document',
      'bank_statement',
    ],
  },
  legalDocuments: [
    {
      typeCode: 'terms_of_service',
      versionLabel: '1.0',
      locale: 'de-CH',
      placeholderTitle: 'Nutzungsbedingungen (Platzhalter)',
      placeholderBody:
        'Nutzungsbedingungen (Platzhalter / non-production). Dieses Dokument wurde ' +
        'während des Plattform-Setups erstellt und muss vor dem Go-Live durch den ' +
        'finalen Rechtstext ersetzt werden.',
    },
    {
      typeCode: 'privacy_policy',
      versionLabel: '1.0',
      locale: 'de-CH',
      placeholderTitle: 'Datenschutzerklärung (Platzhalter)',
      placeholderBody:
        'Datenschutzerklärung (Platzhalter / non-production). Dieses Dokument wurde ' +
        'während des Plattform-Setups erstellt und muss vor dem Go-Live durch den ' +
        'finalen Rechtstext ersetzt werden.',
    },
  ],
  terminology: {
    storeNoun: 'Restaurant',
    orderNoun: 'Bestellung',
  },
};
