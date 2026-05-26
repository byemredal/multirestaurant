import type { CountryPack } from './country-pack';

/**
 * Türkiye country pack.
 *
 * Hukuki placeholder içerik production-grade değildir — yayına almadan önce
 * hukuk/finans tarafından yenilenmelidir. KDV oranları ve IBAN uzunluğu
 * Türkiye konvansiyonlarına göre seçildi (TR IBAN = 26).
 */
export const TR_PACK: CountryPack = {
  country: 'TR',
  packVersion: 'TR-1',
  locale: 'tr-TR',
  supportedLocales: ['tr-TR', 'en-US'],
  currency: 'TRY',
  timezone: 'Europe/Istanbul',
  phone: {
    e164Country: '+90',
    otpProvider: 'mock',
    otpLength: 6,
    // Local part after +90: 10 digits, first digit must be 5 (mobile) for OTP-eligible numbers.
    localNumberRegex: '^5\\d{9}$',
  },
  tax: {
    label: 'KDV',
    defaultRate: 10,
    rateChoices: [0, 1, 8, 10, 20],
    pricesIncludeTaxByDefault: true,
  },
  bank: {
    accountKind: 'IBAN',
    ibanCountryCode: 'TR',
    ibanLength: 26,
    requireSwift: false,
  },
  address: {
    requirePostalCode: false,
    // 5 digits, optional in TR; rendered as a hint when present.
    postalCodeRegex: '^\\d{5}$',
    stateOrCanton: 'province',
  },
  invoicing: {
    legalNameField: 'companyName',
    requireTaxId: true,
    taxIdLabel: 'VKN',
  },
  onboarding: {
    requiredDocuments: [
      'commercial_register_extract',
      'identity_document',
      'bank_statement',
      'tax_certificate',
    ],
  },
  legalDocuments: [
    {
      typeCode: 'terms_of_service',
      versionLabel: '1.0',
      locale: 'tr-TR',
      placeholderTitle: 'Kullanım Koşulları (taslak)',
      placeholderBody:
        'Kullanım Koşulları (taslak / production değil). Bu doküman platform ' +
        'kurulumu sırasında oluşturuldu ve yayına almadan önce nihai hukuki ' +
        'metinle değiştirilmelidir.',
    },
    {
      typeCode: 'privacy_policy',
      versionLabel: '1.0',
      locale: 'tr-TR',
      placeholderTitle: 'Gizlilik Politikası (taslak)',
      placeholderBody:
        'Gizlilik Politikası (taslak / production değil). Bu doküman platform ' +
        'kurulumu sırasında oluşturuldu ve yayına almadan önce nihai hukuki ' +
        'metinle değiştirilmelidir.',
    },
    {
      typeCode: 'kvkk_disclosure',
      versionLabel: '1.0',
      locale: 'tr-TR',
      placeholderTitle: 'KVKK Aydınlatma Metni (taslak)',
      placeholderBody:
        'KVKK aydınlatma metni (taslak / production değil). Bu doküman platform ' +
        'kurulumu sırasında oluşturuldu ve KVKK ile uyumlu hale getirilmeden ' +
        'yayına alınmamalıdır.',
    },
  ],
  terminology: {
    storeNoun: 'Restoran',
    orderNoun: 'Sipariş',
  },
};
