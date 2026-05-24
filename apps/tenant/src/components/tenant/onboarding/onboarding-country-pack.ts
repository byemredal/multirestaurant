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
