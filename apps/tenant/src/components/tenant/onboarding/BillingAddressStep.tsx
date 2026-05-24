'use client';

import { useMemo, useState } from 'react';
import { Card, Input } from '@lieferzonen/ui';
import {
  saveTenantOnboardingBillingAddress,
  type TenantBillingAddressInput,
  type TenantOnboardingResolvedSession,
  type TenantOnboardingWorkspace,
} from '@/lib/tenant-onboarding-client';
import { getTenantOnboardingStepUrl } from './onboarding-routing';
import { OnboardingBottomActionBar } from './OnboardingBottomActionBar';
import { getBillingAddressFields } from './onboarding-country-pack';
import { StepHeader } from './shared/StepHeader';
import { useOnboardingActionGuard } from './hooks/useOnboardingActionGuard';

type BillingAddressStepProps = {
  resolvedSession: TenantOnboardingResolvedSession | null;
  workspace: TenantOnboardingWorkspace;
  onWorkspaceResolved: (workspace: TenantOnboardingWorkspace) => void;
  onNavigate: (url: string) => void;
};

type BillingAddressErrors = Partial<Record<keyof TenantBillingAddressInput, string>>;

type BusinessInfoData = {
  businessName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

function getStepData<T extends object>(workspace: TenantOnboardingWorkspace, stepKey: string) {
  return workspace.steps.find((step) => step.stepKey === stepKey)?.data as T | null | undefined;
}

function getBusinessAddress(workspace: TenantOnboardingWorkspace) {
  const business = getStepData<BusinessInfoData>(workspace, 'business_info');
  return {
    billingName: business?.businessName ?? '',
    country: business?.country ?? 'CH',
    city: business?.city ?? '',
    postalCode: business?.postalCode ?? '',
    addressLine1: business?.addressLine1 ?? '',
    addressLine2: business?.addressLine2 ?? '',
  };
}

function initialForm(workspace: TenantOnboardingWorkspace): TenantBillingAddressInput {
  const billing = getStepData<Partial<TenantBillingAddressInput>>(workspace, 'billing_address');
  const business = getBusinessAddress(workspace);
  return {
    useBusinessAddress: billing?.useBusinessAddress ?? false,
    billingName: billing?.billingName ?? business.billingName,
    country: billing?.country ?? business.country,
    city: billing?.city ?? business.city,
    postalCode: billing?.postalCode ?? business.postalCode,
    addressLine1: billing?.addressLine1 ?? business.addressLine1,
    addressLine2: billing?.addressLine2 ?? business.addressLine2,
  };
}

function validateForm(form: TenantBillingAddressInput) {
  const errors: BillingAddressErrors = {};
  if (!form.billingName.trim()) errors.billingName = 'Billing name is required.';
  if (!/^[A-Z]{2}$/.test(form.country.trim().toUpperCase())) errors.country = 'Country must be an ISO-2 code.';
  if (!form.city.trim()) errors.city = 'City or region is required.';
  if (!form.postalCode.trim()) errors.postalCode = 'Postal code is required.';
  if (!form.addressLine1.trim()) errors.addressLine1 = 'Address line 1 is required.';
  return errors;
}

function normalizeForm(form: TenantBillingAddressInput): TenantBillingAddressInput {
  return {
    useBusinessAddress: Boolean(form.useBusinessAddress),
    billingName: form.billingName.trim(),
    country: form.country.trim().toUpperCase(),
    city: form.city.trim(),
    postalCode: form.postalCode.trim(),
    addressLine1: form.addressLine1.trim(),
    addressLine2: form.addressLine2?.trim() || null,
  };
}

export function BillingAddressStep({
  resolvedSession,
  workspace,
  onWorkspaceResolved,
  onNavigate,
}: BillingAddressStepProps) {
  const [form, setForm] = useState<TenantBillingAddressInput>(() => initialForm(workspace));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<BillingAddressErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const runOnce = useOnboardingActionGuard();
  const config = useMemo(() => getBillingAddressFields(), []);
  const labelByKey = Object.fromEntries(config.fields.map((field) => [field.key, field.label])) as Record<string, string>;
  const status = workspace.steps.find((step) => step.stepKey === 'billing_address')?.status ?? 'in_progress';

  function updateField<K extends keyof TenantBillingAddressInput>(key: K, value: TenantBillingAddressInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function useBusinessAddress() {
    const business = getBusinessAddress(workspace);
    setForm({
      useBusinessAddress: true,
      billingName: business.billingName,
      country: business.country,
      city: business.city,
      postalCode: business.postalCode,
      addressLine1: business.addressLine1,
      addressLine2: business.addressLine2,
    });
    setErrors({});
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
        const result = await saveTenantOnboardingBillingAddress(workspace.stateToken, normalizeForm(form));
        onWorkspaceResolved(result.workspace);
        const nextStep = result.redirectStep ?? result.nextStep ?? result.session?.currentStep ?? 'plan-selection';
        onNavigate(getTenantOnboardingStepUrl(workspace.stateToken, nextStep));
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Billing address could not be saved.');
      } finally {
        setSaving(false);
      }
    });
  }

  return (
    <Card className="border-0 bg-white p-0 shadow-none">
      <StepHeader
        stepIndex={5}
        totalSteps={0}
        status={status}
        updatedAt={workspace.application.updatedAt}
        title="Billing address"
        description="Add the invoice address for this partner account. It is saved separately from the physical business location."
      />

      <div className="grid gap-5">
        <div className="rounded-[18px] border border-primary-100 bg-primary-50 px-4 py-4 text-[13px] leading-6 text-primary-700">
          {config.helperText}
        </div>

        {submitError ? (
          <div className="rounded-[14px] border border-danger-200 bg-danger-50 px-4 py-3 text-[13px] text-danger-600">
            {submitError}
          </div>
        ) : null}

        <label className="flex items-start gap-3 rounded-[14px] border border-ink-200 px-4 py-3 text-[14px] text-ink-700">
          <input
            type="checkbox"
            checked={Boolean(form.useBusinessAddress)}
            onChange={(event) => {
              if (event.target.checked) {
                useBusinessAddress();
              } else {
                updateField('useBusinessAddress', false);
              }
            }}
            disabled={saving}
            className="mt-1"
          />
          <span>
            <span className="block font-semibold">{labelByKey.useBusinessAddress}</span>
            <span className="mt-1 block text-[12px] leading-5 text-ink-500">
              Prefill and save a billing snapshot from the completed business address.
            </span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">{labelByKey.billingName}</span>
            <Input value={form.billingName} onChange={(event) => updateField('billingName', event.target.value)} disabled={saving} className={errors.billingName ? 'border-danger-200' : ''} />
            {errors.billingName ? <span className="mt-1 block text-[12px] text-danger-600">{errors.billingName}</span> : null}
          </label>

          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">{labelByKey.country}</span>
            <Input value={form.country} maxLength={2} onChange={(event) => updateField('country', event.target.value.toUpperCase())} disabled={saving} className={errors.country ? 'border-danger-200' : ''} />
            {errors.country ? <span className="mt-1 block text-[12px] text-danger-600">{errors.country}</span> : null}
          </label>

          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">{labelByKey.city}</span>
            <Input value={form.city} onChange={(event) => updateField('city', event.target.value)} disabled={saving} className={errors.city ? 'border-danger-200' : ''} />
            {errors.city ? <span className="mt-1 block text-[12px] text-danger-600">{errors.city}</span> : null}
          </label>

          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">{labelByKey.postalCode}</span>
            <Input value={form.postalCode} onChange={(event) => updateField('postalCode', event.target.value)} disabled={saving} className={errors.postalCode ? 'border-danger-200' : ''} />
            {errors.postalCode ? <span className="mt-1 block text-[12px] text-danger-600">{errors.postalCode}</span> : null}
          </label>

          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">{labelByKey.addressLine1}</span>
            <Input value={form.addressLine1} onChange={(event) => updateField('addressLine1', event.target.value)} disabled={saving} className={errors.addressLine1 ? 'border-danger-200' : ''} />
            {errors.addressLine1 ? <span className="mt-1 block text-[12px] text-danger-600">{errors.addressLine1}</span> : null}
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">{labelByKey.addressLine2}</span>
            <Input value={form.addressLine2 ?? ''} onChange={(event) => updateField('addressLine2', event.target.value)} disabled={saving} />
          </label>
        </div>

        <OnboardingBottomActionBar
          primaryLabel="Save billing address"
          onPrimary={() => void saveAndContinue()}
          primaryDisabled={saving || Boolean(resolvedSession?.redirectStep)}
          primaryLoading={saving}
        />
      </div>
    </Card>
  );
}
