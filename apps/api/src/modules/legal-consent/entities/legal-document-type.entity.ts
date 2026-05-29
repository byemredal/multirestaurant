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

// Platform legal documents that must be published (current version present)
// before a customer can place an order. TR-centric for now; CH has no distinct
// CountryPack legal policy yet, so do not extend per-locale here.
export const REQUIRED_CHECKOUT_DOCUMENT_CODES = [
  'distance_sales_contract',
  'pre_information_form',
] as const satisfies readonly LegalDocumentTypeCode[];

export interface LegalDocumentType {
  id: string;
  code: LegalDocumentTypeCode;
  displayName: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
