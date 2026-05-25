import { TenantOnboardingStatus } from './entities/tenant-business.entity';

/**
 * The coarse, routing-relevant tenant lifecycle state exposed to the tenant
 * frontend. The frontend routes purely on this value — never on the raw
 * 8-value `onboardingStatus`, which is kept only for messaging detail.
 */
export type TenantStatus = 'ONBOARDING' | 'PENDING_APPROVAL' | 'ACTIVE';

export function toTenantStatus(
  onboardingStatus: TenantOnboardingStatus,
): TenantStatus {
  switch (onboardingStatus) {
    case 'draft':
    case 'revision_required':
      return 'ONBOARDING';
    case 'submitted':
    case 'under_review':
    case 'rejected':
    case 'suspended':
      return 'PENDING_APPROVAL';
    case 'approved':
    case 'active':
      return 'ACTIVE';
    default:
      return 'ONBOARDING';
  }
}
