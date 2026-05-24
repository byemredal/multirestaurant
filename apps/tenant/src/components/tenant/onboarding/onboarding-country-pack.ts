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
