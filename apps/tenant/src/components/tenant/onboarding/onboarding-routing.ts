import type {
  TenantOnboardingStepKey,
  TenantOnboardingWorkspace,
} from '@/lib/tenant-onboarding-client';

export type TenantOnboardingCanonicalStepKey =
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
  | 'review'
  | 'submitted';

export type TenantOnboardingWorkflowStepKey =
  | TenantOnboardingCanonicalStepKey
  | 'business-intro'
  | 'verification'
  | 'waiting';

export type TenantOnboardingWorkflowStep = {
  key: TenantOnboardingWorkflowStepKey;
  title: string;
  description: string;
  backendStep?: TenantOnboardingStepKey;
  informational?: boolean;
  terminal?: boolean;
  /**
   * Future V2 custom pages can be routable before they are useful in the
   * current legacy panel/sidebar shell.
   */
  hideInLegacyNav?: boolean;
};

export const tenantOnboardingCanonicalSteps = [
  'phone-verification',
  'otp',
  'welcome',
  'location',
  'address',
  'business-details',
  'authorized-person',
  'bank-details',
  'billing-address',
  'plan-selection',
  'operations',
  'review',
  'submitted',
] as const satisfies readonly TenantOnboardingCanonicalStepKey[];

export const tenantOnboardingWorkflowSteps: readonly TenantOnboardingWorkflowStep[] = [
  {
    key: 'phone-verification',
    title: 'Telefon doğrulama',
    description: 'İletişim numaranızı doğrulayın.',
  },
  {
    key: 'otp',
    title: 'OTP',
    description: 'Gelen kodu onaylayın.',
    hideInLegacyNav: true,
  },
  {
    key: 'welcome',
    informational: true,
    title: 'Hoş geldiniz',
    description: 'Başvuru akışına başlayın.',
  },
  {
    key: 'business-intro',
    informational: true,
    title: 'Hazırlık',
    description: 'Sizden isteyeceğimiz bilgileri görün.',
  },
  {
    key: 'location',
    title: 'Konum',
    description: 'Önce işletmenizi arayın, ardından adresi netleştirin.',
    backendStep: 'business_info',
  },
  {
    key: 'address',
    title: 'Adres',
    description: 'İşletme adresini netleştirin.',
    backendStep: 'business_info',
  },
  {
    key: 'business-details',
    title: 'İşletme detayları',
    description: 'Vergi ve ticari kayıt bilgileri.',
    backendStep: 'legal_tax_info',
  },
  {
    key: 'authorized-person',
    title: 'Yetkili kişi',
    description: 'Başvurudan sorumlu kişi ve sahiplik bilgileri.',
    backendStep: 'owner_contact_info',
  },
  {
    key: 'bank-details',
    title: 'Banka bilgileri',
    description: 'IBAN, banka ve ödeme hazırlığı.',
    backendStep: 'bank_details',
  },
  {
    key: 'billing-address',
    title: 'Fatura adresi',
    description: 'Faturalama adresini netleştirin.',
    backendStep: 'billing_address',
  },
  {
    key: 'plan-selection',
    title: 'Paket seçimi',
    description: 'Başlangıç paketini seçin.',
    backendStep: 'membership_plan',
  },
  {
    key: 'operations',
    title: 'Operasyon',
    description: 'Teslimat ve faaliyete başlama detayları.',
    backendStep: 'operations_info',
  },
  {
    key: 'verification',
    title: 'Doğrulama',
    description: 'Belge gereksinimlerini inceleyin.',
    backendStep: 'documents',
  },
  {
    key: 'review',
    title: 'Kontrol',
    description: 'Tüm blokları kontrol edip başvuruyu gönderin.',
    backendStep: 'final_review',
  },
  {
    key: 'submitted',
    title: 'Gönderildi',
    description: 'Başvuru durumunu takip edin.',
    terminal: true,
    hideInLegacyNav: true,
  },
  {
    key: 'waiting',
    title: 'Bekleme',
    description: 'Başvuru durumunu takip edin.',
    terminal: true,
    hideInLegacyNav: true,
  },
];

export const tenantOnboardingWorkflowStepOrder: TenantOnboardingWorkflowStepKey[] =
  tenantOnboardingWorkflowSteps
    .filter((step) => !step.terminal && step.key !== 'business-intro')
    .map((step) => step.key);

export const tenantOnboardingProgressStepOrder: TenantOnboardingWorkflowStepKey[] =
  tenantOnboardingWorkflowSteps
    .filter((step) => !step.terminal && !step.informational && !step.hideInLegacyNav)
    .map((step) => step.key);

function isBackendStepCompleted(workspace: TenantOnboardingWorkspace, stepKey: TenantOnboardingStepKey) {
  return workspace.steps.some((step) => step.stepKey === stepKey && step.status === 'completed');
}

function isWorkflowStepSatisfied(
  workspace: TenantOnboardingWorkspace,
  step: TenantOnboardingWorkflowStep,
) {
  if (step.key === 'phone-verification' || step.key === 'otp') {
    return Boolean(workspace.phoneVerification?.verified);
  }

  if (step.informational || step.key === 'welcome') {
    return true;
  }

  if (step.key === 'location') {
    return Boolean(workspace.locationSelection?.locationLabel?.trim());
  }

  if (step.key === 'address') {
    return isBackendStepCompleted(workspace, 'business_info');
  }

  return step.backendStep ? isBackendStepCompleted(workspace, step.backendStep) : true;
}

export function getTenantOnboardingAccessibleStepKeys(workspace: TenantOnboardingWorkspace) {
  return tenantOnboardingWorkflowStepOrder.filter((stepKey, index) => {
    if (index === 0) {
      return true;
    }

    if (stepKey === 'operations') {
      return isBackendStepCompleted(workspace, 'membership_plan');
    }

    if (stepKey === 'verification') {
      return isBackendStepCompleted(workspace, 'operations_info');
    }

    if (stepKey === 'review') {
      return (
        isBackendStepCompleted(workspace, 'operations_info') &&
        isBackendStepCompleted(workspace, 'documents')
      );
    }

    const previousSteps = tenantOnboardingWorkflowStepOrder
      .slice(0, index)
      .map((key) => getWorkflowStep(key));

    return previousSteps.every((step) => isWorkflowStepSatisfied(workspace, step));
  });
}

export function canAccessTenantOnboardingStep(
  workspace: TenantOnboardingWorkspace,
  stepKey: TenantOnboardingWorkflowStepKey,
) {
  if (stepKey === 'waiting' || stepKey === 'submitted') {
    return true;
  }

  return getTenantOnboardingAccessibleStepKeys(workspace).includes(stepKey);
}

export function getFirstLockedSafeTenantOnboardingStep(workspace: TenantOnboardingWorkspace) {
  const accessibleSteps = getTenantOnboardingAccessibleStepKeys(workspace);
  if (
    isBackendStepCompleted(workspace, 'operations_info') &&
    isBackendStepCompleted(workspace, 'documents')
  ) {
    return 'review';
  }
  if (isBackendStepCompleted(workspace, 'operations_info')) {
    return 'verification';
  }
  if (isBackendStepCompleted(workspace, 'membership_plan')) {
    return 'operations';
  }
  if (isBackendStepCompleted(workspace, 'billing_address')) {
    return 'plan-selection';
  }
  const revisionStep = workspace.steps.find((step) => step.status === 'needs_revision');
  const incompleteStep = workspace.steps.find((step) => step.status !== 'completed');
  const preferredStep =
    (revisionStep?.stepKey ?? incompleteStep?.stepKey) === 'business_info' &&
    workspace.locationSelection?.locationLabel?.trim()
      ? 'address'
      : getWorkflowStepForBackendStep(revisionStep?.stepKey ?? incompleteStep?.stepKey);

  return accessibleSteps.includes(preferredStep)
    ? preferredStep
    : accessibleSteps[accessibleSteps.length - 1] ?? 'phone-verification';
}

const workflowStepByBackendStep: Partial<
  Record<TenantOnboardingStepKey, TenantOnboardingWorkflowStepKey>
> = {
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

export const tenantOnboardingWorkflowStepBySlug: Record<
  string,
  TenantOnboardingWorkflowStepKey
> = {
  welcome: 'welcome',
  'phone-verification': 'phone-verification',
  otp: 'otp',
  'business-intro': 'business-intro',
  location: 'location',
  address: 'address',
  'business-details': 'business-details',
  'authorized-person': 'authorized-person',
  'bank-details': 'bank-details',
  'billing-address': 'billing-address',
  'plan-selection': 'plan-selection',
  operations: 'operations',
  review: 'review',
  submitted: 'submitted',
  waiting: 'waiting',
  verification: 'verification',
  'business-info': 'location',
  'legal-tax-info': 'business-details',
  'owner-contact-info': 'authorized-person',
  'operations-info': 'operations',
  documents: 'verification',
  'final-review': 'review',
};

export function normalizeTenantOnboardingStepSlug(
  stepSlug: string | null | undefined,
): TenantOnboardingWorkflowStepKey | null {
  if (!stepSlug) {
    return 'phone-verification';
  }

  return tenantOnboardingWorkflowStepBySlug[stepSlug] ?? null;
}

export function getWorkflowStep(
  stepKey: TenantOnboardingWorkflowStepKey,
): TenantOnboardingWorkflowStep {
  return (
    tenantOnboardingWorkflowSteps.find((step) => step.key === stepKey) ??
    tenantOnboardingWorkflowSteps[0]
  );
}

export function getWorkflowStepForBackendStep(stepKey: TenantOnboardingStepKey | null | undefined) {
  return stepKey ? workflowStepByBackendStep[stepKey] ?? 'review' : 'review';
}

export function getBackendStepForWorkflowStep(stepKey: TenantOnboardingWorkflowStepKey) {
  return getWorkflowStep(stepKey).backendStep;
}

export function getTenantOnboardingStepUrl(
  stateToken: string,
  stepKey: TenantOnboardingWorkflowStepKey | string,
) {
  return `/onboarding/${encodeURIComponent(stateToken)}/${stepKey}`;
}

export function getNextTenantOnboardingStepKey(stepKey: TenantOnboardingWorkflowStepKey) {
  const currentIndex = tenantOnboardingWorkflowStepOrder.indexOf(stepKey);
  return tenantOnboardingWorkflowStepOrder[currentIndex + 1] ?? stepKey;
}

export function getPreviousTenantOnboardingStepKey(stepKey: TenantOnboardingWorkflowStepKey) {
  const currentIndex = tenantOnboardingWorkflowStepOrder.indexOf(stepKey);
  return currentIndex > 0 ? tenantOnboardingWorkflowStepOrder[currentIndex - 1] : stepKey;
}

export function getTenantOnboardingResumeUrl(workspace: TenantOnboardingWorkspace) {
  const status = workspace.application.status;

  // Closed lifecycle (approved/active/rejected/suspended) and pending review
  // (submitted/under_review) all land on the in-flow submitted screen, which
  // now renders status-specific copy (approved CTA, revision notes, etc.).
  // Keeping the user inside `/onboarding/[stateToken]/submitted` avoids
  // bouncing an unauthenticated state-token visitor to /login when their
  // application was just approved.
  if (
    status === 'approved' ||
    status === 'active' ||
    status === 'submitted' ||
    status === 'under_review' ||
    status === 'rejected' ||
    status === 'suspended'
  ) {
    return getTenantOnboardingStepUrl(workspace.stateToken, 'submitted');
  }

  return getTenantOnboardingStepUrl(
    workspace.stateToken,
    getFirstLockedSafeTenantOnboardingStep(workspace),
  );
}
