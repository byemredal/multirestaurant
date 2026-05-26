/**
 * Country Pack — controlled, typed installation profile.
 *
 * The shape is fixed by TypeScript. Adding a country is a new file + one
 * registry line; there is intentionally no JSON schema engine and no
 * runtime country builder. See `docs/architecture/adr/ADR-country-pack-platform-schema.md`.
 *
 * The legacy `CountryConfig` (country/locale/currency/timezone) is preserved
 * as a subset of `CountryPack` for backwards compatibility with the setup
 * wizard. New code should consume `CountryPack`.
 */

/** ISO-3166 alpha-2 country codes the platform supports. Literal union, not string. */
export type SupportedCountryCode = 'CH' | 'TR';

/** Phone/OTP policy for the country pack. */
export interface CountryPhonePolicy {
  /** E.164 dialing prefix including the leading '+'. */
  e164Country: string;
  /** OTP delivery provider. `mock` is used in dev/local; `twilio` is reserved for prod. */
  otpProvider: 'twilio' | 'mock';
  /** Numeric OTP code length. */
  otpLength: 4 | 6;
  /** Regex (serializable) that validates a local phone number after the country prefix. */
  localNumberRegex: string;
}

/** Tax / VAT / KDV policy. */
export interface CountryTaxPolicy {
  /** Operator-facing label rendered on receipts and admin UIs. */
  label: 'VAT' | 'KDV';
  /** Default rate applied when a store has not customized its tax setting. */
  defaultRate: number;
  /** Choices a store admin can pick from. The first entry is the default. */
  rateChoices: number[];
  /** Whether menu prices are shown including the tax by default for this country. */
  pricesIncludeTaxByDefault: boolean;
}

/** Bank / IBAN policy. */
export interface CountryBankPolicy {
  /** Whether the country uses pure IBAN or allows a national account fallback. */
  accountKind: 'IBAN' | 'IBAN_OR_ACCOUNT';
  /** Expected IBAN country prefix, e.g. 'CH', 'TR'. */
  ibanCountryCode: string;
  /** Required IBAN total length (incl. country code + check digits). */
  ibanLength: number;
  /** Whether SWIFT/BIC is required when collecting bank details. */
  requireSwift: boolean;
}

/** Address policy. */
export interface CountryAddressPolicy {
  /** Whether postal code is required on tenant/store addresses. */
  requirePostalCode: boolean;
  /** Regex (serializable) the postal code must match when provided. */
  postalCodeRegex: string;
  /** Sub-national label, used for form hints. */
  stateOrCanton: 'state' | 'canton' | 'province' | 'none';
}

/** Invoicing / billing fields. */
export interface CountryInvoicingPolicy {
  /** Which legal name field is shown to the operator. */
  legalNameField: 'companyName' | 'merchantName';
  /** Whether a tax ID (UID / VKN / VAT-ID) must be collected. */
  requireTaxId: boolean;
  /** Operator-facing tax ID label. */
  taxIdLabel: 'UID' | 'VKN' | 'VAT-ID';
}

/** Onboarding required documents. Codes resolve against `LegalDocumentType`. */
export interface CountryOnboardingPolicy {
  /** Document codes the partner onboarding flow must collect. */
  requiredDocuments: string[];
}

/** Legal document defaults / keys. */
export interface CountryLegalDocumentDefault {
  /** Stable code matched against the `LegalDocumentType` taxonomy. */
  typeCode: string;
  /** Initial version label seeded at setup time. */
  versionLabel: string;
  /** Locale this default body is written in. */
  locale: string;
  /**
   * Placeholder body content. Always marked as placeholder so production legal
   * text never silently ships from this constant.
   */
  placeholderTitle: string;
  placeholderBody: string;
}

/**
 * Terminology overrides — full mapping lands in ADR-terminology-mapping.
 * Reserved as an open object for now so the CountryPack shape is stable.
 */
export interface CountryTerminologyOverrides {
  /** Optional human-facing label for "Store" — falls back to platform default. */
  storeNoun?: string;
  /** Optional human-facing label for "Order" — falls back to platform default. */
  orderNoun?: string;
}

/**
 * Subset of the CountryPack that is safe to expose to non-admin clients via
 * `GET /platform/pack`. Provider keys, secrets, internal regex hints kept
 * server-side stay out of this projection.
 */
export interface CountryPackClientView {
  country: SupportedCountryCode;
  locale: string;
  supportedLocales: string[];
  currency: string;
  timezone: string;
  phone: {
    e164Country: string;
    otpLength: 4 | 6;
  };
  tax: {
    label: 'VAT' | 'KDV';
    defaultRate: number;
    pricesIncludeTaxByDefault: boolean;
  };
  address: {
    requirePostalCode: boolean;
    postalCodeRegex: string;
    stateOrCanton: 'state' | 'canton' | 'province' | 'none';
  };
  invoicing: {
    legalNameField: 'companyName' | 'merchantName';
    requireTaxId: boolean;
    taxIdLabel: 'UID' | 'VKN' | 'VAT-ID';
  };
}

/**
 * Full CountryPack. The DB-persisted InstallationProfile pins the active pack
 * and its `packVersion`; everything else is read from this code-driven object
 * at runtime.
 */
export interface CountryPack {
  country: SupportedCountryCode;
  /** Pack revision — increment when adding/changing fields in a country file. */
  packVersion: string;
  /** Default locale, BCP-47, e.g. `de-CH`. */
  locale: string;
  /** Locales the country pack supports. Includes `locale`. */
  supportedLocales: string[];
  /** ISO-4217 currency. */
  currency: string;
  /** IANA timezone. */
  timezone: string;
  phone: CountryPhonePolicy;
  tax: CountryTaxPolicy;
  bank: CountryBankPolicy;
  address: CountryAddressPolicy;
  invoicing: CountryInvoicingPolicy;
  onboarding: CountryOnboardingPolicy;
  legalDocuments: CountryLegalDocumentDefault[];
  terminology: CountryTerminologyOverrides;
}

/** Projects a CountryPack down to the client-safe subset. */
export function toCountryPackClientView(pack: CountryPack): CountryPackClientView {
  return {
    country: pack.country,
    locale: pack.locale,
    supportedLocales: [...pack.supportedLocales],
    currency: pack.currency,
    timezone: pack.timezone,
    phone: {
      e164Country: pack.phone.e164Country,
      otpLength: pack.phone.otpLength,
    },
    tax: {
      label: pack.tax.label,
      defaultRate: pack.tax.defaultRate,
      pricesIncludeTaxByDefault: pack.tax.pricesIncludeTaxByDefault,
    },
    address: {
      requirePostalCode: pack.address.requirePostalCode,
      postalCodeRegex: pack.address.postalCodeRegex,
      stateOrCanton: pack.address.stateOrCanton,
    },
    invoicing: {
      legalNameField: pack.invoicing.legalNameField,
      requireTaxId: pack.invoicing.requireTaxId,
      taxIdLabel: pack.invoicing.taxIdLabel,
    },
  };
}
