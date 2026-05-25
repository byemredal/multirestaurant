import type { TenantOnboardingCountryPack } from '@/lib/tenant-onboarding-client';

export type BusinessDetailsFieldKey =
  | 'registrationNumber'
  | 'registeredBusinessName'
  | 'legalForm'
  | 'taxNumber'
  | 'vatNumber'
  | 'registrationCountry'
  | 'registeredAddress';

export type BusinessDetailsFieldConfig = {
  key: BusinessDetailsFieldKey;
  label: string;
  required: boolean;
  helpText?: string;
};

export type AuthorizedPersonFieldKey =
  | 'fullName'
  | 'email'
  | 'phoneNumber'
  | 'roleTitle'
  | 'ownershipPercentage';

export type AuthorizedPersonFieldConfig = {
  key: AuthorizedPersonFieldKey;
  label: string;
  required: boolean;
  helpText?: string;
};

export type BankDetailsFieldKey = 'bankName' | 'accountHolderName' | 'iban' | 'currency';
export type BillingAddressFieldKey =
  | 'useBusinessAddress'
  | 'billingName'
  | 'country'
  | 'city'
  | 'postalCode'
  | 'addressLine1'
  | 'addressLine2';

export type OnboardingFieldConfig<TKey extends string> = {
  key: TKey;
  label: string;
  required: boolean;
  helpText?: string;
};

export function getBusinessDetailsFields(countryPack?: TenantOnboardingCountryPack) {
  const country = countryPack?.country ?? 'CH';
  const registrationLabel = country === 'CH'
    ? 'Registration / UID number'
    : 'Commercial or tax registration number';

  return {
    legalReviewNote:
      'Placeholder labels only. Country-specific legal and tax wording must be reviewed before production.',
    fields: [
      {
        key: 'registrationNumber',
        label: registrationLabel,
        required: true,
        helpText: 'Used for the onboarding draft check. No real authority lookup is performed yet.',
      },
      {
        key: 'registeredBusinessName',
        label: 'Registered business name',
        required: true,
      },
      {
        key: 'legalForm',
        label: 'Legal form / company type',
        required: false,
      },
      {
        key: 'taxNumber',
        label: country === 'CH' ? 'Tax / UID reference' : 'Tax number',
        required: false,
      },
      {
        key: 'vatNumber',
        label: country === 'CH' ? 'VAT / MWST number' : 'VAT number',
        required: false,
      },
      {
        key: 'registrationCountry',
        label: 'Registration country',
        required: true,
      },
      {
        key: 'registeredAddress',
        label: 'Registered address',
        required: true,
      },
    ] satisfies BusinessDetailsFieldConfig[],
  };
}

export function getAuthorizedPersonFields(countryPack?: TenantOnboardingCountryPack) {
  const country = countryPack?.country ?? 'CH';

  return {
    guidance:
      'If you are a sole proprietor, enter your own information. If this is a company, enter the authorized representative or signatory information.',
    legalReviewNote:
      'Placeholder labels only. Country-specific identity and signatory wording must be reviewed before production.',
    fields: [
      {
        key: 'fullName',
        label: 'Full legal name',
        required: true,
      },
      {
        key: 'email',
        label: 'Contact email',
        required: true,
      },
      {
        key: 'phoneNumber',
        label: 'Contact phone',
        required: true,
      },
      {
        key: 'roleTitle',
        label: country === 'CH' ? 'Role / signatory capacity' : 'Role / title',
        required: false,
        helpText: 'Examples: owner, managing director, authorized representative.',
      },
      {
        key: 'ownershipPercentage',
        label: 'Ownership share',
        required: false,
        helpText: 'Optional placeholder field; future country packs may decide whether this is required.',
      },
    ] satisfies AuthorizedPersonFieldConfig[],
  };
}

export function getBankDetailsFields(countryPack?: TenantOnboardingCountryPack) {
  const currency = countryPack?.currency ?? 'CHF';

  return {
    helperText:
      'This account is used for payout setup during onboarding. No real bank provider validation is performed yet.',
    fields: [
      { key: 'bankName', label: 'Bank name', required: true },
      { key: 'accountHolderName', label: 'Account holder name', required: true },
      {
        key: 'iban',
        label: 'IBAN',
        required: true,
        helpText: 'Basic IBAN format validation only. Country-specific banking rules will come from country packs later.',
      },
      { key: 'currency', label: 'Currency', required: true, helpText: `Default payout currency: ${currency}` },
    ] satisfies OnboardingFieldConfig<BankDetailsFieldKey>[],
  };
}

export function getBillingAddressFields() {
  return {
    helperText:
      'This address is used for invoice and billing records. It can differ from the physical business address.',
    fields: [
      { key: 'useBusinessAddress', label: 'Use business address', required: false },
      { key: 'billingName', label: 'Billing name / company name', required: true },
      { key: 'country', label: 'Country', required: true },
      { key: 'city', label: 'City / canton / region', required: true },
      { key: 'postalCode', label: 'Postal code', required: true },
      { key: 'addressLine1', label: 'Address line 1', required: true },
      { key: 'addressLine2', label: 'Address line 2', required: false },
    ] satisfies OnboardingFieldConfig<BillingAddressFieldKey>[],
  };
}

export function getPlanSelectionCopy(countryPack?: TenantOnboardingCountryPack) {
  const currency = countryPack?.currency ?? 'CHF';

  return {
    title: 'Choose your plan',
    helperText: 'Select the service package you want to take to review.',
    disclaimer:
      'Plan pricing and commission text is configurable placeholder copy only. Country and contract review is required before production use.',
    currency,
  };
}

export function getReviewCopy(countryPack?: TenantOnboardingCountryPack) {
  const country = countryPack?.country ?? 'CH';

  return {
    title: 'Review your application',
    helperText: 'Check your saved information before sending the application for review.',
    submitLabel: 'Submit application',
    missingText: 'Complete the remaining required items before submitting.',
    countryNote:
      country === 'CH'
        ? 'Country-specific legal wording is placeholder copy pending review.'
        : 'Legal wording is placeholder copy pending country review.',
  };
}
