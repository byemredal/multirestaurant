export const CONSENT_SUBJECT_TYPES = ['customer', 'tenant', 'anonymous'] as const;
export type ConsentSubjectType = (typeof CONSENT_SUBJECT_TYPES)[number];

export const CONSENT_ACTIONS = ['granted', 'revoked', 'renewed'] as const;
export type ConsentAction = (typeof CONSENT_ACTIONS)[number];

export const CONSENT_CHANNELS = [
  'web',
  'ios',
  'android',
  'tenant-portal',
  'admin-portal',
  'in-store',
  'api',
] as const;
export type ConsentChannel = (typeof CONSENT_CHANNELS)[number];

export interface ConsentEvent {
  id: string;
  subjectType: ConsentSubjectType;
  customerAccountId: string | null;
  tenantAccountId: string | null;
  anonymousIdentifier: string | null;
  documentVersionId: string;
  action: ConsentAction;
  ipAddress: string | null;
  userAgent: string | null;
  channel: ConsentChannel;
  contextRef: string | null;
  acceptedAt: Date;
  createdAt: Date;
}

export interface OrderLegalAcceptance {
  id: string;
  orderId: string;
  distanceSalesContractVersionId: string;
  preInformationFormVersionId: string;
  acceptedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export const MARKETING_CONSENT_CHANNELS = ['email', 'sms', 'push', 'call'] as const;
export type MarketingConsentChannel = (typeof MARKETING_CONSENT_CHANNELS)[number];

export const MARKETING_CONSENT_ACTIONS = ['granted', 'revoked'] as const;
export type MarketingConsentAction = (typeof MARKETING_CONSENT_ACTIONS)[number];

export const MARKETING_CONSENT_SUBJECT_TYPES = ['customer', 'tenant'] as const;
export type MarketingConsentSubjectType = (typeof MARKETING_CONSENT_SUBJECT_TYPES)[number];

export interface MarketingConsent {
  id: string;
  subjectType: MarketingConsentSubjectType;
  customerAccountId: string | null;
  tenantAccountId: string | null;
  channel: MarketingConsentChannel;
  action: MarketingConsentAction;
  source: string | null;
  iysReferenceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface MarketingConsentSnapshot {
  channel: MarketingConsentChannel;
  isGranted: boolean;
  lastChangedAt: Date | null;
  source: string | null;
  iysReferenceId: string | null;
}

export interface StoreTermsAddendum {
  id: string;
  storeId: string;
  parentDocumentVersionId: string;
  title: string;
  body: string;
  locale: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
