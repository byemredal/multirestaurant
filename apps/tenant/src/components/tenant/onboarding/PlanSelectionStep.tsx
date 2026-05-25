'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@lieferzonen/ui';
import {
  getTenantOnboardingPlans,
  saveTenantOnboardingPlanSelection,
  type TenantOnboardingPlanCatalogEntry,
  type TenantOnboardingResolvedSession,
  type TenantOnboardingWorkspace,
} from '@/lib/tenant-onboarding-client';
import { getTenantOnboardingStepUrl } from './onboarding-routing';
import { OnboardingBottomActionBar } from './OnboardingBottomActionBar';
import { getPlanSelectionCopy } from './onboarding-country-pack';
import { StepHeader } from './shared/StepHeader';
import { useOnboardingActionGuard } from './hooks/useOnboardingActionGuard';

type PlanSelectionStepProps = {
  resolvedSession: TenantOnboardingResolvedSession | null;
  workspace: TenantOnboardingWorkspace;
  onWorkspaceResolved: (workspace: TenantOnboardingWorkspace) => void;
  onNavigate: (url: string) => void;
};

type SavedSelection = {
  planKey?: string | null;
};

function savedPlanKey(workspace: TenantOnboardingWorkspace) {
  const data = workspace.steps.find((step) => step.stepKey === 'membership_plan')?.data as
    | SavedSelection
    | null
    | undefined;
  return data?.planKey ?? '';
}

export function PlanSelectionStep({
  resolvedSession,
  workspace,
  onWorkspaceResolved,
  onNavigate,
}: PlanSelectionStepProps) {
  const navigateRef = useRef(onNavigate);
  const planRequestSequenceRef = useRef(0);
  const [plans, setPlans] = useState<TenantOnboardingPlanCatalogEntry[]>([]);
  const [selectedPlanKey, setSelectedPlanKey] = useState(() => savedPlanKey(workspace));
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runOnce = useOnboardingActionGuard();
  const copy = useMemo(() => getPlanSelectionCopy(resolvedSession?.countryPack), [resolvedSession?.countryPack]);
  const status = workspace.steps.find((step) => step.stepKey === 'membership_plan')?.status ?? 'in_progress';

  useEffect(() => {
    navigateRef.current = onNavigate;
  }, [onNavigate]);

  useEffect(() => {
    const requestSequence = planRequestSequenceRef.current + 1;
    planRequestSequenceRef.current = requestSequence;

    setLoadingPlans(true);
    setError(null);
    void getTenantOnboardingPlans(workspace.stateToken)
      .then((result) => {
        if (requestSequence !== planRequestSequenceRef.current) {
          return;
        }
        if (result.redirectStep) {
          navigateRef.current(getTenantOnboardingStepUrl(workspace.stateToken, result.redirectStep));
          return;
        }
        setPlans(result.plans.sort((left, right) => left.sortOrder - right.sortOrder));
        setSelectedPlanKey((current) => current || result.selectedPlan?.planKey || '');
      })
      .catch((caught: unknown) => {
        if (requestSequence === planRequestSequenceRef.current) {
          setError(caught instanceof Error ? caught.message : 'Plans could not be loaded.');
        }
      })
      .finally(() => {
        if (requestSequence === planRequestSequenceRef.current) {
          setLoadingPlans(false);
        }
      });
  }, [workspace.stateToken]);

  async function saveAndContinue() {
    if (!selectedPlanKey) {
      setError('Select one plan before continuing.');
      return;
    }

    await runOnce(async () => {
      let navigating = false;
      setSaving(true);
      setError(null);
      try {
        const result = await saveTenantOnboardingPlanSelection(workspace.stateToken, {
          planKey: selectedPlanKey,
        });
        onWorkspaceResolved(result.workspace);
        const nextStep = result.redirectStep ?? result.nextStep ?? result.session?.currentStep ?? 'operations';
        navigating = true;
        onNavigate(getTenantOnboardingStepUrl(workspace.stateToken, nextStep));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Plan selection could not be saved.');
      } finally {
        if (!navigating) {
          setSaving(false);
        }
      }
    });
  }

  return (
    <Card className="border-0 bg-white p-0 shadow-none">
      <StepHeader
        stepIndex={6}
        totalSteps={0}
        status={status}
        updatedAt={workspace.application.updatedAt}
        title={copy.title}
        description={copy.helperText}
      />

      <div className="grid gap-5">
        <div className="rounded-[8px] border border-primary-100 bg-primary-50 px-4 py-4 text-[13px] leading-6 text-primary-700">
          {copy.disclaimer}
        </div>

        {error ? (
          <div className="rounded-[8px] border border-danger-200 bg-danger-50 px-4 py-3 text-[13px] text-danger-600">
            {error}
          </div>
        ) : null}

        {loadingPlans ? (
          <div className="flex min-h-40 items-center justify-center rounded-[8px] border border-ink-100 text-[14px] text-ink-500">
            Loading available plans...
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => {
              const selected = plan.planKey === selectedPlanKey;
              return (
                <button
                  key={plan.planKey}
                  type="button"
                  aria-pressed={selected}
                  disabled={saving}
                  onClick={() => {
                    setSelectedPlanKey(plan.planKey);
                    setError(null);
                  }}
                  className={`flex h-full min-h-[390px] flex-col rounded-[8px] border p-5 text-left transition ${
                    selected
                      ? 'border-primary bg-primary-50 shadow-[0_10px_28px_rgba(15,23,42,0.08)]'
                      : 'border-ink-200 bg-white hover:border-primary-100'
                  }`}
                >
                  <div className="flex min-h-7 items-start justify-between gap-3">
                    <span className="text-[18px] font-bold leading-6 text-ink-900">{plan.title}</span>
                    {plan.recommended ? (
                      <span className="shrink-0 rounded-full bg-primary px-2 py-1 text-[11px] font-semibold text-white">
                        Recommended
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 min-h-12 text-[13px] leading-5 text-ink-500">{plan.description}</p>
                  <div className="mt-4 rounded-[8px] bg-ink-50 px-3 py-3">
                    <p className="text-[12px] font-semibold text-ink-500">Fee summary ({plan.currency})</p>
                    <p className="mt-1 text-[14px] font-bold text-ink-900">{plan.commissionSummary}</p>
                    {plan.monthlyFeeSummary ? (
                      <p className="mt-1 text-[12px] text-ink-500">{plan.monthlyFeeSummary}</p>
                    ) : null}
                  </div>
                  <p className="mt-4 text-[12px] font-semibold text-ink-700">Included services</p>
                  <ul className="mt-2 space-y-2 text-[12px] leading-5 text-ink-600">
                    {plan.includedServices.map((service) => (
                      <li key={service}>+ {service}</li>
                    ))}
                  </ul>
                  <p className="mt-4 text-[12px] font-semibold text-ink-700">Benefits</p>
                  <ul className="mt-2 space-y-1 text-[12px] leading-5 text-ink-600">
                    {plan.benefits.map((benefit) => (
                      <li key={benefit}>{benefit}</li>
                    ))}
                  </ul>
                  <p className="mt-auto pt-4 text-[11px] leading-4 text-ink-500">{plan.limitations[0]}</p>
                  <span className={`mt-4 flex h-9 items-center justify-center rounded-[8px] text-[13px] font-semibold ${
                    selected ? 'bg-primary text-white' : 'bg-ink-50 text-ink-700'
                  }`}>
                    {selected ? 'Selected' : 'Select plan'}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {!selectedPlanKey && !loadingPlans ? (
          <p className="text-[12px] text-ink-500">Select a plan to continue to operational details.</p>
        ) : null}

        <OnboardingBottomActionBar
          primaryLabel="Save plan and continue"
          onPrimary={() => void saveAndContinue()}
          primaryDisabled={saving || loadingPlans || !selectedPlanKey || Boolean(resolvedSession?.redirectStep)}
          primaryLoading={saving}
        />
      </div>
    </Card>
  );
}
