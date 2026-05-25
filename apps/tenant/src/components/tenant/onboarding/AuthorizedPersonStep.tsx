'use client';

import { useMemo, useState } from 'react';
import { Card, Input } from '@lieferzonen/ui';
import {
  saveTenantOnboardingAuthorizedPerson,
  type TenantAuthorizedPersonInput,
  type TenantOnboardingResolvedSession,
  type TenantOnboardingWorkspace,
} from '@/lib/tenant-onboarding-client';
import { getTenantOnboardingStepUrl } from './onboarding-routing';
import { OnboardingBottomActionBar } from './OnboardingBottomActionBar';
import { getAuthorizedPersonFields } from './onboarding-country-pack';
import { StepHeader } from './shared/StepHeader';
import { useOnboardingActionGuard } from './hooks/useOnboardingActionGuard';

type AuthorizedPersonStepProps = {
  resolvedSession: TenantOnboardingResolvedSession | null;
  workspace: TenantOnboardingWorkspace;
  onWorkspaceResolved: (workspace: TenantOnboardingWorkspace) => void;
  onNavigate: (url: string) => void;
};

type AuthorizedPersonErrors = Partial<Record<keyof TenantAuthorizedPersonInput, string>>;

function getOwnerData(workspace: TenantOnboardingWorkspace) {
  return workspace.steps.find((step) => step.stepKey === 'owner_contact_info')?.data as
    | {
        fullName?: string | null;
        email?: string | null;
        phoneNumber?: string | null;
        roleTitle?: string | null;
        ownershipPercentage?: number | null;
      }
    | undefined;
}

function initialForm(workspace: TenantOnboardingWorkspace): TenantAuthorizedPersonInput {
  const owner = getOwnerData(workspace);
  return {
    fullName: owner?.fullName ?? '',
    email: owner?.email ?? '',
    phoneNumber: owner?.phoneNumber ?? workspace.phoneVerification?.phoneNumber ?? '',
    roleTitle: owner?.roleTitle ?? '',
    ownershipPercentage: owner?.ownershipPercentage ?? null,
  };
}

function validateForm(form: TenantAuthorizedPersonInput) {
  const errors: AuthorizedPersonErrors = {};
  const email = form.email.trim();
  if (!form.fullName.trim()) {
    errors.fullName = 'Full name is required.';
  }
  if (!email) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (!form.phoneNumber.trim()) {
    errors.phoneNumber = 'Phone number is required.';
  }
  if (
    form.ownershipPercentage !== null &&
    form.ownershipPercentage !== undefined &&
    (Number.isNaN(form.ownershipPercentage) || form.ownershipPercentage < 0 || form.ownershipPercentage > 100)
  ) {
    errors.ownershipPercentage = 'Ownership share must be between 0 and 100.';
  }
  return errors;
}

function normalizeForm(form: TenantAuthorizedPersonInput): TenantAuthorizedPersonInput {
  return {
    fullName: form.fullName.trim(),
    email: form.email.trim().toLowerCase(),
    phoneNumber: form.phoneNumber.trim(),
    roleTitle: form.roleTitle?.trim() || null,
    ownershipPercentage: form.ownershipPercentage ?? null,
  };
}

export function AuthorizedPersonStep({
  resolvedSession,
  workspace,
  onWorkspaceResolved,
  onNavigate,
}: AuthorizedPersonStepProps) {
  const [form, setForm] = useState<TenantAuthorizedPersonInput>(() => initialForm(workspace));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<AuthorizedPersonErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const runOnce = useOnboardingActionGuard();
  const countryConfig = useMemo(
    () => getAuthorizedPersonFields(resolvedSession?.countryPack),
    [resolvedSession?.countryPack],
  );
  const labelByKey = Object.fromEntries(countryConfig.fields.map((field) => [field.key, field.label])) as Record<string, string>;
  const helpByKey = Object.fromEntries(countryConfig.fields.map((field) => [field.key, field.helpText])) as Record<string, string | undefined>;

  function updateField<K extends keyof TenantAuthorizedPersonInput>(key: K, value: TenantAuthorizedPersonInput[K]) {
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
      let navigating = false;
      setSaving(true);
      setSubmitError(null);
      try {
        const result = await saveTenantOnboardingAuthorizedPerson(workspace.stateToken, normalizeForm(form));
        onWorkspaceResolved(result.workspace);
        const nextStep = result.redirectStep ?? result.nextStep ?? result.session?.currentStep ?? 'bank-details';
        navigating = true;
        onNavigate(getTenantOnboardingStepUrl(workspace.stateToken, nextStep));
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Authorized person details could not be saved.');
      } finally {
        if (!navigating) {
          setSaving(false);
        }
      }
    });
  }

  const ownerStatus = workspace.steps.find((step) => step.stepKey === 'owner_contact_info')?.status ?? 'in_progress';

  return (
    <Card className="border-0 bg-white p-0 shadow-none">
      <StepHeader
        stepIndex={3}
        totalSteps={0}
        status={ownerStatus}
        updatedAt={workspace.application.updatedAt}
        title="Authorized person"
        description="Add the owner, authorized representative, or signatory contact for this onboarding application. Commercial and tax details stay in the previous business-details step."
      />

      <div className="grid gap-5">
        <div className="rounded-[8px] border border-primary-100 bg-primary-50 px-4 py-4 text-[13px] leading-6 text-primary-700">
          {countryConfig.guidance}
        </div>

        <div className="rounded-[8px] border border-[#f3d7ac] bg-[#fff8ed] px-4 py-4 text-[13px] leading-6 text-[#b54708]">
          {countryConfig.legalReviewNote}
        </div>

        {submitError ? (
          <div className="rounded-[8px] border border-danger-200 bg-danger-50 px-4 py-3 text-[13px] text-danger-600">
            {submitError}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">{labelByKey.fullName}</span>
            <Input
              value={form.fullName}
              onChange={(event) => updateField('fullName', event.target.value)}
              disabled={saving}
              className={errors.fullName ? 'border-danger-200' : ''}
            />
            {errors.fullName ? <span className="mt-1 block text-[12px] text-danger-600">{errors.fullName}</span> : null}
          </label>

          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">{labelByKey.email}</span>
            <Input
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              disabled={saving}
              className={errors.email ? 'border-danger-200' : ''}
            />
            {errors.email ? <span className="mt-1 block text-[12px] text-danger-600">{errors.email}</span> : null}
          </label>

          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">{labelByKey.phoneNumber}</span>
            <Input
              inputMode="tel"
              value={form.phoneNumber}
              onChange={(event) => updateField('phoneNumber', event.target.value)}
              disabled={saving}
              className={errors.phoneNumber ? 'border-danger-200' : ''}
            />
            {errors.phoneNumber ? <span className="mt-1 block text-[12px] text-danger-600">{errors.phoneNumber}</span> : null}
          </label>

          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">{labelByKey.roleTitle}</span>
            <Input
              value={form.roleTitle ?? ''}
              onChange={(event) => updateField('roleTitle', event.target.value)}
              disabled={saving}
            />
            {helpByKey.roleTitle ? <span className="mt-1 block text-[12px] text-ink-500">{helpByKey.roleTitle}</span> : null}
          </label>

          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">{labelByKey.ownershipPercentage}</span>
            <Input
              inputMode="decimal"
              value={form.ownershipPercentage ?? ''}
              onChange={(event) => {
                const value = event.target.value.trim();
                updateField('ownershipPercentage', value ? Number(value) : null);
              }}
              disabled={saving}
              className={errors.ownershipPercentage ? 'border-danger-200' : ''}
            />
            {errors.ownershipPercentage ? (
              <span className="mt-1 block text-[12px] text-danger-600">{errors.ownershipPercentage}</span>
            ) : helpByKey.ownershipPercentage ? (
              <span className="mt-1 block text-[12px] text-ink-500">{helpByKey.ownershipPercentage}</span>
            ) : null}
          </label>
        </div>

        <OnboardingBottomActionBar
          primaryLabel="Save authorized person"
          onPrimary={() => void saveAndContinue()}
          primaryDisabled={saving || Boolean(resolvedSession?.redirectStep)}
          primaryLoading={saving}
        />
      </div>
    </Card>
  );
}
