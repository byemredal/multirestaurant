export const LEGAL_DOCUMENT_TYPE_CODES = [
  'terms_of_service',
  'privacy_policy',
  'kvkk_disclosure',
  'cookie_policy',
  'distance_sales_contract',
  'pre_information_form',
  'tenant_service_agreement',
  'commission_tariff',
] as const;

export type LegalDocumentTypeCode = (typeof LEGAL_DOCUMENT_TYPE_CODES)[number];

export interface LegalDocumentType {
  id: string;
  code: LegalDocumentTypeCode;
  displayName: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
