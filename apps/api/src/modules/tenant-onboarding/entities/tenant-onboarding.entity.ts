export const tenantOnboardingStepKeys = [
  'business_info',
  'legal_tax_info',
  'owner_contact_info',
  'bank_details',
  'billing_address',
  'membership_plan',
  'operations_info',
  'documents',
  'final_review',
] as const;

export type TenantOnboardingStepKey = (typeof tenantOnboardingStepKeys)[number];
export type TenantOnboardingStepStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked';
export type TenantOnboardingApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'revision_required'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'suspended';
export type TenantDocumentStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'revision_requested'
  | 'expired';
export type TenantApplicationReviewDecision = 'approve' | 'reject' | 'request_revision';
export type TenantDocumentReviewDecision = 'approve' | 'reject' | 'request_revision';
export type AdminNoteScope = 'internal' | 'tenant_visible';

export interface TenantOnboardingApplication {
  id: string;
  tenantAccountId: string;
  status: TenantOnboardingApplicationStatus;
  submittedAt: Date | null;
  reviewStartedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  revisionRequestedAt: Date | null;
  activatedAt: Date | null;
  suspendedAt: Date | null;
  lastSubmittedAt: Date | null;
  currentRevisionNumber: number;
  createdAt: Date;
  updatedAt: Date;
  tokenSalt: string | null;
}

export interface TenantOnboardingStepProgress {
  id: string;
  applicationId: string;
  stepKey: TenantOnboardingStepKey;
  status: TenantOnboardingStepStatus;
  completedAt: Date | null;
  blockedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantOnboardingPhoneVerification {
  id: string;
  applicationId: string;
  phoneNumber: string;
  otpCodeHash: string | null;
  expiresAt: Date | null;
  verifiedAt: Date | null;
  resendCount: number;
  attemptCount: number;
  lastSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type TenantOnboardingLocationProvider = 'locationiq' | 'manual' | 'none';

export interface TenantOnboardingLocationSelection {
  id: string;
  applicationId: string;
  locationLabel: string;
  rawInput: string;
  country: string;
  city: string | null;
  postalCode: string | null;
  street: string | null;
  latitude: number | null;
  longitude: number | null;
  provider: TenantOnboardingLocationProvider | null;
  providerPlaceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantBusinessDetail {
  id: string;
  applicationId: string;
  businessName: string;
  businessType: string;
  registrationNumber: string | null;
  taxNumber: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
  country: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantLegalDetail {
  id: string;
  applicationId: string;
  legalEntityName: string;
  taxId: string | null;
  vatId: string | null;
  registrationCountry: string;
  registeredAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantOwnerContact {
  id: string;
  applicationId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  roleTitle: string | null;
  ownershipPercentage: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantOnboardingBankDetail {
  id: string;
  applicationId: string;
  bankName: string;
  accountHolderName: string;
  iban: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantOnboardingBillingAddress {
  id: string;
  applicationId: string;
  useBusinessAddress: boolean;
  billingName: string;
  country: string;
  city: string;
  postalCode: string;
  addressLine1: string;
  addressLine2: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantOnboardingPlanSelection {
  id: string;
  applicationId: string;
  planKey: string;
  planNameSnapshot: string;
  commissionSummarySnapshot: string;
  currency: string;
  selectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantOperationsProfile {
  id: string;
  applicationId: string;
  primaryCity: string;
  primaryPostalCode: string;
  deliveryModel: string;
  supportsPickup: boolean;
  openingHoursSummary: string | null;
  estimatedGoLiveDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantDocument {
  id: string;
  applicationId: string;
  fileAssetId: string;
  type: string;
  status: TenantDocumentStatus;
  isRequired: boolean;
  version: number;
  isCurrent: boolean;
  uploadedAt: Date;
  reviewedAt: Date | null;
  reviewedByAdminId: string | null;
  rejectionReason: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantDocumentReview {
  id: string;
  documentId: string;
  adminId: string;
  decision: TenantDocumentReviewDecision;
  note: string | null;
  createdAt: Date;
}

export interface TenantOnboardingConsentSnapshot {
  id: string;
  applicationId: string;
  consentKey: string;
  consentLabelSnapshot: string;
  documentCode: string;
  documentVersion: string;
  language: string;
  accepted: boolean;
  acceptedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceDocumentRequirement {
  id: string;
  country: string;
  language: string;
  documentType: string;
  label: string;
  description: string;
  required: boolean;
  acceptedFormats: string[];
  guidanceOnly: boolean;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceConsentDefinition {
  id: string;
  country: string;
  language: string;
  consentKey: string;
  label: string;
  description: string;
  documentCode: string;
  documentVersion: string;
  documentUrl: string | null;
  required: boolean;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantApplicationReview {
  id: string;
  applicationId: string;
  adminId: string;
  decision: TenantApplicationReviewDecision;
  internalNote: string | null;
  tenantVisibleNote: string | null;
  createdAt: Date;
}

export interface AdminNote {
  id: string;
  applicationId: string;
  adminId: string;
  scope: AdminNoteScope;
  body: string;
  createdAt: Date;
}
