import type {
  TenantOnboardingStepKey,
  TenantOnboardingWorkspace,
} from '@/lib/tenant-onboarding-client';

export type TenantOnboardingWorkflowStepKey =
  | 'welcome'
  | 'phone-verification'
  | 'business-intro'
  | 'location'
  | 'business-details'
  | 'bank-details'
  | 'plan-selection'
  | 'review'
  | 'verification'
  | 'waiting';

export type TenantOnboardingWorkflowStep = {
  key: TenantOnboardingWorkflowStepKey;
  title: string;
  description: string;
  backendStep?: TenantOnboardingStepKey;
  informational?: boolean;
  terminal?: boolean;
};

export const tenantOnboardingWorkflowSteps = [
  {
    key: 'welcome',
    informational: true,
    title: 'Hoş geldiniz',
    description: 'Başvurunun akışını başlatın.',
  },
  {
    key: 'phone-verification',
    title: 'Telefon doğrulama',
    description: 'İletişim numaranızı doğrulayın.',
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
    key: 'business-details',
    title: 'İşletme detayları',
    description: 'Vergi bilgileri ve yetkili kişi detayları.',
    backendStep: 'legal_tax_info',
  },
  {
    key: 'bank-details',
    title: 'Banka bilgileri',
    description: 'IBAN, banka ve fatura adresi hazırlığı.',
  },
  {
    key: 'plan-selection',
    title: 'Paket seçimi',
    description: 'Başlangıç paketini seçin.',
    backendStep: 'operations_info',
  },
  {
    key: 'review',
    title: 'Kontrol',
    description: 'Tüm blokları kontrol edip başvuruyu gönderin.',
    backendStep: 'final_review',
  },
  {
    key: 'verification',
    title: 'Doğrulama',
    description: 'Belge gereksinimlerini inceleyin.',
    backendStep: 'documents',
  },
  {
    key: 'waiting',
    title: 'Bekleme',
    description: 'Başvuru durumunu takip edin.',
    terminal: true,
  },
] as const satisfies readonly TenantOnboardingWorkflowStep[];

const tenantOnboardingWorkflowStepBaseOrder = tenantOnboardingWorkflowSteps
  .filter((step) => !('terminal' in step && step.terminal))
  .map((step) => step.key as TenantOnboardingWorkflowStepKey)
  .filter((step) => step !== 'review' && step !== 'verification');

export const tenantOnboardingWorkflowStepOrder: TenantOnboardingWorkflowStepKey[] = [
  ...tenantOnboardingWorkflowStepBaseOrder,
  'verification',
  'review',
];

const tenantOnboardingProgressStepBaseOrder = tenantOnboardingWorkflowSteps
  .filter(
    (step) =>
      !('terminal' in step && step.terminal) &&
      !('informational' in step && step.informational),
  )
  .map((step) => step.key as TenantOnboardingWorkflowStepKey)
  .filter((step) => step !== 'review' && step !== 'verification');

export const tenantOnboardingProgressStepOrder: TenantOnboardingWorkflowStepKey[] = [
  ...tenantOnboardingProgressStepBaseOrder,
  'verification',
  'review',
];

function isBackendStepCompleted(workspace: TenantOnboardingWorkspace, stepKey: TenantOnboardingStepKey) {
  return workspace.steps.some((step) => step.stepKey === stepKey && step.status === 'completed');
}

function isWorkflowStepSatisfied(
  workspace: TenantOnboardingWorkspace,
  step: TenantOnboardingWorkflowStep,
) {
  if (step.key === 'phone-verification') {
    return Boolean(workspace.phoneVerification?.verified);
  }

  if (step.informational || step.key === 'welcome') {
    return true;
  }

  return step.backendStep ? isBackendStepCompleted(workspace, step.backendStep) : true;
}

export function getTenantOnboardingAccessibleStepKeys(workspace: TenantOnboardingWorkspace) {
  return tenantOnboardingWorkflowStepOrder.filter((stepKey, index) => {
    if (index === 0) {
      return true;
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
  if (stepKey === 'waiting') {
    return true;
  }

  return getTenantOnboardingAccessibleStepKeys(workspace).includes(stepKey);
}

export function getFirstLockedSafeTenantOnboardingStep(workspace: TenantOnboardingWorkspace) {
  const accessibleSteps = getTenantOnboardingAccessibleStepKeys(workspace);
  const revisionStep = workspace.steps.find((step) => step.status === 'needs_revision');
  const incompleteStep = workspace.steps.find((step) => step.status !== 'completed');
  const preferredStep = getWorkflowStepForBackendStep(revisionStep?.stepKey ?? incompleteStep?.stepKey);

  return accessibleSteps.includes(preferredStep)
    ? preferredStep
    : accessibleSteps[accessibleSteps.length - 1] ?? 'welcome';
}

const workflowStepByBackendStep: Partial<
  Record<TenantOnboardingStepKey, TenantOnboardingWorkflowStepKey>
> = {
  business_info: 'location',
  legal_tax_info: 'business-details',
  owner_contact_info: 'business-details',
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
  'business-intro': 'business-intro',
  location: 'location',
  'business-details': 'business-details',
  'bank-details': 'bank-details',
  'plan-selection': 'plan-selection',
  review: 'review',
  verification: 'verification',
  waiting: 'waiting',
  'business-info': 'location',
  'legal-tax-info': 'business-details',
  'owner-contact-info': 'business-details',
  'operations-info': 'plan-selection',
  documents: 'verification',
  'final-review': 'review',
};

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
  stepKey: TenantOnboardingWorkflowStepKey,
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
