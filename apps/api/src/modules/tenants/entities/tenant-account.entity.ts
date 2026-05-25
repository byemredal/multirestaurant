/**
 * TenantAccount carries LOGIN IDENTITY only. The company / verification /
 * onboarding columns moved to TenantBusiness in MR-ARCH-02.
 *
 * The TenantType / DeliveryModel / TenantVerificationStatus / TenantOnboardingStatus
 * enums and types live in `tenant-business.entity.ts` because they describe
 * the business profile, not the identity row.
 */
export interface TenantAccount {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
