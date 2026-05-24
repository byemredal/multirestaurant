'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import logoUrl from '@lieferzonen/assets/logo.svg';
import { AddressStep } from '@/components/tenant/onboarding/AddressStep';
import { AuthorizedPersonStep } from '@/components/tenant/onboarding/AuthorizedPersonStep';
import { BankDetailsStep } from '@/components/tenant/onboarding/BankDetailsStep';
import { BillingAddressStep } from '@/components/tenant/onboarding/BillingAddressStep';
import { BusinessDetailsStep } from '@/components/tenant/onboarding/BusinessDetailsStep';
import { LocationSearchStep } from '@/components/tenant/onboarding/LocationSearchStep';
import { OtpVerificationStep } from '@/components/tenant/onboarding/OtpVerificationStep';
import { PhoneVerificationStep } from '@/components/tenant/onboarding/PhoneVerificationStep';
import { PlanSelectionStep } from '@/components/tenant/onboarding/PlanSelectionStep';
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
  tenantOnboardingProgressStepOrder,
  tenantOnboardingWorkflowSteps,
  type TenantOnboardingWorkflowStepKey,
} from './onboarding-routing';

function getLegacyRenderableStep(
  step: TenantOnboardingWorkflowStepKey,
): TenantOnboardingWorkflowStepKey {
  if (step === 'submitted') return 'waiting';
  return step;
}

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
  const activeStep = useMemo(() => getLegacyRenderableStep(requestedWorkflowStep), [requestedWorkflowStep]);

  const replaceRoute = useCallback((url: string) => {
    if (pathname === url || lastRedirectTargetRef.current === url) {
      return;
    }
    lastRedirectTargetRef.current = url;
    router.replace(url);
  }, [pathname, router]);

  useEffect(() => {
    if (lastRedirectTargetRef.current === pathname) {
      lastRedirectTargetRef.current = null;
    }
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
    if (resumeUrl === '/dashboard' || resumeUrl.endsWith('/waiting')) {
      replaceRoute(resumeUrl);
    }
  }, [replaceRoute, workspace]);

  useEffect(() => {
    if (
      !workspace ||
      resolvedSession ||
      canAccessTenantOnboardingStep(workspace, activeStep)
    ) {
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

  const progressIndex = tenantOnboardingProgressStepOrder.indexOf(activeStep);
  const completedProgress =
    progressIndex >= 0
      ? progressIndex + 1
      : activeStep === 'welcome' || activeStep === 'business-intro'
        ? 0
        : 1;
  const progressPercent = Math.round(
    (completedProgress / tenantOnboardingProgressStepOrder.length) * 100,
  );
  const activeProgressTitle =
    tenantOnboardingWorkflowSteps.find((step) => step.key === activeStep)?.title ?? 'Onboarding';
  const visibleProgressSteps = tenantOnboardingProgressStepOrder
    .map((stepKey) => tenantOnboardingWorkflowSteps.find((step) => step.key === stepKey))
    .filter((step): step is NonNullable<typeof step> => Boolean(step));
  const workflowGroups: Array<{
    title: string;
    description: string;
    steps: TenantOnboardingWorkflowStepKey[];
  }> = [
    {
      title: 'Isletme detaylari',
      description: 'Konum, isletme, banka ve paket bilgileri.',
      steps: ['location', 'address', 'business-details', 'authorized-person', 'bank-details', 'billing-address', 'plan-selection'],
    },
    {
      title: 'Isletme dogrulama',
      description: 'Telefon, belge hazirligi ve son kontrol.',
      steps: ['phone-verification', 'verification', 'review'],
    },
  ];

  const getStepStatus = (stepKey: TenantOnboardingWorkflowStepKey) => {
    if (stepKey === 'location') {
      return workspace?.locationSelection?.locationLabel ? 'completed' : activeStep === stepKey ? 'in_progress' : 'not_started';
    }

    if (stepKey === 'address') {
      const businessInfoStatus = workspace?.steps.find((step) => step.stepKey === 'business_info')?.status ?? 'not_started';
      return businessInfoStatus === 'completed'
        ? 'completed'
        : activeStep === stepKey
          ? 'in_progress'
          : businessInfoStatus;
    }

    const workflowStep = tenantOnboardingWorkflowSteps.find((step) => step.key === stepKey);
    if (!workflowStep || !('backendStep' in workflowStep) || !workflowStep.backendStep) {
      if (stepKey === 'phone-verification' && workspace?.phoneVerification?.verified) {
        return 'completed';
      }

      return activeStep === stepKey ? 'in_progress' : 'not_started';
    }

    return workspace?.steps.find((step) => step.stepKey === workflowStep.backendStep)?.status ?? 'not_started';
  };

  const getGroupProgress = (steps: TenantOnboardingWorkflowStepKey[]) => {
    const completed = steps.filter((step) => getStepStatus(step) === 'completed').length;
    return { completed, total: steps.length };
  };

  if (loading || resolvedSession?.redirectStep || activeStep === 'waiting') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-primary-50">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="ml-3 text-[14px] text-ink-500">Onboarding bilgileri yükleniyor...</span>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen bg-primary-50 p-8">
        <div className="rounded-[16px] bg-danger-50 px-5 py-4 text-[14px] text-danger-600">
          {error ?? 'Tenant onboarding workspace kullanılamıyor.'}
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes pnlSlideIn {
          from { opacity: 0; transform: translateY(3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pnl-slide-in { animation: pnlSlideIn 0.12s ease-out both; }
      `}</style>

      <div
        className={`min-h-screen bg-primary-50/70 p-4 transition-all duration-500 sm:p-6 lg:p-8 ${
          mounted ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
        }`}
      >
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1240px] overflow-hidden rounded-[10px] bg-white shadow-[0_28px_80px_rgba(15,23,42,0.14)] sm:min-h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-4rem)]">
          <aside className="relative hidden w-[340px] shrink-0 flex-col justify-between overflow-y-auto bg-primary px-9 py-9 text-white lg:flex">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                  <Image
                    alt="Lieferzonen"
                    className="h-5 w-auto brightness-0 invert"
                    height={20}
                    priority
                    src={logoUrl}
                    width={68}
                  />
                </span>
                <span className="text-[13px] font-bold text-ink-900">Lieferzonen</span>
              </div>

              <div className="mt-16">
                <p className="max-w-[250px] text-[30px] font-bold leading-[1.08] tracking-[-0.03em]">
                  Birkaç adımda işletmenizi yayına hazırlayın.
                </p>
                <p className="mt-6 max-w-[240px] text-[15px] leading-7 text-white/82">
                  Konum, işletme bilgileri ve doğrulama hazırlığını sakin bir akışta tamamlayın.
                </p>
              </div>

              <div className="mt-10 space-y-6">
                {workflowGroups.map((group) => (
                  <section key={group.title}>
                    {(() => {
                      const groupProgress = getGroupProgress(group.steps);
                      const groupActive = group.steps.includes(activeStep);

                      return (
                        <>
                    <div className="mb-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className={`text-[12px] font-bold uppercase tracking-[0.16em] ${
                          groupActive ? 'text-white' : 'text-white/70'
                        }`}>
                          {group.title}
                        </p>
                        <span className="rounded-full bg-white/12 px-2 py-0.5 text-[11px] font-bold text-white/82">
                          {groupProgress.completed}/{groupProgress.total}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] leading-5 text-white/64">{group.description}</p>
                    </div>

                    <ol className="space-y-2">
                      {group.steps.map((stepKey) => {
                        const step = tenantOnboardingWorkflowSteps.find((entry) => entry.key === stepKey);
                        if (!step) {
                          return null;
                        }

                        const status = getStepStatus(step.key);
                        const selected = step.key === activeStep;
                        const completed = status === 'completed';
                        const accessible = canAccessTenantOnboardingStep(workspace, step.key);

                        return (
                          <li key={step.key}>
                            <button
                              type="button"
                              onClick={() => selectStep(step.key)}
                              disabled={!accessible}
                              className={`group flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-left transition ${
                                selected
                                  ? 'bg-white text-primary-700 shadow-[0_12px_28px_rgba(15,23,42,0.16)]'
                                  : accessible
                                    ? 'bg-white/10 text-white hover:bg-white/16'
                                    : 'cursor-not-allowed bg-white/6 text-white/45'
                              }`}
                            >
                              <span
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                                  selected
                                    ? 'bg-primary text-white'
                                    : completed
                                      ? 'bg-white text-primary-700'
                                      : 'bg-white/14 text-white'
                                }`}
                              >
                                {completed ? '✓' : tenantOnboardingProgressStepOrder.indexOf(step.key) + 1}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-[13px] font-bold">{step.title}</span>
                                <span
                                  className={`mt-0.5 block truncate text-[11px] ${
                                    selected ? 'text-ink-500' : 'text-white/60'
                                  }`}
                                >
                                  {completed ? 'Tamamlandi' : selected ? 'Su anki adim' : accessible ? 'Hazir' : 'Kilitli'}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                        </>
                      );
                    })()}
                  </section>
                ))}
              </div>
            </div>

            <div className="relative h-28">
              <div className="absolute bottom-2 left-24 h-24 w-4 rounded-t-md bg-white shadow-[18px_18px_0_rgba(15,23,42,0.12)]" />
              <div className="absolute bottom-24 left-20 h-12 w-16 rounded-[8px] bg-white shadow-[18px_18px_0_rgba(15,23,42,0.12)]" />
              <div className="absolute bottom-0 left-16 h-2 w-24 rounded-full bg-white/90" />
            </div>
          </aside>

          <main className="flex min-w-0 flex-1 flex-col px-5 py-5 sm:px-8 sm:py-7 lg:px-14 lg:py-9">
            <header className="mb-8">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 lg:hidden">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                    <Image
                      alt="Lieferzonen"
                      className="h-5 w-auto brightness-0 invert"
                      height={20}
                      priority
                      src={logoUrl}
                      width={68}
                    />
                  </div>
                  <span className="text-[14px] font-bold text-ink-900">Lieferzonen</span>
                </div>
                <a className="ml-auto text-[13px] text-ink-500" href="mailto:support@lieferzonen.de">
                  Yardım mı lazım? <span className="font-bold text-primary-700">Destek al</span>
                </a>
              </div>

              <div className="mt-7 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-primary-700">
                    {activeStep === 'welcome' || activeStep === 'business-intro'
                      ? 'Hazırlık'
                      : `Adım ${Math.max(progressIndex, 0) + 1} / ${tenantOnboardingProgressStepOrder.length}`}
                  </p>
                  <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.03em] text-ink-900 sm:text-[34px]">
                    {activeProgressTitle}
                  </h1>
                </div>

                <div className="w-full xl:max-w-[430px]">
                  <div className="mb-2 flex items-center justify-between text-[12px] font-semibold text-ink-500">
                    <span>Form ilerlemesi</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-primary-100">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <ol className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
                {visibleProgressSteps.map((step, index) => {
                  const status = getStepStatus(step.key);
                  const selected = step.key === activeStep;
                  const completed = status === 'completed';
                  const accessible = canAccessTenantOnboardingStep(workspace, step.key);

                  return (
                    <li key={step.key} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => selectStep(step.key)}
                        disabled={!accessible}
                        className={`flex h-9 items-center gap-2 rounded-full border px-3 text-[12px] font-semibold transition ${
                          selected
                            ? 'border-primary bg-primary text-white shadow-pop'
                            : completed
                              ? 'border-primary-100 bg-primary-50 text-primary-700'
                              : accessible
                                ? 'border-ink-200 bg-white text-ink-500 hover:border-primary-100'
                                : 'cursor-not-allowed border-ink-200 bg-ink-50 text-ink-400 opacity-70'
                        }`}
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-current/10 text-[11px]">
                          {completed ? '✓' : index + 1}
                        </span>
                        <span>{step.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </header>

            <div className="min-w-0 flex-1">
              <TenantContinuationBanner stateToken={workspace.stateToken} stepKey={activeStep} />

              {!workspace.editable && workspace.application.status !== 'rejected' && (
                <div className="mb-3 flex items-start gap-2.5 rounded-[14px] border border-[#f3d7ac] bg-[#fff8ed] px-4 py-3 text-[13px] text-[#b54708]">
                  <span className="mt-0.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#f59e0b]" />
                  <span>
                    <strong className="font-semibold">Başvurunuz inceleniyor.</strong>{' '}
                    Form şu anda salt-okunur; inceleme tamamlanana kadar düzenleme yapılamaz.
                  </span>
                </div>
              )}

              {workspace.application.status === 'rejected' && (
                <div className="mb-3 rounded-[14px] border border-[#fda29b] bg-[#fff1f0] px-4 py-3 text-[13px] text-[#b42318]">
                  Başvurunuz reddedilmiştir. Detaylar için destek ekibiyle iletişime geçin.
                </div>
              )}

              {error && (
                <div className="mb-3 rounded-[14px] border border-[#f3d7ac] bg-[#fff8ed] px-4 py-3 text-[13px] text-[#b54708]">
                  {error}
                </div>
              )}

              <div className="pnl-slide-in min-w-0 max-w-[760px]">
                {requestedWorkflowStep === 'phone-verification' ? (
                  <PhoneVerificationStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
                ) : requestedWorkflowStep === 'otp' ? (
                  <OtpVerificationStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
                ) : requestedWorkflowStep === 'welcome' ? (
                  <WelcomeStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
                ) : requestedWorkflowStep === 'location' ? (
                  <LocationSearchStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
                ) : requestedWorkflowStep === 'address' ? (
                  <AddressStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
                ) : requestedWorkflowStep === 'business-details' ? (
                  <BusinessDetailsStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
                ) : requestedWorkflowStep === 'authorized-person' ? (
                  <AuthorizedPersonStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
                ) : requestedWorkflowStep === 'bank-details' ? (
                  <BankDetailsStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
                ) : requestedWorkflowStep === 'billing-address' ? (
                  <BillingAddressStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
                ) : requestedWorkflowStep === 'plan-selection' ? (
                  <PlanSelectionStep
                    resolvedSession={resolvedSession}
                    workspace={workspace}
                    onNavigate={navigateToUrl}
                    onWorkspaceResolved={applyMutationWorkspace}
                  />
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
        </div>
      </div>
    </>
  );
}
