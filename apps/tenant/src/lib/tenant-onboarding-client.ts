import type { StoredTenantSession } from '@/lib/storage/tenant-session';
import { apiBaseUrl, tenantRequest as request } from '@/lib/http/tenant-http';


/*
  * Onboarding sürecinde tenant ile ilgili bilgileri taşıyan bir yapıdır.
  * Bu payload, onboarding işlemleri sırasında tenant'ın kimlik doğrulaması ve yetkilendirmesi için kullanılır.
  * Ayrıca, onboarding sürecinin farklı adımlarında tenant'a özel bilgilerin taşınmasını sağlar.
  * Örneğin, onboarding sürecinin belirli bir adımında tenant'ın iletişim bilgileri veya işletme detayları gibi bilgilerin bu payload üzerinden iletilmesi mümkün olabilir.
*/
type TenantPayload = {
  accessToken: string;
  csrfToken: string;
  tenant: StoredTenantSession['tenant'];
};

/*
  * TenantOnboardingClient, tenant onboarding sürecinde kullanılan API çağrılarını içeren bir modüldür.
  * Bu modül, tenant onboarding sürecinin farklı adımlarında gerekli olan API çağrılarını yaparak, tenant'ın onboarding sürecini yönetir.
*/
export type StartTenantOnboardingAddressMeta = {
  label: string;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  provider: 'locationiq' | 'manual' | 'none';
  providerPlaceId?: string | null;
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
  /** Required: initial Terms + Privacy checkbox from the partner form. */
  acceptedTerms: boolean;
  /** BCP-47 locale captured at the moment of acceptance. */
  acceptedLocale?: string;
  /**
   * Normalized parts of the autocomplete suggestion. Optional so a free-text
   * submission still works; backend persists this into the location-selection
   * row with provider attribution.
   */
  addressMeta?: StartTenantOnboardingAddressMeta;
};

// Onboarding sürecinin farklı adımlarında tenant'ın durumunu ve gerekli bilgileri içeren tipler tanımlanır.
type OnboardingPayload = TenantPayload & { continuationToken: string };

/**
 * OnboardingSession tipi, tenant'ın onboarding sürecinde geçici olarak saklanan bilgileri içerir.
 * Bu bilgiler, tenant'ın onboarding sürecinde ilerlemesini sağlamak için kullanılır.
 */
export type OnboardingSession = StoredTenantSession & { continuationToken: string };

// StartTenantOnboardingResult tipi, onboarding sürecinin başlangıcında dönen sonucu temsil eder.
export type StartTenantOnboardingResult = {
  stateToken: string;
  status: TenantOnboardingApplicationStatus;
  currentStepKey: TenantOnboardingStepKey;
  nextStepKey: TenantOnboardingStepKey | null;
};

/**
 * startTenantOnboarding, tenant onboarding sürecinin başlangıcında kullanılan bir fonksiyondur.
 * Bu fonksiyon, tenant'ın onboarding sürecini başlatmak için gerekli olan API çağrısını yapar.
 * Fonksiyon, onboarding sürecinin başlangıcında tenant'ın sağladığı bilgileri alır ve API'ye gönderir.
 */
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

/**
 * resumeTenantOnboarding, tenant onboarding sürecini devam ettirmek için kullanılan bir fonksiyondur.
 * Bu fonksiyon, tenant'ın onboarding sürecini devam ettirmek için gerekli olan API çağrısını yapar.
 */
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

// TenantOnboardingStepKey, tenant onboarding sürecindeki adımları temsil eden bir türdür.
export type TenantOnboardingStepKey =
  | 'business_info' // işletme bilgileri
  | 'legal_tax_info' // yasal ve vergi bilgileri
  | 'owner_contact_info' // sahibi iletişim bilgileri
  | 'bank_details' // banka bilgileri
  | 'billing_address' // fatura adresi
  | 'membership_plan' // üyelik planı
  | 'operations_info' // operasyon bilgileri
  | 'documents' // belgeler
  | 'final_review'; // son inceleme

// TenantOnboardingStepStatus, tenant onboarding sürecindeki adımların durumunu temsil eden bir türdür.
export type TenantOnboardingStepStatus =
  | 'not_started' // başlatılmadı
  | 'in_progress' // devam ediyor
  | 'completed' // tamamlandı
  | 'needs_revision'; // düzeltme gerekiyor

// TenantOnboardingApplicationStatus, tenant onboarding başvurusunun durumunu temsil eden bir türdür.
export type TenantOnboardingApplicationStatus =
  | 'draft' // taslak
  | 'submitted' // gönderildi
  | 'under_review' // inceleme altında
  | 'revision_required' // düzeltme gerekli
  | 'approved' // onaylandı
  | 'rejected' // reddedildi
  | 'active' // etkin
  | 'suspended'; // askıya alındı

// TenantOnboardingDocumentStatus, tenant onboarding sürecindeki belgelerin durumunu temsil eden bir türdür.
export type TenantOnboardingDocument = {
  id: string;
  applicationId: string;
  fileAssetId: string;
  type: string;
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested' | 'expired'; // bekliyor, onaylandı, reddedildi, düzeltme istendi, süresi dolmuş
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

// TenantOnboardingWorkspace, tenant onboarding sürecinde tenant'a özel bilgilerin taşınmasını sağlayan bir yapıdır.
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
    pending?: boolean;
    phoneNumber: string | null;
    maskedPhoneNumber?: string | null;
    expiresAt?: string | null;
    verifiedAt?: string | null;
    lastSentAt?: string | null;
    resendCount?: number;
    attemptCount?: number;
  };
  locationSelection?: TenantLocationSelection | null;
  stateToken: string;
  studioAccessAllowed: boolean;
  editable: boolean;
  revisionRequests: string[];
  canSubmitForReview: boolean;
  submitAction: 'submit' | 'resubmit';
  passwordSetup?: TenantOnboardingPasswordSetupSummary | null;
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

// Public-safe summary of the post-approval password setup link delivery.
// Mirrors the backend `getPublicSafeSummaryForTenant` shape. Never carries
// the raw token, hash, or full e-mail address — only enough for the
// approved screen to honestly say whether an e-mail went out.
export type TenantOnboardingPasswordSetupSummary = {
  deliveryStatus: 'queued' | 'sent' | 'failed' | 'unavailable' | null;
  sentToEmailMasked: string | null;
  expiresAt: string | null;
  tokenIssued: boolean;
};

// TenantLocationSelection, tenant onboarding sürecinde tenant'ın konum seçimini temsil eden bir yapıdır.
export type TenantLocationSelection = {
  locationLabel: string;
  rawInput: string;
  country: string;
  city: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  updatedAt?: string;
};

// TenantOnboardingSessionStepKey, tenant onboarding sürecindeki adımları temsil eden bir türdür.
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
  | 'operations'
  | 'verification'
  | 'review'
  | 'submitted';

// TenantOnboardingCountryPack, tenant onboarding sürecinde tenant'ın ülke, dil ve para birimi bilgilerini temsil eden bir yapıdır.
export type TenantOnboardingCountryPack = {
  country: string;
  language: string;
  currency: string;
};

// TenantOnboardingDocumentRequirement, tenant onboarding sürecinde tenant'ın sağlaması gereken belge gereksinimlerini temsil eden bir yapıdır.
export type TenantOnboardingDocumentRequirement = {
  type: string;
  label: string;
  required: boolean;
  description: string;
  acceptedFormats: string[];
  guidanceOnly: boolean;
};

// TenantOnboardingConsentDefinition, tenant onboarding sürecinde tenant'ın kabul etmesi gereken onay tanımlarını temsil eden bir yapıdır.
export type TenantOnboardingConsentDefinition = {
  consentKey: string;
  label: string;
  description: string;
  documentCode: string;
  documentVersion: string;
  documentUrl: string | null;
  required: boolean;
  language: string;
  /** Placeholder document title from the active CountryPack legalDocuments. */
  documentTitle?: string | null;
  /** Placeholder document body — rendered inline in the review step. */
  documentBody?: string | null;
};

// TenantOnboardingConsentStatus, tenant onboarding sürecinde tenant'ın onay durumunu temsil eden bir yapıdır.
export type TenantOnboardingConsentStatus = TenantOnboardingConsentDefinition & {
  accepted: boolean;
  acceptedAt: string | null;
  reacceptanceRequired: boolean;
  previouslyAcceptedVersion: string | null;
};

// TenantOnboardingComplianceResult, tenant onboarding sürecinde tenant'ın uyumluluk durumunu temsil eden bir yapıdır.
// Bu yapı, tenant'ın onboarding sürecindeki mevcut durumunu, eksik belgeleri, gerekli onayları ve diğer uyumluluk gereksinimlerini içerir.
export type TenantOnboardingComplianceResult = {
  stateToken: string;
  status: TenantOnboardingApplicationStatus;
  redirectStep: TenantOnboardingSessionStepKey | null;
  countryPack: TenantOnboardingCountryPack;
  documentRequirements: {
    definitions: TenantOnboardingDocumentRequirement[];
    validationPolicy: {
      mode: 'minimum_current_required_document';
      minimumRequiredDocuments: number;
      note: string;
    };
  } | null;
  consentDefinitions: TenantOnboardingConsentDefinition[];
  acceptedConsents: TenantOnboardingConsentStatus[];
  missingRequiredConsentKeys: string[];
};

// TenantOnboardingResolvedSession, tenant onboarding sürecinde tenant'ın mevcut durumunu ve izin verilen adımları temsil eden bir yapıdır.
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

// TenantBusinessInfoInput, tenant onboarding sürecinde tenant'ın işletme bilgilerini temsil eden bir yapıdır.
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

// TenantLegalTaxInfoInput, tenant onboarding sürecinde tenant'ın yasal ve vergi bilgilerini temsil eden bir yapıdır.
export type TenantLegalTaxInfoInput = {
  legalEntityName?: string;
  taxId?: string | null;
  vatId?: string | null;
  registrationCountry?: string;
  registeredAddress?: string;
};

// TenantOwnerContactInfoInput, tenant onboarding sürecinde tenant'ın sahibi iletişim bilgilerini temsil eden bir yapıdır.
export type TenantOwnerContactInfoInput = {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  roleTitle?: string | null;
  ownershipPercentage?: number | null;
};

// TenantOperationsInfoInput, tenant onboarding sürecinde tenant'ın operasyon bilgilerini temsil eden bir yapıdır.
export type TenantOperationsInfoInput = {
  primaryCity?: string;
  primaryPostalCode?: string;
  deliveryModel?: string;
  supportsPickup?: boolean;
  openingHoursSummary?: string | null;
  estimatedGoLiveDate?: string | null;
};

// UploadTenantOnboardingDocumentInput, tenant onboarding sürecinde tenant'ın belge yükleme işlemi için kullanılan bir yapıdır.
export type UploadTenantOnboardingDocumentInput = {
  type: string;
  isRequired?: boolean;
  expiresAt?: string;
};

// TenantLocationSelectionInput, tenant onboarding sürecinde tenant'ın konum seçimi için kullanılan bir yapıdır.
export type TenantLocationSelectionInput = {
  locationLabel: string;
  rawInput: string;
  country?: string;
  city?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

// TenantAddressInput, tenant onboarding sürecinde tenant'ın adres bilgileri için kullanılan bir yapıdır.
export type TenantAddressInput = {
  country: string;
  city: string;
  region?: string | null;
  postalCode: string;
  addressLine1: string;
  addressLine2?: string | null;
  building?: string | null;
  floor?: string | null;
  door?: string | null;
  addressNote?: string | null;
};

// TenantBusinessDetailsRegistrationInput, tenant onboarding sürecinde tenant'ın işletme detaylarının doğrulanması için kullanılan bir yapıdır.
export type TenantBusinessDetailsRegistrationInput = {
  registrationNumber: string;
  country?: string;
};

// TenantBusinessDetailsInput, tenant onboarding sürecinde tenant'ın işletme detayları için kullanılan bir yapıdır.
export type TenantBusinessDetailsInput = {
  registrationNumber: string;
  registeredBusinessName: string;
  legalForm?: string | null;
  taxNumber?: string | null;
  vatRegistered?: boolean;
  vatNumber?: string | null;
  registrationCountry: string;
  registeredAddress: string;
  authorityName?: string | null;
};

// TenantAuthorizedPersonInput, tenant onboarding sürecinde tenant'ın yetkili kişisi için kullanılan bir yapıdır.
export type TenantAuthorizedPersonInput = {
  fullName: string;
  email: string;
  phoneNumber: string;
  roleTitle?: string | null;
  ownershipPercentage?: number | null;
};

// TenantBankDetailsInput, tenant onboarding sürecinde tenant'ın banka detayları için kullanılan bir yapıdır.
export type TenantBankDetailsInput = {
  bankName: string;
  accountHolderName: string;
  iban: string;
  currency?: string | null;
};

// TenantBillingAddressInput, tenant onboarding sürecinde tenant'ın fatura adresi için kullanılan bir yapıdır.
export type TenantBillingAddressInput = {
  useBusinessAddress?: boolean;
  billingName: string;
  country: string;
  city: string;
  postalCode: string;
  addressLine1: string;
  addressLine2?: string | null;
};

// TenantOnboardingPlanCatalogEntry, tenant onboarding sürecinde tenant'ın seçebileceği üyelik planlarını temsil eden bir yapıdır.
export type TenantOnboardingPlanCatalogEntry = {
  planKey: string;
  title: string;
  description: string;
  commissionSummary: string;
  monthlyFeeSummary: string | null;
  includedServices: string[];
  benefits: string[];
  limitations: string[];
  recommended: boolean;
  country: string;
  currency: string;
  active: boolean;
  sortOrder: number;
};

// TenantPlanSelectionInput, tenant onboarding sürecinde tenant'ın üyelik planı seçimi için kullanılan bir yapıdır.
export type TenantPlanSelectionInput = {
  planKey: string;
};

// TenantOnboardingReviewBlockKey, tenant onboarding sürecinde tenant'ın incelemesi gereken blokları temsil eden bir türdür.
export type TenantOnboardingReviewBlockKey =
  | 'phone-verification'
  | 'location'
  | 'address'
  | 'business-details'
  | 'authorized-person'
  | 'bank-details'
  | 'billing-address'
  | 'plan-selection'
  | 'operations-info'
  | 'documents'
  | 'consents';

// TenantOnboardingReviewSummary, tenant onboarding sürecinde tenant'ın incelemesi gereken bilgilerin özetini temsil eden bir yapıdır.
export type TenantOnboardingReviewSummary = {
  phoneVerification: {
    verified: boolean;
    maskedPhoneNumber: string | null;
    verifiedAt: string | null;
  };
  locationSelection: TenantLocationSelection | null;
  businessInfo: {
    businessName?: string | null;
    businessType?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;
  legalTaxInfo: {
    legalEntityName?: string | null;
    taxId?: string | null;
    vatId?: string | null;
    registrationCountry?: string | null;
    registeredAddress?: string | null;
  } | null;
  ownerContactInfo: {
    fullName?: string | null;
    email?: string | null;
    phoneNumber?: string | null;
    roleTitle?: string | null;
  } | null;
  bankDetails: {
    bankName: string | null;
    accountHolderName: string | null;
    maskedIban: string | null;
    currency: string | null;
  } | null;
  billingAddress: {
    billingName?: string | null;
    country?: string | null;
    city?: string | null;
    postalCode?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
  } | null;
  planSelection: {
    planKey?: string | null;
    planNameSnapshot?: string | null;
    commissionSummarySnapshot?: string | null;
    currency?: string | null;
  } | null;
  legacyRequirements: {
    operationsComplete: boolean;
    documentsComplete: boolean;
    operationsInfo: Record<string, unknown> | null;
    requiredDocuments: Array<{
      type: string | null;
      status: string | null;
      version: number | null;
    }>;
  };
  compliance: Omit<TenantOnboardingComplianceResult, 'stateToken' | 'status' | 'redirectStep' | 'countryPack'>;
};

export type TenantOnboardingReviewResult = {
  stateToken: string;
  status: TenantOnboardingApplicationStatus;
  redirectStep: TenantOnboardingSessionStepKey | null;
  countryPack: TenantOnboardingCountryPack;
  canSubmitForReview: boolean;
  missingRequiredBlocks: TenantOnboardingReviewBlockKey[];
  editSteps: Partial<Record<string, TenantOnboardingSessionStepKey>>;
  summary: TenantOnboardingReviewSummary | null;
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

export class TenantOnboardingSessionError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.name = 'TenantOnboardingSessionError';
    this.status = status;
    this.code = code;
  }
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
    const fallbackCode = `tenant_onboarding_session_failed_${response.status}`;
    let userMessage: string | undefined;
    try {
      const payload = await response.json();
      if (typeof payload?.message === 'string' && payload.message) {
        userMessage = payload.message;
      } else if (Array.isArray(payload?.message) && payload.message.length > 0) {
        userMessage = payload.message.join(', ');
      }
    } catch {
      // Body is not JSON — keep the status-derived fallback.
    }
    throw new TenantOnboardingSessionError(response.status, fallbackCode, userMessage);
  }

  return (await response.json()) as TenantOnboardingResolvedSession;
}

export async function completeTenantOnboardingWelcome(stateToken: string) {
  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/welcome/complete`,
    {
      credentials: 'include',
      method: 'POST',
    },
  );

  if (!response.ok) {
    throw new Error(`tenant_onboarding_welcome_complete_failed_${response.status}`);
  }

  return (await response.json()) as {
    stateToken: string;
    nextStep: TenantOnboardingSessionStepKey;
    redirectStep: TenantOnboardingSessionStepKey | null;
    session?: TenantOnboardingResolvedSession;
    workspace: TenantOnboardingWorkspace;
  };
}

export async function saveTenantOnboardingLocationSelection(
  stateToken: string,
  input: TenantLocationSelectionInput,
) {
  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/location`,
    {
      body: JSON.stringify(input),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );

  if (!response.ok) {
    let message = `tenant_onboarding_location_failed_${response.status}`;
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
      // Keep fallback.
    }
    throw new Error(message);
  }

  return (await response.json()) as {
    stateToken: string;
    nextStep: TenantOnboardingSessionStepKey;
    redirectStep: TenantOnboardingSessionStepKey | null;
    locationSelection: TenantLocationSelection;
    session?: TenantOnboardingResolvedSession;
    workspace: TenantOnboardingWorkspace;
  };
}

export async function saveTenantOnboardingAddress(
  stateToken: string,
  input: TenantAddressInput,
) {
  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/address`,
    {
      body: JSON.stringify(input),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );

  if (!response.ok) {
    let message = `tenant_onboarding_address_failed_${response.status}`;
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
      // Keep fallback.
    }
    throw new Error(message);
  }

  return (await response.json()) as {
    stateToken: string;
    nextStep: TenantOnboardingSessionStepKey;
    redirectStep: TenantOnboardingSessionStepKey | null;
    session?: TenantOnboardingResolvedSession;
    workspace: TenantOnboardingWorkspace;
  };
}

export async function verifyTenantOnboardingBusinessRegistration(
  stateToken: string,
  input: TenantBusinessDetailsRegistrationInput,
) {
  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/business-details/verify-registration`,
    {
      body: JSON.stringify(input),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );

  if (!response.ok) {
    let message = `tenant_onboarding_business_registration_failed_${response.status}`;
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
      // Keep fallback.
    }
    throw new Error(message);
  }

  return (await response.json()) as {
    accepted: boolean;
    registrationNumber?: string;
    country?: string;
    verificationMode?: 'mock' | string;
    message?: string;
    redirectStep?: TenantOnboardingSessionStepKey | null;
    session?: TenantOnboardingResolvedSession;
    workspace: TenantOnboardingWorkspace;
  };
}

export async function saveTenantOnboardingBusinessDetails(
  stateToken: string,
  input: TenantBusinessDetailsInput,
) {
  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/business-details`,
    {
      body: JSON.stringify(input),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );

  if (!response.ok) {
    let message = `tenant_onboarding_business_details_failed_${response.status}`;
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
      // Keep fallback.
    }
    throw new Error(message);
  }

  return (await response.json()) as {
    stateToken: string;
    nextStep: TenantOnboardingSessionStepKey;
    redirectStep: TenantOnboardingSessionStepKey | null;
    session?: TenantOnboardingResolvedSession;
    workspace: TenantOnboardingWorkspace;
  };
}

export async function saveTenantOnboardingAuthorizedPerson(
  stateToken: string,
  input: TenantAuthorizedPersonInput,
) {
  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/authorized-person`,
    {
      body: JSON.stringify(input),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );

  if (!response.ok) {
    let message = `tenant_onboarding_authorized_person_failed_${response.status}`;
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
      // Keep fallback.
    }
    throw new Error(message);
  }

  return (await response.json()) as {
    stateToken: string;
    nextStep: TenantOnboardingSessionStepKey;
    redirectStep: TenantOnboardingSessionStepKey | null;
    session?: TenantOnboardingResolvedSession;
    workspace: TenantOnboardingWorkspace;
  };
}

export async function saveTenantOnboardingBankDetails(
  stateToken: string,
  input: TenantBankDetailsInput,
) {
  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/bank-details`,
    {
      body: JSON.stringify(input),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );

  if (!response.ok) {
    let message = `tenant_onboarding_bank_details_failed_${response.status}`;
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
      // Keep fallback.
    }
    throw new Error(message);
  }

  return (await response.json()) as {
    stateToken: string;
    nextStep: TenantOnboardingSessionStepKey;
    redirectStep: TenantOnboardingSessionStepKey | null;
    session?: TenantOnboardingResolvedSession;
    workspace: TenantOnboardingWorkspace;
  };
}

export async function saveTenantOnboardingBillingAddress(
  stateToken: string,
  input: TenantBillingAddressInput,
) {
  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/billing-address`,
    {
      body: JSON.stringify(input),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );

  if (!response.ok) {
    let message = `tenant_onboarding_billing_address_failed_${response.status}`;
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
      // Keep fallback.
    }
    throw new Error(message);
  }

  return (await response.json()) as {
    stateToken: string;
    nextStep: TenantOnboardingSessionStepKey;
    redirectStep: TenantOnboardingSessionStepKey | null;
    session?: TenantOnboardingResolvedSession;
    workspace: TenantOnboardingWorkspace;
  };
}

export async function getTenantOnboardingPlans(stateToken: string) {
  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/plans`,
    { credentials: 'include' },
  );

  if (!response.ok) {
    throw new Error(`tenant_onboarding_plans_failed_${response.status}`);
  }

  return (await response.json()) as {
    stateToken: string;
    redirectStep: TenantOnboardingSessionStepKey | null;
    countryPack: TenantOnboardingCountryPack;
    plans: TenantOnboardingPlanCatalogEntry[];
    selectedPlan: {
      planKey: string;
      planNameSnapshot: string;
      commissionSummarySnapshot: string;
      currency: string;
      selectedAt: string;
    } | null;
  };
}

export async function saveTenantOnboardingPlanSelection(
  stateToken: string,
  input: TenantPlanSelectionInput,
) {
  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/plan-selection`,
    {
      body: JSON.stringify(input),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );

  if (!response.ok) {
    let message = `tenant_onboarding_plan_selection_failed_${response.status}`;
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
      // Keep fallback.
    }
    throw new Error(message);
  }

  return (await response.json()) as {
    stateToken: string;
    nextStep: TenantOnboardingSessionStepKey;
    redirectStep: TenantOnboardingSessionStepKey | null;
    session?: TenantOnboardingResolvedSession;
    workspace: TenantOnboardingWorkspace;
  };
}

export async function saveTenantOnboardingOperations(
  stateToken: string,
  input: TenantOperationsInfoInput,
) {
  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/operations`,
    {
      body: JSON.stringify(input),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );

  if (!response.ok) {
    let message = `tenant_onboarding_operations_failed_${response.status}`;
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
    stateToken: string;
    nextStep: TenantOnboardingSessionStepKey;
    redirectStep: TenantOnboardingSessionStepKey | null;
    session?: TenantOnboardingResolvedSession;
    workspace: TenantOnboardingWorkspace;
  };
}

export async function getTenantOnboardingReview(stateToken: string) {
  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/review`,
    { credentials: 'include' },
  );

  if (!response.ok) {
    throw new Error(`tenant_onboarding_review_failed_${response.status}`);
  }

  return (await response.json()) as TenantOnboardingReviewResult;
}

export async function getTenantOnboardingConsents(stateToken: string) {
  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/consents`,
    { credentials: 'include' },
  );

  if (!response.ok) {
    throw new Error(`tenant_onboarding_consents_failed_${response.status}`);
  }

  return (await response.json()) as TenantOnboardingComplianceResult;
}

export async function saveTenantOnboardingConsents(
  stateToken: string,
  acceptedConsentKeys: string[],
) {
  const response = await fetch(
    `${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/consents`,
    {
      body: JSON.stringify({ acceptedConsentKeys }),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );

  if (!response.ok) {
    let message = `tenant_onboarding_consents_save_failed_${response.status}`;
    try {
      const payload = await response.json();
      if (typeof payload?.message === 'string' && payload.message) {
        message = payload.message;
      }
    } catch {
      // Keep fallback.
    }
    throw new Error(message);
  }

  return (await response.json()) as TenantOnboardingComplianceResult;
}

export type TenantPhoneVerificationChallenge = {
  maskedPhoneNumber: string;
  expiresAt: string;
  delivery: 'email_fallback' | string;
  nextStep?: TenantOnboardingSessionStepKey;
  redirectStep?: TenantOnboardingSessionStepKey | null;
  session?: TenantOnboardingResolvedSession;
  verified?: boolean;
  debugCode?: string;
};

export async function sendTenantOnboardingPhoneCode(
  stateToken: string,
  phoneNumber: string,
) {
  const response = await fetch(`${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/phone/send-code`, {
    body: JSON.stringify({ phoneNumber }),
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

export async function resendTenantOnboardingPhoneCode(
  stateToken: string,
  phoneNumber?: string,
) {
  const response = await fetch(`${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/phone/resend-code`, {
    body: JSON.stringify(phoneNumber ? { phoneNumber } : {}),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) {
    let message = `tenant_onboarding_phone_resend_failed_${response.status}`;
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

  return (await response.json()) as {
    verified: true;
    nextStep?: TenantOnboardingSessionStepKey;
    redirectStep?: TenantOnboardingSessionStepKey | null;
    session?: TenantOnboardingResolvedSession;
    workspace: TenantOnboardingWorkspace;
  };
}

export async function verifyTenantOnboardingPhoneCode(stateToken: string, code: string) {
  const response = await fetch(`${apiBaseUrl}/v2/tenant/onboarding/${encodeURIComponent(stateToken)}/phone/verify-code`, {
    body: JSON.stringify({ code }),
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

  return (await response.json()) as {
    verified: true;
    nextStep?: TenantOnboardingSessionStepKey;
    redirectStep?: TenantOnboardingSessionStepKey | null;
    session?: TenantOnboardingResolvedSession;
    workspace: TenantOnboardingWorkspace;
  };
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
