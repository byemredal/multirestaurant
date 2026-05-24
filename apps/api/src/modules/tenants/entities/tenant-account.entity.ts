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

export interface TenantAccount {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  companyName: string;
  companyAddress: string;
  tenantType: TenantType;
  deliveryModel: DeliveryModel;
  verificationStatus: TenantVerificationStatus;
  onboardingStatus: TenantOnboardingStatus;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
