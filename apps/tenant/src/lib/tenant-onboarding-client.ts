import type { StoredTenantSession } from '@/lib/storage/tenant-session';
import { apiBaseUrl, tenantRequest as request } from '@/lib/http/tenant-http';

type TenantPayload = {
  accessToken: string;
  csrfToken: string;
  tenant: StoredTenantSession['tenant'];
};

type StartOnboardingInput = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  companyName: string;
  companyAddress: string;
  tenantType: 'food_service' | 'retail' | 'other';
  deliveryModel: 'own_fleet' | 'platform_fleet' | 'hybrid';
};

type OnboardingPayload = TenantPayload & { continuationToken: string };

export type OnboardingSession = StoredTenantSession & { continuationToken: string };

export type StartTenantOnboardingResult = {
  stateToken: string;
  status: TenantOnboardingApplicationStatus;
  currentStepKey: TenantOnboardingStepKey;
  nextStepKey: TenantOnboardingStepKey | null;
};

export async function startTenantOnboarding(
  input: StartOnboardingInput,
): Promise<StartTenantOnboardingResult> {
  const response = await fetch(`${apiBaseUrl}/v2/tenant/onboarding/start`, {
    body: JSON.stringify(input),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) {
    let message = 'tenant_onboarding_start_failed';
    try {
      const payload = await response.json();
      if (typeof payload?.message === 'string' && payload.message) {
        message = payload.message;
      } else if (Array.isArray(payload?.message) && payload.message.length > 0) {
        message = payload.message.join(', ');
      }
    } catch {
      // Keep the status-based fallback when the body is not JSON.
    }
    throw new Error(message);
  }

  return (await response.json()) as StartTenantOnboardingResult;
}

/** Exchanges an onboarding continuation token for an active session. */
export async function resumeTenantOnboarding(
  token: string,
): Promise<OnboardingSession> {
  const response = await fetch(`${apiBaseUrl}/tenants/onboarding/resume`, {
    body: JSON.stringify({ token }),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('tenant_onboarding_resume_failed');
  }

  const payload = (await response.json()) as OnboardingPayload;
  return {
    accessToken: payload.accessToken,
    csrfToken: payload.csrfToken,
    continuationToken: payload.continuationToken,
    tenant: payload.tenant,
  };
}

export type TenantOnboardingStepKey =
  | 'business_info'
  | 'legal_tax_info'
  | 'owner_contact_info'
  | 'operations_info'
  | 'documents'
  | 'final_review';

export type TenantOnboardingStepStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'needs_revision';

export type TenantOnboardingApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'revision_required'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'suspended';

export type TenantOnboardingDocument = {
  id: string;
  applicationId: string;
  fileAssetId: string;
  type: string;
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested' | 'expired';
  isRequired: boolean;
  version: number;
  isCurrent: boolean;
  uploadedAt: string;
  reviewedAt: string | null;
  reviewedByAdminId: string | null;
  rejectionReason: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TenantOnboardingWorkspace = {
  application: {
    id: string;
    tenantAccountId: string;
    status: TenantOnboardingApplicationStatus;
    submittedAt: string | null;
    reviewStartedAt: string | null;
    approvedAt: string | null;
    rejectedAt: string | null;
    revisionRequestedAt: string | null;
    activatedAt: string | null;
    suspendedAt: string | null;
    lastSubmittedAt: string | null;
    currentRevisionNumber: number;
    createdAt: string;
    updatedAt: string;
    stateToken: string;
  };
  phoneVerification?: {
    verified: boolean;
    phoneNumber: string | null;
  };
  stateToken: string;
  studioAccessAllowed: boolean;
  editable: boolean;
  revisionRequests: string[];
  canSubmitForReview: boolean;
  submitAction: 'submit' | 'resubmit';
  steps: Array<{
    stepKey: TenantOnboardingStepKey;
    status: TenantOnboardingStepStatus;
    completedAt: string | null;
    updatedAt: string;
    blockedReason: string | null;
    locked: boolean;
    data: unknown;
  }>;
};

export type TenantOnboardingSessionStepKey =
  | 'phone-verification'
  | 'otp'
  | 'welcome'
  | 'location'
  | 'address'
  | 'business-details'
  | 'authorized-person'
  | 'bank-details'
  | 'billing-address'
  | 'plan-selection'
  | 'verification'
  | 'review'
  | 'submitted';

export type TenantOnboardingCountryPack = {
  country: string;
  language: string;
  currency: string;
};

export type TenantOnboardingResolvedSession = {
  stateToken: string;
  applicationId: string;
  status: TenantOnboardingApplicationStatus;
  requestedStep: TenantOnboardingSessionStepKey | string | null;
  currentStep: TenantOnboardingSessionStepKey;
  redirectStep: TenantOnboardingSessionStepKey | null;
  allowedSteps: TenantOnboardingSessionStepKey[];
  completedSteps: TenantOnboardingSessionStepKey[];
  countryPack: TenantOnboardingCountryPack;
  stepData: unknown;
  workspace: TenantOnboardingWorkspace;
};

export type TenantBusinessInfoInput = {
  businessName?: string;
  businessType?: string;
  registrationNumber?: string | null;
  taxNumber?: string | null;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  postalCode?: string;
  country?: string;
};

export type TenantLegalTaxInfoInput = {
  legalEntityName?: string;
  taxId?: string | null;
  vatId?: string | null;
  registrationCountry?: string;
  registeredAddress?: string;
};

export type TenantOwnerContactInfoInput = {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  roleTitle?: string | null;
  ownershipPercentage?: number | null;
};

export type TenantOperationsInfoInput = {
  primaryCity?: string;
  primaryPostalCode?: string;
  deliveryModel?: string;
  supportsPickup?: boolean;
  openingHoursSummary?: string | null;
  estimatedGoLiveDate?: string | null;
};

export type UploadTenantOnboardingDocumentInput = {
  type: string;
  isRequired?: boolean;
  expiresAt?: string;
};

/* -----------------------------------------------------------------------
 * LEGACY: authenticated-session ("me") onboarding helpers.
 *
 * The CANONICAL onboarding flow is the state-token flow — the URL carries
 * an encrypted `stateToken` and the matching `*ByStateToken` helpers below
 * are the preferred path. These session-bearing variants are kept only as
 * a fallback for already-authenticated tenants who reach onboarding pages
 * without a fresh state token (e.g. legacy bookmarks or the waiting
 * screen polling for revision notes). Do not introduce new call sites.
 *
 * Remove when:
 *  1. `useTenantOnboardingWorkspace` stops falling back to session calls.
 *  2. `TenantWaitingScreen` switches to `*ByStateToken` for revision-note
 *     fetching.
 * -------------------------------------------------------------------- */

/** @deprecated Use `getTenantOnboardingWorkspaceByStateToken` instead. */
export function getTenantOnboardingWorkspace(session: StoredTenantSession) {
  return request<TenantOnboardingWorkspace>('/v2/tenant/onboarding/me', session);
}

export async function getTenantOnboardingWorkspaceByStateToken(stateToken: string) {
  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/workspace`,
    { credentials: 'include' },
  );

  if (!response.ok) {
    throw new Error(`tenant_onboarding_workspace_failed_${response.status}`);
  }

  return (await response.json()) as TenantOnboardingWorkspace;
}

export async function resolveTenantOnboardingSession(
  stateToken: string,
  requestedStep?: string,
) {
  const params = new URLSearchParams();
  if (requestedStep?.trim()) {
    params.set('step', requestedStep.trim());
  }
  const query = params.toString();
  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/session${query ? `?${query}` : ''}`,
    { credentials: 'include' },
  );

  if (!response.ok) {
    throw new Error(`tenant_onboarding_session_failed_${response.status}`);
  }

  return (await response.json()) as TenantOnboardingResolvedSession;
}

export type TenantPhoneVerificationChallenge = {
  maskedPhoneNumber: string;
  expiresAt: string;
  delivery: 'email_fallback' | string;
  debugCode?: string;
};

export async function sendTenantOnboardingPhoneVerification(
  stateToken: string,
  phoneNumber: string,
) {
  const response = await fetch(`${apiBaseUrl}/v2/tenant/onboarding/phone-verification/send`, {
    body: JSON.stringify({ stateToken, phoneNumber }),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) {
    let message = `tenant_onboarding_phone_send_failed_${response.status}`;
    try {
      const payload = await response.json();
      if (Array.isArray(payload?.message) && payload.message.length > 0) {
        message = payload.message.join(', ');
      } else if (typeof payload?.message === 'string' && payload.message.length > 0) {
        message = payload.message;
      }
    } catch {
      // Keep fallback.
    }
    throw new Error(message);
  }

  return (await response.json()) as TenantPhoneVerificationChallenge;
}

export async function verifyTenantOnboardingPhone(stateToken: string, code: string) {
  const response = await fetch(`${apiBaseUrl}/v2/tenant/onboarding/phone-verification/verify`, {
    body: JSON.stringify({ stateToken, code }),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) {
    let message = `tenant_onboarding_phone_verify_failed_${response.status}`;
    try {
      const payload = await response.json();
      if (Array.isArray(payload?.message) && payload.message.length > 0) {
        message = payload.message.join(', ');
      } else if (typeof payload?.message === 'string' && payload.message.length > 0) {
        message = payload.message;
      }
    } catch {
      // Keep the status-based fallback.
    }
    throw new Error(message);
  }

  return (await response.json()) as { verified: true; workspace: TenantOnboardingWorkspace };
}

export async function emailTenantOnboardingContinueLink(stateToken: string) {
  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/continue-link/email`,
    {
      credentials: 'include',
      method: 'POST',
    },
  );

  if (!response.ok) {
    throw new Error(`tenant_onboarding_continue_link_email_failed_${response.status}`);
  }

  return (await response.json()) as { sent: boolean };
}

export type TenantOnboardingStepDraftResponse = {
  stepKey: TenantOnboardingStepKey;
  status: TenantOnboardingStepStatus;
  nextStepKey: TenantOnboardingStepKey | null;
  stateToken: string;
  data: unknown;
};

/** @deprecated Use `patchTenantOnboardingStepByStateToken` instead. */
export function patchTenantOnboardingStep(
  session: StoredTenantSession,
  step: Exclude<TenantOnboardingStepKey, 'documents' | 'final_review'>,
  input:
    | TenantBusinessInfoInput
    | TenantLegalTaxInfoInput
    | TenantOwnerContactInfoInput
    | TenantOperationsInfoInput,
) {
  return request<TenantOnboardingStepDraftResponse>(
    `/v2/tenant/onboarding/me/${step}`,
    session,
    {
      body: JSON.stringify(input),
      method: 'PATCH',
    },
  );
}

export async function patchTenantOnboardingStepByStateToken(
  stateToken: string,
  step: Exclude<TenantOnboardingStepKey, 'documents' | 'final_review'>,
  input:
    | TenantBusinessInfoInput
    | TenantLegalTaxInfoInput
    | TenantOwnerContactInfoInput
    | TenantOperationsInfoInput,
) {
  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/steps/${step}`,
    {
      body: JSON.stringify(input),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    },
  );

  if (!response.ok) {
    let message = `tenant_onboarding_step_failed_${response.status}`;
    try {
      const payload = await response.json();
      if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
        message = payload.errors.join(', ');
      } else if (Array.isArray(payload?.message) && payload.message.length > 0) {
        message = payload.message.join(', ');
      } else if (typeof payload?.message === 'string' && payload.message.length > 0) {
        message = payload.message;
      }
    } catch {
      // Keep the status-based fallback when the body is not JSON.
    }
    throw new Error(message);
  }

  return (await response.json()) as TenantOnboardingStepDraftResponse;
}

/** @deprecated Use `completeTenantOnboardingStepByStateToken` instead. */
export function completeTenantOnboardingStep(
  session: StoredTenantSession,
  step: TenantOnboardingStepKey,
) {
  return request<{ stepKey: TenantOnboardingStepKey; status: TenantOnboardingStepStatus; workspace: TenantOnboardingWorkspace }>(
    `/v2/tenant/onboarding/me/${step}/complete`,
    session,
    {
      method: 'POST',
    },
  );
}

export async function completeTenantOnboardingStepByStateToken(
  stateToken: string,
  step: TenantOnboardingStepKey,
) {
  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/steps/${step}/complete`,
    {
      credentials: 'include',
      method: 'POST',
    },
  );

  if (!response.ok) {
    throw new Error(`tenant_onboarding_step_complete_failed_${response.status}`);
  }

  return (await response.json()) as Omit<TenantOnboardingStepDraftResponse, 'data'> & {
    workspace?: TenantOnboardingWorkspace;
  };
}

/** @deprecated Use `uploadTenantOnboardingDocumentByStateToken` instead. */
export function uploadTenantOnboardingDocument(
  session: StoredTenantSession,
  file: File,
  input: UploadTenantOnboardingDocumentInput,
) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', input.type);
  formData.append('isRequired', String(input.isRequired ?? true));

  if (input.expiresAt?.trim()) {
    formData.append('expiresAt', input.expiresAt);
  }

  return request<{ document: TenantOnboardingDocument; workspace: TenantOnboardingWorkspace }>(
    '/v2/tenant/onboarding/me/documents/upload',
    session,
    {
      body: formData,
      headers: {},
      method: 'POST',
    },
  );
}

export async function uploadTenantOnboardingDocumentByStateToken(
  stateToken: string,
  file: File,
  input: UploadTenantOnboardingDocumentInput,
) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', input.type);
  formData.append('isRequired', String(input.isRequired ?? true));

  if (input.expiresAt?.trim()) {
    formData.append('expiresAt', input.expiresAt);
  }

  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/documents/upload`,
    {
      body: formData,
      credentials: 'include',
      method: 'POST',
    },
  );

  if (!response.ok) {
    throw new Error(`tenant_onboarding_document_upload_failed_${response.status}`);
  }

  return (await response.json()) as {
    document: TenantOnboardingDocument;
    workspace: TenantOnboardingWorkspace;
  };
}

/** @deprecated Use `submitTenantOnboardingByStateToken` instead. */
export function submitTenantOnboarding(session: StoredTenantSession) {
  return request<{ application: TenantOnboardingWorkspace['application']; workspace: TenantOnboardingWorkspace }>(
    '/v2/tenant/onboarding/me/submit',
    session,
    {
      method: 'POST',
    },
  );
}

export async function submitTenantOnboardingByStateToken(stateToken: string) {
  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/submit`,
    {
      credentials: 'include',
      method: 'POST',
    },
  );

  if (!response.ok) {
    let message = `tenant_onboarding_submit_failed_${response.status}`;
    try {
      const payload = await response.json();
      if (Array.isArray(payload?.message) && payload.message.length > 0) {
        message = payload.message.join(', ');
      } else if (typeof payload?.message === 'string' && payload.message.length > 0) {
        message = payload.message;
      }
    } catch {
      // Keep fallback.
    }
    throw new Error(message);
  }

  return (await response.json()) as {
    application: TenantOnboardingWorkspace['application'];
    workspace: TenantOnboardingWorkspace;
  };
}
