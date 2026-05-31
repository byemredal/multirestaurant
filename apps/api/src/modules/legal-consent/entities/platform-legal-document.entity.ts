import { LegalDocumentTypeCode } from './legal-document-type.entity';

export const PLATFORM_LEGAL_DOCUMENT_AUDIENCES = ['customer', 'tenant', 'all'] as const;
export type PlatformLegalDocumentAudience = (typeof PLATFORM_LEGAL_DOCUMENT_AUDIENCES)[number];

export const PLATFORM_LEGAL_DOCUMENT_BODY_FORMATS = [
  'markdown',
  'html',
  'plain_text',
] as const;
export type PlatformLegalDocumentBodyFormat =
  (typeof PLATFORM_LEGAL_DOCUMENT_BODY_FORMATS)[number];

export interface PlatformLegalDocument {
  id: string;
  typeId: string;
  typeCode: LegalDocumentTypeCode | null;
  code: string;
  /**
   * ISO-3166-1 alpha-2 scope for this document. Two countries may share the
   * same `typeCode` (e.g. both have a `distance_sales_contract`) while being
   * distinct legal documents with independent version histories. Nullable for
   * legacy rows created before MR-CUSTOMER-LEGAL-COUNTRY-SCOPING-01 / on a
   * pre-setup DB; the checkout gate treats a null scope as not-ready.
   */
  countryCode: string | null;
  audience: PlatformLegalDocumentAudience;
  isRequired: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformLegalDocumentVersion {
  id: string;
  documentId: string;
  versionLabel: string;
  locale: string;
  title: string;
  body: string;
  bodyFormat: PlatformLegalDocumentBodyFormat;
  contentHashSha256: string;
  effectiveFrom: Date;
  publishedAt: Date;
  supersededAt: Date | null;
  createdByAdminId: string | null;
  createdAt: Date;
}

export interface PlatformLegalDocumentWithCurrentVersion extends PlatformLegalDocument {
  currentVersion: PlatformLegalDocumentVersion | null;
}
