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
  const placeholderNote = 'Taslak yönlendirme metnidir; gereksinimler yayına alınmadan önce incelenmelidir.';

  return {
    country,
    language,
    documents: [
      {
        type: 'commercial_register_extract',
        label: 'Ticaret sicili özeti veya işletme kayıt belgesi',
        required: false,
        description: placeholderNote,
        acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
        guidanceOnly: true,
      },
      {
        type: 'identity_document',
        label: 'Yetkili temsilci kimlik belgesi',
        required: false,
        description: placeholderNote,
        acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
        guidanceOnly: true,
      },
      {
        type: 'bank_statement',
        label: 'Banka hesabı kanıt belgesi',
        required: false,
        description: placeholderNote,
        acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
        guidanceOnly: true,
      },
    ],
    documentValidationPolicy: {
      mode: 'minimum_current_required_document',
      minimumRequiredDocuments: 1,
      note: 'Mevcut sistem kuralı: göndermeden önce en az bir güncel zorunlu belge yükleyin.',
    },
    consents: [
      {
        consentKey: 'privacy_acknowledgement',
        label: 'Bu iş ortağı başvurusuna ilişkin gizlilik bilgilendirmesini okuduğumu onaylıyorum.',
        description: placeholderNote,
        documentCode: 'partner_privacy_placeholder',
        documentVersion: 'placeholder-v1',
        required: true,
        language,
      },
      {
        consentKey: 'partner_terms_acknowledgement',
        label: 'Başvuru sırasında sunulan iş ortağı koşulları taslağını okuduğumu onaylıyorum.',
        description: placeholderNote,
        documentCode: 'partner_terms_placeholder',
        documentVersion: 'placeholder-v1',
        required: true,
        language,
      },
    ],
  };
}
