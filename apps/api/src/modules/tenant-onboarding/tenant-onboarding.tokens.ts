import { CryptoUtil } from '../../common/utility/crypto-util';
import {
  tenantOnboardingStepKeys,
  TenantOnboardingApplication,
  TenantOnboardingStepKey,
} from './entities/tenant-onboarding.entity';

/**
 * Pure helpers for the stateless (state-token) tenant onboarding flow.
 *
 * Why a separate file: these functions have no DB access and no NestJS
 * dependencies, so they can be unit-tested without booting the module
 * and reused by admin/tenant adjacent code without dragging in the full
 * TenantOnboardingService.
 *
 * The HTTP route prefix `/v2/tenant/onboarding/*` and the encrypted
 * `stateToken` URL parameter are the canonical onboarding interface;
 * the session/`me` endpoints kept on the controller exist only as a
 * legacy fallback for already-authenticated tenants who never had a
 * fresh state token issued.
 */

export type StateTokenPayload = {
  applicationId: string;
  tenantAccountId: string;
  status: string;
  currentStep: string;
  tokenSalt: string;
};

/** Returns the first non-completed step, or `final_review` if everything is done. */
export function currentStepFromSteps(
  steps: Array<{ stepKey: TenantOnboardingStepKey; status: string }>,
): TenantOnboardingStepKey {
  const next = steps.find((step) => step.status !== 'completed');
  return next?.stepKey ?? 'final_review';
}

/** Returns the step immediately after `stepKey`, or `null` at the end of the list. */
export function nextStepAfter(stepKey: TenantOnboardingStepKey): TenantOnboardingStepKey | null {
  const index = tenantOnboardingStepKeys.indexOf(stepKey);
  return tenantOnboardingStepKeys[index + 1] ?? null;
}

/**
 * Maps a backend step key to the URL slug used by the tenant frontend.
 * Kept here so the frontend `onboarding-routing.ts` and this server-side
 * helper stay easy to keep in sync.
 */
export function workflowSlugFromBackendStep(stepKey: TenantOnboardingStepKey): string {
  const workflowSlugs: Record<TenantOnboardingStepKey, string> = {
    business_info: 'location',
    legal_tax_info: 'business-details',
    owner_contact_info: 'authorized-person',
    bank_details: 'bank-details',
    billing_address: 'billing-address',
    membership_plan: 'plan-selection',
    operations_info: 'operations',
    documents: 'verification',
    final_review: 'review',
  };

  return workflowSlugs[stepKey];
}

/**
 * Builds a fresh encrypted state token for the given application + current step.
 * Returns an empty string when the application has no `tokenSalt` (i.e. it has
 * already reached a terminal status and the salt was wiped intentionally).
 */
export function buildStateToken(
  application: TenantOnboardingApplication,
  currentStep: string,
): string {
  if (!application.tokenSalt) {
    return '';
  }

  return CryptoUtil.encryptStateToken({
    applicationId: application.id,
    tenantAccountId: application.tenantAccountId,
    status: application.status,
    currentStep,
    tokenSalt: application.tokenSalt,
    issuedAt: new Date().toISOString(),
  });
}

/**
 * Narrows a decrypted token payload to a typed `StateTokenPayload`,
 * throwing if any required field is missing or non-string.
 */
export function validateStateTokenPayload(payload: Record<string, unknown>): StateTokenPayload {
  if (
    typeof payload.applicationId !== 'string' ||
    typeof payload.tenantAccountId !== 'string' ||
    typeof payload.status !== 'string' ||
    typeof payload.currentStep !== 'string' ||
    typeof payload.tokenSalt !== 'string'
  ) {
    throw new Error('Invalid state token payload.');
  }
  return {
    applicationId: payload.applicationId,
    tenantAccountId: payload.tenantAccountId,
    status: payload.status,
    currentStep: payload.currentStep,
    tokenSalt: payload.tokenSalt,
  };
}
