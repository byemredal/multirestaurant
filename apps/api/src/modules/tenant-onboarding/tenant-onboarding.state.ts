import { BadRequestException } from '@nestjs/common';
import { TenantOnboardingApplicationStatus } from './entities/tenant-onboarding.entity';

/**
 * Single source of truth for onboarding-application status transitions.
 *
 * Every status change — tenant-driven (submit / resubmit) and admin-driven
 * (review decisions, activation, suspension) — is validated against this
 * map so the application can never reach an inconsistent state.
 *
 * Intentionally distinct from:
 *   - the coarser tenant routing status (`toTenantStatus`)
 *   - tenant-account compliance flags (`isActive` / `verificationStatus`)
 *
 * Extracted from tenant-onboarding.service.ts so admin-tenant-reviews and
 * any future onboarding-adjacent module can validate transitions without
 * dragging in the full TenantOnboardingService.
 */
export const ONBOARDING_STATUS_TRANSITIONS: Record<
  TenantOnboardingApplicationStatus,
  TenantOnboardingApplicationStatus[]
> = {
  draft: ['submitted'],
  submitted: ['under_review', 'revision_required', 'approved', 'rejected'],
  under_review: ['revision_required', 'approved', 'rejected'],
  revision_required: ['submitted', 'rejected'],
  approved: ['active', 'under_review', 'suspended'],
  rejected: ['under_review'],
  active: ['suspended'],
  suspended: ['active', 'under_review'],
};

/**
 * Throws `BadRequestException` when the requested transition is not in the
 * allowed list for the current status. Pure / side-effect free.
 */
export function assertOnboardingTransition(
  currentStatus: TenantOnboardingApplicationStatus,
  targetStatus: TenantOnboardingApplicationStatus,
): void {
  if (!ONBOARDING_STATUS_TRANSITIONS[currentStatus].includes(targetStatus)) {
    throw new BadRequestException(
      `Application cannot transition from ${currentStatus} to ${targetStatus}.`,
    );
  }
}
