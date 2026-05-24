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
