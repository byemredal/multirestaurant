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
  'review',
  'submitted',
] as const satisfies readonly TenantOnboardingCanonicalStepKey[];

export const tenantOnboardingWorkflowSteps: readonly TenantOnboardingWorkflowStep[] = [
  {
    key: 'phone-verification',
    title: 'Telefon dogrulama',
    description: 'Iletisim numaranizi dogrulayin.',
  },
  {
    key: 'otp',
    title: 'OTP',
    description: 'Gelen kodu onaylayin.',
    hideInLegacyNav: true,
  },
  {
    key: 'welcome',
    informational: true,
    title: 'Hos geldiniz',
    description: 'Basvurunun akisina baslayin.',
  },
  {
    key: 'business-intro',
    informational: true,
    title: 'Hazirlik',
    description: 'Sizden isteyecegimiz bilgileri gorun.',
  },
  {
    key: 'location',
    title: 'Konum',
    description: 'Once isletmenizi arayin, ardindan adresi netlestirin.',
    backendStep: 'business_info',
  },
  {
    key: 'address',
    title: 'Adres',
    description: 'Isletme adresini netlestirin.',
    backendStep: 'business_info',
  },
  {
    key: 'business-details',
    title: 'Isletme detaylari',
    description: 'Vergi ve ticari kayit bilgileri.',
    backendStep: 'legal_tax_info',
  },
  {
    key: 'authorized-person',
    title: 'Yetkili kisi',
    description: 'Basvurudan sorumlu kisi ve sahiplik bilgileri.',
    backendStep: 'owner_contact_info',
  },
  {
    key: 'bank-details',
    title: 'Banka bilgileri',
    description: 'IBAN, banka ve odeme hazirligi.',
    backendStep: 'bank_details',
  },
  {
    key: 'billing-address',
    title: 'Fatura adresi',
    description: 'Faturalama adresini netlestirin.',
    backendStep: 'billing_address',
  },
  {
    key: 'plan-selection',
    title: 'Paket secimi',
    description: 'Baslangic paketini secin.',
    backendStep: 'membership_plan',
  },
  {
    key: 'verification',
    title: 'Dogrulama',
    description: 'Belge gereksinimlerini inceleyin.',
    backendStep: 'documents',
  },
  {
    key: 'review',
    title: 'Kontrol',
    description: 'Tum bloklari kontrol edip basvuruyu gonderin.',
    backendStep: 'final_review',
  },
  {
    key: 'submitted',
    title: 'Gonderildi',
    description: 'Basvuru durumunu takip edin.',
    terminal: true,
    hideInLegacyNav: true,
  },
  {
    key: 'waiting',
    title: 'Bekleme',
    description: 'Basvuru durumunu takip edin.',
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

    if (stepKey === 'review') {
      return isBackendStepCompleted(workspace, 'membership_plan');
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
  if (isBackendStepCompleted(workspace, 'membership_plan')) {
    return 'review';
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
  operations_info: 'plan-selection',
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
  review: 'review',
  submitted: 'submitted',
  waiting: 'waiting',
  verification: 'verification',
  'business-info': 'location',
  'legal-tax-info': 'business-details',
  'owner-contact-info': 'authorized-person',
  'operations-info': 'plan-selection',
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
  // `submitted` is the V2 canonical terminal step. The legacy route that
  // renders the waiting/status page is still `/waiting`; keep the URL bridge
  // here until the custom submitted page lands.
  const urlStep = stepKey === 'submitted' ? 'waiting' : stepKey;
  return `/onboarding/${encodeURIComponent(stateToken)}/${urlStep}`;
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

  if (status === 'approved' || status === 'active') {
    return '/dashboard';
  }

  if (status === 'submitted' || status === 'under_review' || status === 'rejected' || status === 'suspended') {
    return `/onboarding/${encodeURIComponent(workspace.stateToken)}/waiting`;
  }

  return getTenantOnboardingStepUrl(
    workspace.stateToken,
    getFirstLockedSafeTenantOnboardingStep(workspace),
  );
}
