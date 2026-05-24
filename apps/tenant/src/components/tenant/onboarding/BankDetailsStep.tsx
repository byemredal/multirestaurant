'use client';

import { useMemo, useState } from 'react';
import { Card, Input } from '@lieferzonen/ui';
import {
  saveTenantOnboardingBankDetails,
  type TenantBankDetailsInput,
  type TenantOnboardingResolvedSession,
  type TenantOnboardingWorkspace,
} from '@/lib/tenant-onboarding-client';
import { getTenantOnboardingStepUrl } from './onboarding-routing';
import { OnboardingBottomActionBar } from './OnboardingBottomActionBar';
import { getBankDetailsFields } from './onboarding-country-pack';
import { StepHeader } from './shared/StepHeader';

type BankDetailsStepProps = {
  resolvedSession: TenantOnboardingResolvedSession | null;
  workspace: TenantOnboardingWorkspace;
  onWorkspaceResolved: (workspace: TenantOnboardingWorkspace) => void;
  onNavigate: (url: string) => void;
};

type BankDetailsErrors = Partial<Record<keyof TenantBankDetailsInput, string>>;

function getStepData<T extends object>(workspace: TenantOnboardingWorkspace, stepKey: string) {
  return workspace.steps.find((step) => step.stepKey === stepKey)?.data as T | null | undefined;
}

function initialForm(
  workspace: TenantOnboardingWorkspace,
  resolvedSession: TenantOnboardingResolvedSession | null,
): TenantBankDetailsInput {
  const bank = getStepData<Partial<TenantBankDetailsInput>>(workspace, 'bank_details');
  const legal = getStepData<{ legalEntityName?: string | null }>(workspace, 'legal_tax_info');
  const owner = getStepData<{ fullName?: string | null }>(workspace, 'owner_contact_info');

  return {
    bankName: bank?.bankName ?? '',
    accountHolderName: bank?.accountHolderName ?? legal?.legalEntityName ?? owner?.fullName ?? '',
    iban: bank?.iban ?? '',
    currency: bank?.currency ?? resolvedSession?.countryPack.currency ?? 'CHF',
  };
}

function validateForm(form: TenantBankDetailsInput) {
  const errors: BankDetailsErrors = {};
  const iban = form.iban.trim().replace(/\s+/g, '').toUpperCase();
  if (!form.bankName.trim()) {
    errors.bankName = 'Bank name is required.';
  }
  if (!form.accountHolderName.trim()) {
    errors.accountHolderName = 'Account holder name is required.';
  }
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(iban)) {
    errors.iban = 'Enter a valid basic IBAN format.';
  }
  if (!form.currency?.trim() || !/^[A-Z]{3}$/.test(form.currency.trim().toUpperCase())) {
    errors.currency = 'Currency must be a 3-letter code.';
  }
  return errors;
}

function normalizeForm(form: TenantBankDetailsInput): TenantBankDetailsInput {
  return {
    bankName: form.bankName.trim(),
    accountHolderName: form.accountHolderName.trim(),
    iban: form.iban.trim().replace(/\s+/g, '').toUpperCase(),
    currency: form.currency?.trim().toUpperCase() || 'CHF',
  };
}

export function BankDetailsStep({
  resolvedSession,
  workspace,
  onWorkspaceResolved,
  onNavigate,
}: BankDetailsStepProps) {
  const [form, setForm] = useState<TenantBankDetailsInput>(() => initialForm(workspace, resolvedSession));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<BankDetailsErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const config = useMemo(() => getBankDetailsFields(resolvedSession?.countryPack), [resolvedSession?.countryPack]);
  const labelByKey = Object.fromEntries(config.fields.map((field) => [field.key, field.label])) as Record<string, string>;
  const helpByKey = Object.fromEntries(config.fields.map((field) => [field.key, field.helpText])) as Record<string, string | undefined>;
  const status = workspace.steps.find((step) => step.stepKey === 'bank_details')?.status ?? 'in_progress';

  function updateField<K extends keyof TenantBankDetailsInput>(key: K, value: TenantBankDetailsInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function saveAndContinue() {
    const validationErrors = validateForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    setSubmitError(null);
    try {
      const result = await saveTenantOnboardingBankDetails(workspace.stateToken, normalizeForm(form));
      onWorkspaceResolved(result.workspace);
      const nextStep = result.redirectStep ?? result.nextStep ?? result.session?.currentStep ?? 'billing-address';
      onNavigate(getTenantOnboardingStepUrl(result.stateToken, nextStep));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Bank details could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-0 bg-white p-0 shadow-none">
      <StepHeader
        stepIndex={4}
        totalSteps={0}
        status={status}
        updatedAt={workspace.application.updatedAt}
        title="Bank details"
        description="Add the payout account details for this partner onboarding draft. Plan selection remains separate."
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

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">{labelByKey.bankName}</span>
            <Input value={form.bankName} onChange={(event) => updateField('bankName', event.target.value)} disabled={saving} className={errors.bankName ? 'border-danger-200' : ''} />
            {errors.bankName ? <span className="mt-1 block text-[12px] text-danger-600">{errors.bankName}</span> : null}
          </label>

          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">{labelByKey.accountHolderName}</span>
            <Input value={form.accountHolderName} onChange={(event) => updateField('accountHolderName', event.target.value)} disabled={saving} className={errors.accountHolderName ? 'border-danger-200' : ''} />
            {errors.accountHolderName ? <span className="mt-1 block text-[12px] text-danger-600">{errors.accountHolderName}</span> : null}
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">{labelByKey.iban}</span>
            <Input value={form.iban} onChange={(event) => updateField('iban', event.target.value.toUpperCase())} disabled={saving} className={errors.iban ? 'border-danger-200' : ''} />
            <span className={`mt-1 block text-[12px] ${errors.iban ? 'text-danger-600' : 'text-ink-500'}`}>
              {errors.iban ?? helpByKey.iban}
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">{labelByKey.currency}</span>
            <Input value={form.currency ?? ''} maxLength={3} onChange={(event) => updateField('currency', event.target.value.toUpperCase())} disabled={saving} className={errors.currency ? 'border-danger-200' : ''} />
            <span className={`mt-1 block text-[12px] ${errors.currency ? 'text-danger-600' : 'text-ink-500'}`}>
              {errors.currency ?? helpByKey.currency}
            </span>
          </label>
        </div>

        <OnboardingBottomActionBar
          primaryLabel="Save bank details"
          onPrimary={() => void saveAndContinue()}
          primaryDisabled={saving || Boolean(resolvedSession?.redirectStep)}
          primaryLoading={saving}
        />
      </div>
    </Card>
  );
}
