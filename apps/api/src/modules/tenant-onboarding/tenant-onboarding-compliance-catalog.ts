export type TenantOnboardingDocumentRequirement = {
  type: string;
  label: string;
  required: boolean;
  description: string;
  acceptedFormats: string[];
  guidanceOnly: boolean;
};

export type TenantOnboardingConsentDefinition = {
  consentKey: string;
  label: string;
  description: string;
  documentCode: string;
  documentVersion: string;
  required: boolean;
  language: string;
};

export type TenantOnboardingComplianceCatalog = {
  country: string;
  language: string;
  documents: TenantOnboardingDocumentRequirement[];
  documentValidationPolicy: {
    mode: 'minimum_current_required_document';
    minimumRequiredDocuments: number;
    note: string;
  };
  consents: TenantOnboardingConsentDefinition[];
};

export function getTenantOnboardingComplianceCatalog(
  country = 'CH',
  language = 'de-CH',
): TenantOnboardingComplianceCatalog {
  const placeholderNote = 'Placeholder guidance; requirements must be reviewed before production.';

  return {
    country,
    language,
    documents: [
      {
        type: 'commercial_register_extract',
        label: 'Commercial register extract or business registration document',
        required: false,
        description: placeholderNote,
        acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
        guidanceOnly: true,
      },
      {
        type: 'identity_document',
        label: 'Authorized representative identification document',
        required: false,
        description: placeholderNote,
        acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
        guidanceOnly: true,
      },
      {
        type: 'bank_statement',
        label: 'Bank account evidence',
        required: false,
        description: placeholderNote,
        acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
        guidanceOnly: true,
      },
    ],
    documentValidationPolicy: {
      mode: 'minimum_current_required_document',
      minimumRequiredDocuments: 1,
      note: 'Current backend rule: upload at least one current required document before submission.',
    },
    consents: [
      {
        consentKey: 'privacy_acknowledgement',
        label: 'I acknowledge the privacy information for this partner application.',
        description: placeholderNote,
        documentCode: 'partner_privacy_placeholder',
        documentVersion: 'placeholder-v1',
        required: true,
        language,
      },
      {
        consentKey: 'partner_terms_acknowledgement',
        label: 'I acknowledge the partner terms placeholder presented for onboarding.',
        description: placeholderNote,
        documentCode: 'partner_terms_placeholder',
        documentVersion: 'placeholder-v1',
        required: true,
        language,
      },
    ],
  };
}
