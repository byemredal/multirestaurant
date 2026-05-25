'use client';

import { useMemo, useState } from 'react';
import { Card, Input } from '@lieferzonen/ui';
import {
  saveTenantOnboardingOperations,
  type TenantOnboardingResolvedSession,
  type TenantOnboardingWorkspace,
  type TenantOperationsInfoInput,
} from '@/lib/tenant-onboarding-client';
import { getTenantOnboardingStepUrl } from './onboarding-routing';
import { OnboardingBottomActionBar } from './OnboardingBottomActionBar';
import { getOperationsCopy } from './onboarding-country-pack';
import { StepHeader } from './shared/StepHeader';
import { useOnboardingActionGuard } from './hooks/useOnboardingActionGuard';

type OperationsStepProps = {
  resolvedSession: TenantOnboardingResolvedSession | null;
  workspace: TenantOnboardingWorkspace;
  onWorkspaceResolved: (workspace: TenantOnboardingWorkspace) => void;
  onNavigate: (url: string) => void;
};

type OperationsErrors = Partial<Record<keyof TenantOperationsInfoInput, string>>;

function initialForm(workspace: TenantOnboardingWorkspace): TenantOperationsInfoInput {
  const operations = workspace.steps.find((step) => step.stepKey === 'operations_info')?.data as
    | Partial<TenantOperationsInfoInput>
    | null
    | undefined;
  const business = workspace.steps.find((step) => step.stepKey === 'business_info')?.data as
    | { city?: string | null; postalCode?: string | null }
    | null
    | undefined;

  return {
    primaryCity: operations?.primaryCity ?? business?.city ?? '',
    primaryPostalCode: operations?.primaryPostalCode ?? business?.postalCode ?? '',
    deliveryModel: operations?.deliveryModel ?? '',
    supportsPickup: operations?.supportsPickup ?? false,
    openingHoursSummary: operations?.openingHoursSummary ?? '',
    estimatedGoLiveDate: operations?.estimatedGoLiveDate
      ? String(operations.estimatedGoLiveDate).slice(0, 10)
      : '',
  };
}

function validateForm(form: TenantOperationsInfoInput) {
  const errors: OperationsErrors = {};
  if (!form.primaryCity?.trim()) errors.primaryCity = 'Primary city is required.';
  if (!form.primaryPostalCode?.trim()) errors.primaryPostalCode = 'Postal code is required.';
  if (!form.deliveryModel?.trim()) errors.deliveryModel = 'Choose an operating model.';
  return errors;
}

function normalizeForm(form: TenantOperationsInfoInput): TenantOperationsInfoInput {
  return {
    primaryCity: form.primaryCity?.trim() ?? '',
    primaryPostalCode: form.primaryPostalCode?.trim() ?? '',
    deliveryModel: form.deliveryModel?.trim() ?? '',
    supportsPickup: Boolean(form.supportsPickup),
    openingHoursSummary: form.openingHoursSummary?.trim() || undefined,
    estimatedGoLiveDate: form.estimatedGoLiveDate?.trim() || undefined,
  };
}

export function OperationsStep({
  resolvedSession,
  workspace,
  onWorkspaceResolved,
  onNavigate,
}: OperationsStepProps) {
  const [form, setForm] = useState<TenantOperationsInfoInput>(() => initialForm(workspace));
  const [errors, setErrors] = useState<OperationsErrors>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const runOnce = useOnboardingActionGuard();
  const copy = useMemo(() => getOperationsCopy(resolvedSession?.countryPack), [resolvedSession?.countryPack]);
  const status = workspace.steps.find((step) => step.stepKey === 'operations_info')?.status ?? 'in_progress';

  function updateField<K extends keyof TenantOperationsInfoInput>(key: K, value: TenantOperationsInfoInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function saveAndContinue() {
    const validationErrors = validateForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    await runOnce(async () => {
      setSaving(true);
      setSubmitError(null);
      try {
        const result = await saveTenantOnboardingOperations(workspace.stateToken, normalizeForm(form));
        onWorkspaceResolved(result.workspace);
        const nextStep = result.redirectStep ?? result.nextStep ?? result.session?.currentStep ?? 'verification';
        onNavigate(getTenantOnboardingStepUrl(workspace.stateToken, nextStep));
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Operational details could not be saved.');
      } finally {
        setSaving(false);
      }
    });
  }

  return (
    <Card className="border-0 bg-white p-0 shadow-none">
      <StepHeader
        stepIndex={7}
        totalSteps={0}
        status={status}
        updatedAt={workspace.application.updatedAt}
        title={copy.title}
        description={copy.helperText}
      />

      <div className="grid gap-5">
        <div className="rounded-[8px] border border-primary-100 bg-primary-50 px-4 py-4 text-[13px] leading-6 text-primary-700">
          {copy.note}
        </div>

        {submitError ? (
          <div className="rounded-[8px] border border-danger-200 bg-danger-50 px-4 py-3 text-[13px] text-danger-600">
            {submitError}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">Primary operating city</span>
            <Input
              value={form.primaryCity ?? ''}
              onChange={(event) => updateField('primaryCity', event.target.value)}
              disabled={saving}
              className={errors.primaryCity ? 'border-danger-200' : ''}
            />
            {errors.primaryCity ? <span className="mt-1 block text-[12px] text-danger-600">{errors.primaryCity}</span> : null}
          </label>

          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">Postal code</span>
            <Input
              value={form.primaryPostalCode ?? ''}
              onChange={(event) => updateField('primaryPostalCode', event.target.value)}
              disabled={saving}
              className={errors.primaryPostalCode ? 'border-danger-200' : ''}
            />
            {errors.primaryPostalCode ? <span className="mt-1 block text-[12px] text-danger-600">{errors.primaryPostalCode}</span> : null}
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">Operating model</span>
            <select
              value={form.deliveryModel ?? ''}
              onChange={(event) => updateField('deliveryModel', event.target.value)}
              disabled={saving}
              className={`h-11 w-full rounded-[8px] border bg-white px-3 text-[14px] text-ink-800 outline-none focus:border-primary ${
                errors.deliveryModel ? 'border-danger-200' : 'border-ink-200'
              }`}
            >
              <option value="">Select an operating model</option>
              {copy.deliveryModels.map((model) => (
                <option key={model.value} value={model.value}>{model.label}</option>
              ))}
            </select>
            {errors.deliveryModel ? <span className="mt-1 block text-[12px] text-danger-600">{errors.deliveryModel}</span> : null}
          </label>

          <label className="flex items-start gap-3 rounded-[8px] border border-ink-200 px-4 py-3 text-[14px] text-ink-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={Boolean(form.supportsPickup)}
              onChange={(event) => updateField('supportsPickup', event.target.checked)}
              disabled={saving}
              className="mt-1"
            />
            <span>
              <span className="block font-semibold">Pickup is available</span>
              <span className="mt-1 block text-[12px] leading-5 text-ink-500">
                Select this when customers can collect orders from the business location.
              </span>
            </span>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">Opening hours summary</span>
            <textarea
              value={form.openingHoursSummary ?? ''}
              onChange={(event) => updateField('openingHoursSummary', event.target.value)}
              disabled={saving}
              rows={3}
              className="w-full rounded-[8px] border border-ink-200 bg-white px-3 py-2.5 text-[14px] text-ink-800 outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">Estimated go-live date</span>
            <Input
              type="date"
              value={form.estimatedGoLiveDate ?? ''}
              onChange={(event) => updateField('estimatedGoLiveDate', event.target.value)}
              disabled={saving}
            />
          </label>
        </div>

        <OnboardingBottomActionBar
          primaryLabel="Save operations and continue"
          onPrimary={() => void saveAndContinue()}
          primaryDisabled={saving || Boolean(resolvedSession?.redirectStep)}
          primaryLoading={saving}
        />
      </div>
    </Card>
  );
}
