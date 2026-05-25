'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import logoUrl from '@lieferzonen/assets/logo.svg';
import { AddressStep } from '@/components/tenant/onboarding/AddressStep';
import { AuthorizedPersonStep } from '@/components/tenant/onboarding/AuthorizedPersonStep';
import { BankDetailsStep } from '@/components/tenant/onboarding/BankDetailsStep';
import { BillingAddressStep } from '@/components/tenant/onboarding/BillingAddressStep';
import { BusinessDetailsStep } from '@/components/tenant/onboarding/BusinessDetailsStep';
import { DocumentsVerificationStep } from '@/components/tenant/onboarding/DocumentsVerificationStep';
import { LocationSearchStep } from '@/components/tenant/onboarding/LocationSearchStep';
import { OtpVerificationStep } from '@/components/tenant/onboarding/OtpVerificationStep';
import { OperationsStep } from '@/components/tenant/onboarding/OperationsStep';
import { PhoneVerificationStep } from '@/components/tenant/onboarding/PhoneVerificationStep';
import { PlanSelectionStep } from '@/components/tenant/onboarding/PlanSelectionStep';
import { ReviewStep } from '@/components/tenant/onboarding/ReviewStep';
import { SubmittedStep } from '@/components/tenant/onboarding/SubmittedStep';
import { TenantContinuationBanner } from '@/components/tenant/onboarding/TenantContinuationBanner';
import { TenantOnboardingStepPanel } from '@/components/tenant/onboarding/TenantOnboardingStepPanel';
import { WelcomeStep } from '@/components/tenant/onboarding/WelcomeStep';
import { useTenantOnboardingWorkspace } from '@/components/tenant/onboarding/useTenantOnboardingWorkspace';
import type { TenantOnboardingStepKey } from '@/lib/tenant-onboarding-client';
import {
  canAccessTenantOnboardingStep,
  getFirstLockedSafeTenantOnboardingStep,
  getNextTenantOnboardingStepKey,
  getPreviousTenantOnboardingStepKey,
  getTenantOnboardingResumeUrl,
  getTenantOnboardingStepUrl,
  normalizeTenantOnboardingStepSlug,
  tenantOnboardingWorkflowSteps,
  type TenantOnboardingWorkflowStepKey,
} from './onboarding-routing';

const WIZARD_RAIL_STEPS: readonly TenantOnboardingWorkflowStepKey[] = [
  'phone-verification',
  'welcome',
  'location',
  'address',
  'business-details',
  'authorized-person',
  'bank-details',
  'billing-address',
  'plan-selection',
  'operations',
  'verification',
  'review',
];

const WIZARD_RAIL_DESCRIPTIONS: Partial<Record<TenantOnboardingWorkflowStepKey, string>> = {
  'phone-verification': 'İletişim numaranızı onaylayın',
  welcome: 'Başvuru adımlarını görün',
  location: 'İşletmenizin konumunu seçin',
  address: 'Tam işletme adresini girin',
  'business-details': 'Ticari ve vergi bilgileri',
  'authorized-person': 'Yetkili kişi bilgileri',
  'bank-details': 'Ödeme alacağınız hesap',
  'billing-address': 'Faturalama adresi',
  'plan-selection': 'Hizmet planınızı seçin',
  operations: 'Operasyon detayları',
  verification: 'Belgeler ve gereklilikler',
  review: 'Kontrol edin ve gönderin',
};

const WIZARD_PROGRESS_GROUPS = [
  {
    key: 'business',
    title: 'İşletme bilgileri',
    description: 'Profil, ödeme ve plan',
    steps: [
      'welcome',
      'location',
      'address',
      'business-details',
      'authorized-person',
      'bank-details',
      'billing-address',
      'plan-selection',
    ],
  },
  {
    key: 'verification',
    title: 'İşletmenizi doğrulayın',
    description: 'İletişim, operasyon ve belgeler',
    steps: ['phone-verification', 'operations', 'verification', 'review'],
  },
] as const satisfies ReadonlyArray<{
  key: string;
  title: string;
  description: string;
  steps: readonly TenantOnboardingWorkflowStepKey[];
}>;

export default function TenantOnboardingWorkspace({
  initialStep,
  requestedStep,
  stateToken,
}: {
  initialStep?: TenantOnboardingWorkflowStepKey;
  requestedStep?: string;
  stateToken?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const lastRedirectTargetRef = useRef<string | null>(null);
  const {
    completeStep,
    error,
    loading,
    applyMutationWorkspace,
    replaceWorkspace,
    saveDraft,
    savingStep,
    submitForReview,
    uploadDocument,
    workspace,
    resolvedSession,
  } = useTenantOnboardingWorkspace(stateToken, requestedStep ?? initialStep);

  const requestedWorkflowStep = useMemo(
    () =>
      normalizeTenantOnboardingStepSlug(String(resolvedSession?.requestedStep ?? requestedStep ?? initialStep ?? '')) ??
      initialStep ??
      'phone-verification',
    [initialStep, requestedStep, resolvedSession?.requestedStep],
  );
  const activeStep = useMemo(
    () =>
      (resolvedSession?.redirectStep
        ? normalizeTenantOnboardingStepSlug(resolvedSession.redirectStep)
        : null) ?? requestedWorkflowStep,
    [requestedWorkflowStep, resolvedSession?.redirectStep],
  );
  const railActiveStep = activeStep === 'otp' ? 'phone-verification' : activeStep;

  const replaceRoute = useCallback((url: string) => {
    if (pathname === url || lastRedirectTargetRef.current === url) {
      return;
    }
    lastRedirectTargetRef.current = url;
    router.replace(url);
  }, [pathname, router]);

  useEffect(() => {
    lastRedirectTargetRef.current = null;
  }, [pathname]);

  useEffect(() => {
    if (!workspace || !resolvedSession?.redirectStep) {
      return;
    }

    const target = getTenantOnboardingStepUrl(stateToken ?? workspace.stateToken, resolvedSession.redirectStep);
    replaceRoute(target);
  }, [replaceRoute, resolvedSession?.redirectStep, stateToken, workspace]);

  useEffect(() => {
    if (!workspace) {
      return;
    }

    const resumeUrl = getTenantOnboardingResumeUrl(workspace);
    if (resumeUrl === '/dashboard' || resumeUrl.endsWith('/submitted')) {
      replaceRoute(resumeUrl);
    }
  }, [replaceRoute, workspace]);

  useEffect(() => {
    if (!workspace || resolvedSession || canAccessTenantOnboardingStep(workspace, activeStep)) {
      return;
    }

    replaceRoute(
      getTenantOnboardingStepUrl(
        stateToken ?? workspace.stateToken,
        getFirstLockedSafeTenantOnboardingStep(workspace),
      ),
    );
  }, [activeStep, replaceRoute, resolvedSession, stateToken, workspace]);

  const selectStep = useCallback((nextStep: TenantOnboardingWorkflowStepKey) => {
    const nextToken = stateToken ?? workspace?.stateToken;
    if (workspace && !canAccessTenantOnboardingStep(workspace, nextStep)) {
      return;
    }
    if (nextToken) {
      replaceRoute(getTenantOnboardingStepUrl(nextToken, nextStep));
    }
  }, [replaceRoute, stateToken, workspace]);

  const moveToNextStep = useCallback(() => {
    selectStep(getNextTenantOnboardingStepKey(requestedWorkflowStep));
  }, [requestedWorkflowStep, selectStep]);

  const moveToPreviousStep = useCallback(() => {
    selectStep(getPreviousTenantOnboardingStepKey(requestedWorkflowStep));
  }, [requestedWorkflowStep, selectStep]);

  const completeStepAndNavigate = useCallback(async (step: TenantOnboardingStepKey) => {
    const result = await completeStep(step);
    const nextStep = step === 'owner_contact_info' ? 'bank-details' : result.nextStepKey;
    if (nextStep) {
      replaceRoute(getTenantOnboardingStepUrl(result.stateToken, nextStep));
    }
    return result;
  }, [completeStep, replaceRoute]);

  const navigateToUrl = useCallback((url: string) => {
    replaceRoute(url);
  }, [replaceRoute]);

  const visibleProgressSteps = useMemo(
    () =>
      WIZARD_RAIL_STEPS
        .map((stepKey) => tenantOnboardingWorkflowSteps.find((step) => step.key === stepKey))
        .filter((step): step is NonNullable<typeof step> => Boolean(step)),
    [],
  );

  const getStepStatus = useCallback((stepKey: TenantOnboardingWorkflowStepKey) => {
    if (stepKey === 'welcome') {
      const activeIndex = WIZARD_RAIL_STEPS.indexOf(railActiveStep);
      const welcomeIndex = WIZARD_RAIL_STEPS.indexOf('welcome');
      return activeIndex > welcomeIndex ? 'completed' : railActiveStep === stepKey ? 'in_progress' : 'not_started';
    }

    if (stepKey === 'location') {
      return workspace?.locationSelection?.locationLabel
        ? 'completed'
        : railActiveStep === stepKey ? 'in_progress' : 'not_started';
    }

    if (stepKey === 'address') {
      const businessInfoStatus = workspace?.steps.find((step) => step.stepKey === 'business_info')?.status ?? 'not_started';
      return businessInfoStatus === 'completed'
        ? 'completed'
        : railActiveStep === stepKey ? 'in_progress' : businessInfoStatus;
    }

    const workflowStep = tenantOnboardingWorkflowSteps.find((step) => step.key === stepKey);
    if (!workflowStep || !workflowStep.backendStep) {
      if (stepKey === 'phone-verification' && workspace?.phoneVerification?.verified) {
        return 'completed';
      }
      return railActiveStep === stepKey ? 'in_progress' : 'not_started';
    }

    return workspace?.steps.find((step) => step.stepKey === workflowStep.backendStep)?.status ?? 'not_started';
  }, [railActiveStep, workspace]);

  const progressGroups = useMemo(
    () =>
      WIZARD_PROGRESS_GROUPS.map((group) => {
        const steps = group.steps
          .map((stepKey) => visibleProgressSteps.find((step) => step.key === stepKey))
          .filter((step): step is NonNullable<typeof step> => Boolean(step));
        const completedCount = steps.filter((step) => getStepStatus(step.key) === 'completed').length;
        return {
          ...group,
          steps,
          active: (group.steps as readonly TenantOnboardingWorkflowStepKey[]).includes(railActiveStep),
          progressPercent: Math.round((completedCount / steps.length) * 100),
        };
      }),
    [getStepStatus, railActiveStep, visibleProgressSteps],
  );
  const activeProgressGroup =
    progressGroups.find((group) => group.active) ?? progressGroups[0]!;
  const widerContentStep =
    activeStep === 'plan-selection' ||
    activeStep === 'verification' ||
    activeStep === 'review';
  const sessionLanguage = resolvedSession?.countryPack.language ?? 'de-CH';

  if (!workspace && (loading || resolvedSession?.redirectStep)) {
    return (
      <div className="min-h-screen bg-[#f3f5f8] p-3 sm:p-6 lg:p-10">
        <section className="box-border mx-auto min-h-[calc(100vh-1.5rem)] max-w-[1280px] overflow-hidden rounded-[8px] border border-[#e6eaf0] bg-white sm:min-h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-5rem)]">
          <header className="flex h-[72px] items-center border-b border-[#e6eaf0] px-6 sm:px-10">
            <Image alt="Lieferzonen" className="h-7 w-auto" height={28} priority src={logoUrl} width={132} />
          </header>
          <div className="flex min-h-[420px] items-center justify-center">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="ml-3 text-[14px] text-ink-500">Onboarding bilgileri yükleniyor...</span>
          </div>
        </section>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen bg-[#f3f5f8] p-3 sm:p-6 lg:p-10">
        <div className="mx-auto max-w-[760px] rounded-[8px] border border-danger-200 bg-white p-6 text-[14px] text-danger-600">
          {error ?? 'Tenant onboarding workspace kullanılamıyor.'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f5f8] p-3 sm:p-6 lg:p-10">
      <section className="box-border mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1280px] flex-col overflow-hidden rounded-[8px] border border-[#e6eaf0] bg-white shadow-[0_20px_55px_rgba(15,23,42,0.06)] sm:min-h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-5rem)]">
        <header className="flex h-[72px] min-w-0 shrink-0 items-center justify-between gap-4 border-b border-[#e6eaf0] px-5 sm:px-10 lg:px-12">
          <Image alt="Lieferzonen" className="h-7 w-auto min-w-0 shrink" height={28} priority src={logoUrl} width={132} />
          <div
            aria-label="Seçili dil"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[4px] border border-[#dfe4ea] bg-white px-3 text-[13px] font-medium text-ink-700"
          >
            <span>{sessionLanguage}</span>
            <span aria-hidden="true" className="text-[11px] text-ink-400">v</span>
          </div>
        </header>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 overflow-hidden border-b border-[#e6eaf0] px-5 py-4 lg:hidden">
            <div className="grid gap-3 sm:grid-cols-2">
              {progressGroups.map((group) => (
                <div key={group.key} className={group.active ? 'text-primary-700' : 'text-ink-500'}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-[12px] font-semibold">
                    <span>{group.title}</span>
                    <span>{group.progressPercent}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-primary-100">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${group.progressPercent}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <ol className="mt-4 flex max-w-full gap-2 overflow-x-auto pb-1">
              {activeProgressGroup.steps.map((step, index) => {
                const status = getStepStatus(step.key);
                const selected = step.key === railActiveStep;
                const completed = status === 'completed';
                const accessible = canAccessTenantOnboardingStep(workspace, step.key);

                return (
                  <li key={step.key} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => selectStep(step.key)}
                      disabled={!accessible}
                      className={`flex h-9 items-center gap-2 rounded-[4px] border px-3 text-[12px] font-medium transition ${
                        selected
                          ? 'border-primary bg-primary-50 text-primary-700'
                          : completed
                            ? 'border-success-100 bg-success-50 text-success-700'
                            : 'border-ink-200 bg-white text-ink-500 disabled:opacity-55'
                      }`}
                    >
                      <span>{completed ? '\u2713' : index + 1}</span>
                      <span>{step.title}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          <main className="order-2 min-w-0 overflow-hidden px-5 py-8 sm:px-10 sm:py-10 lg:order-1 lg:px-12 lg:py-14 xl:px-20">
            <div className={`mx-auto box-border w-full [&_input]:box-border [&_select]:box-border [&_textarea]:box-border ${widerContentStep ? 'max-w-[820px]' : 'max-w-[650px]'}`}>
              <TenantContinuationBanner stateToken={workspace.stateToken} stepKey={activeStep} />

              {!workspace.editable && workspace.application.status !== 'rejected' && (
                <div className="mb-4 flex items-start gap-2.5 rounded-[8px] border border-warning-200 bg-warning-50 px-4 py-3 text-[13px] text-warning-600">
                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-warning-400" />
                  <span>
                    <strong className="font-semibold">Başvurunuz inceleniyor.</strong>{' '}
                    Form şu anda salt-okunur; inceleme tamamlanana kadar düzenleme yapılamaz.
                  </span>
                </div>
              )}

              {workspace.application.status === 'rejected' && (
                <div className="mb-4 rounded-[8px] border border-danger-200 bg-danger-50 px-4 py-3 text-[13px] text-danger-600">
                  Başvurunuz reddedilmiştir. Detaylar için destek ekibiyle iletişime geçin.
                </div>
              )}

              {error && (
                <div className="mb-4 rounded-[8px] border border-warning-200 bg-warning-50 px-4 py-3 text-[13px] text-warning-600">
                  {error}
                </div>
              )}

              <div className="min-w-0">
                {activeStep === 'phone-verification' ? (
                  <PhoneVerificationStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
                ) : activeStep === 'otp' ? (
                  <OtpVerificationStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
                ) : activeStep === 'welcome' ? (
                  <WelcomeStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
                ) : activeStep === 'location' ? (
                  <LocationSearchStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
                ) : activeStep === 'address' ? (
                  <AddressStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
                ) : activeStep === 'business-details' ? (
                  <BusinessDetailsStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
                ) : activeStep === 'authorized-person' ? (
                  <AuthorizedPersonStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
                ) : activeStep === 'bank-details' ? (
                  <BankDetailsStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
                ) : activeStep === 'billing-address' ? (
                  <BillingAddressStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
                ) : activeStep === 'plan-selection' ? (
                  <PlanSelectionStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
                ) : activeStep === 'operations' ? (
                  <OperationsStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
                ) : activeStep === 'verification' ? (
                  <DocumentsVerificationStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
                ) : activeStep === 'review' ? (
                  <ReviewStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
                ) : activeStep === 'submitted' ? (
                  <SubmittedStep resolvedSession={resolvedSession} workspace={workspace} />
                ) : (
                  <TenantOnboardingStepPanel
                    activeStep={activeStep}
                    onBack={moveToPreviousStep}
                    onComplete={completeStepAndNavigate}
                    onContinue={moveToNextStep}
                    onPhoneVerified={replaceWorkspace}
                    onSaveDraft={saveDraft}
                    onSubmit={submitForReview}
                    onUploadDocument={uploadDocument}
                    savingStep={savingStep}
                    workspace={workspace}
                  />
                )}
              </div>
            </div>
          </main>

          <aside className="order-1 hidden border-l border-[#e6eaf0] bg-white lg:flex lg:flex-col">
            <div className="flex-1 overflow-y-auto px-7 py-8">
              <div className="grid gap-5">
                {progressGroups.map((group) => (
                  <section key={group.key}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-[13px] font-semibold ${group.active ? 'text-ink-900' : 'text-ink-600'}`}>
                          {group.title}
                        </p>
                        <p className="mt-1 text-[12px] text-ink-400">{group.description}</p>
                      </div>
                      <span className={`text-[12px] font-semibold ${group.active ? 'text-primary-700' : 'text-ink-400'}`}>
                        {group.progressPercent}%
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary-100">
                      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${group.progressPercent}%` }} />
                    </div>
                  </section>
                ))}
              </div>

              <div className="mb-5 mt-9 border-t border-[#e6eaf0] pt-6">
                <p className="text-[12px] font-semibold uppercase text-ink-400">Aktif bölüm</p>
                <p className="mt-1 text-[15px] font-semibold text-ink-900">{activeProgressGroup.title}</p>
              </div>
              <ol>
                {activeProgressGroup.steps.map((step, index) => {
                  const status = getStepStatus(step.key);
                  const selected = step.key === railActiveStep;
                  const completed = status === 'completed';
                  const accessible = canAccessTenantOnboardingStep(workspace, step.key);

                  return (
                    <li key={step.key} className="relative flex gap-4 pb-4 last:pb-0">
                      {index < activeProgressGroup.steps.length - 1 ? (
                        <span
                          aria-hidden="true"
                          className={`absolute left-[13px] top-7 h-[calc(100%-0.65rem)] w-px ${
                            completed ? 'bg-success-500' : 'bg-ink-200'
                          }`}
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => selectStep(step.key)}
                        disabled={!accessible}
                        className="relative flex w-full items-start gap-4 text-left disabled:cursor-not-allowed"
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold ${
                            completed
                              ? 'border-success-500 bg-success-500 text-white'
                              : selected
                                ? 'border-primary text-primary-700'
                                : 'border-ink-200 text-ink-400'
                          }`}
                        >
                          {completed ? '\u2713' : index + 1}
                        </span>
                        <span className="min-w-0 pt-0.5">
                          <span className={`block text-[13px] font-semibold ${selected || completed ? 'text-ink-800' : 'text-ink-400'}`}>
                            {step.title}
                          </span>
                          <span className={`mt-0.5 block text-[12px] leading-4 ${selected || completed ? 'text-ink-500' : 'text-ink-300'}`}>
                            {WIZARD_RAIL_DESCRIPTIONS[step.key]}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="border-t border-[#e6eaf0] px-7 py-6">
              <p className="text-[13px] font-semibold text-ink-800">Yardıma mı ihtiyacınız var?</p>
              <p className="mt-2 text-[12px] leading-5 text-ink-500">
                Başvuru sürecinde destek ekibimiz size yardımcı olabilir.
              </p>
              <a
                href="mailto:support@lieferzonen.de"
                className="mt-4 inline-flex h-10 items-center justify-center rounded-[4px] border border-ink-200 px-4 text-[13px] font-semibold text-ink-700 transition hover:border-primary hover:text-primary-700"
              >
                Destek alın
              </a>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
