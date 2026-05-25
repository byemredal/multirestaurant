/**
 * TenantBusiness carries the company / verification / onboarding profile —
 * everything that is NOT login identity. One row per TenantAccount (1:1).
 *
 * Centralizing these enums here means the type / delivery-model / status
 * vocabulary travels with the business profile, not with the identity row.
 */
export enum TenantType {
  FOOD_SERVICE = 'food_service',
  RETAIL = 'retail',
  OTHER = 'other',
}

export enum DeliveryModel {
  OWN_FLEET = 'own_fleet',
  PLATFORM_FLEET = 'platform_fleet',
  HYBRID = 'hybrid',
}

export type TenantVerificationStatus = 'pending' | 'verified' | 'rejected';

export type TenantOnboardingStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'revision_required'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'suspended';

export interface TenantBusiness {
  id: string;
  tenantAccountId: string;
  companyName: string;
  companyAddress: string;
  tenantType: TenantType;
  deliveryModel: DeliveryModel;
  verificationStatus: TenantVerificationStatus;
  onboardingStatus: TenantOnboardingStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Aggregate view used by code that previously consumed a single "tenant"
 * object. Keeps the identity / business halves separate at the type level
 * while still letting callers pass a combined value through public APIs.
 */
export interface TenantAccountWithBusiness {
  account: import('./tenant-account.entity').TenantAccount;
  business: TenantBusiness;
}
