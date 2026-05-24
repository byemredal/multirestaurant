'use client';

import { useMemo, useState } from 'react';
import { Card, Input, Textarea } from '@lieferzonen/ui';
import {
  saveTenantOnboardingBusinessDetails,
  verifyTenantOnboardingBusinessRegistration,
  type TenantBusinessDetailsInput,
  type TenantOnboardingResolvedSession,
  type TenantOnboardingWorkspace,
} from '@/lib/tenant-onboarding-client';
import { getTenantOnboardingStepUrl } from './onboarding-routing';
import { OnboardingBottomActionBar } from './OnboardingBottomActionBar';
import { getBusinessDetailsFields } from './onboarding-country-pack';
import { StepHeader } from './shared/StepHeader';

type BusinessDetailsStepProps = {
  resolvedSession: TenantOnboardingResolvedSession | null;
  workspace: TenantOnboardingWorkspace;
  onWorkspaceResolved: (workspace: TenantOnboardingWorkspace) => void;
  onNavigate: (url: string) => void;
};

type BusinessDetailsErrors = Partial<Record<keyof TenantBusinessDetailsInput, string>>;

function getLegalData(workspace: TenantOnboardingWorkspace) {
  return workspace.steps.find((step) => step.stepKey === 'legal_tax_info')?.data as
    | {
        legalEntityName?: string | null;
        taxId?: string | null;
        vatId?: string | null;
        registrationCountry?: string | null;
        registeredAddress?: string | null;
      }
    | undefined;
}

function getBusinessAddress(workspace: TenantOnboardingWorkspace) {
  const businessInfo = workspace.steps.find((step) => step.stepKey === 'business_info')?.data as
    | {
        businessName?: string | null;
        addressLine1?: string | null;
        addressLine2?: string | null;
        city?: string | null;
        postalCode?: string | null;
        country?: string | null;
      }
    | undefined;

  return {
    businessName: businessInfo?.businessName ?? '',
    country: businessInfo?.country ?? 'CH',
    registeredAddress: [
      businessInfo?.addressLine1,
      businessInfo?.addressLine2,
      businessInfo?.postalCode,
      businessInfo?.city,
      businessInfo?.country,
    ].filter(Boolean).join(', '),
  };
}

function initialForm(workspace: TenantOnboardingWorkspace, resolvedSession: TenantOnboardingResolvedSession | null): TenantBusinessDetailsInput {
  const legalData = getLegalData(workspace);
  const businessAddress = getBusinessAddress(workspace);
  return {
    registrationNumber: legalData?.taxId ?? '',
    registeredBusinessName: legalData?.legalEntityName ?? businessAddress.businessName,
    legalForm: '',
    taxNumber: legalData?.taxId ?? '',
    vatRegistered: Boolean(legalData?.vatId),
    vatNumber: legalData?.vatId ?? '',
    registrationCountry: legalData?.registrationCountry ?? businessAddress.country ?? resolvedSession?.countryPack.country ?? 'CH',
    registeredAddress: legalData?.registeredAddress ?? businessAddress.registeredAddress,
    authorityName: '',
  };
}

function validateFullForm(form: TenantBusinessDetailsInput) {
  const errors: BusinessDetailsErrors = {};
  if (form.registrationNumber.trim().length < 3) {
    errors.registrationNumber = 'Registration number must be at least 3 characters.';
  }
  if (!form.registeredBusinessName.trim()) {
    errors.registeredBusinessName = 'Registered business name is required.';
  }
  if (!form.registrationCountry.trim() || !/^[A-Z]{2}$/.test(form.registrationCountry.trim().toUpperCase())) {
    errors.registrationCountry = 'Registration country must be an ISO-2 code.';
  }
  if (!form.registeredAddress.trim()) {
    errors.registeredAddress = 'Registered address is required.';
  }
  if (form.vatRegistered && !form.vatNumber?.trim()) {
    errors.vatNumber = 'VAT number is required when VAT registration is selected.';
  }
  return errors;
}

function normalizeForm(form: TenantBusinessDetailsInput): TenantBusinessDetailsInput {
  return {
    registrationNumber: form.registrationNumber.trim(),
    registeredBusinessName: form.registeredBusinessName.trim(),
    legalForm: form.legalForm?.trim() || null,
    taxNumber: form.taxNumber?.trim() || null,
    vatRegistered: Boolean(form.vatRegistered),
    vatNumber: form.vatRegistered ? form.vatNumber?.trim() || null : null,
    registrationCountry: form.registrationCountry.trim().toUpperCase(),
    registeredAddress: form.registeredAddress.trim(),
    authorityName: form.authorityName?.trim() || null,
  };
}

export function BusinessDetailsStep({
  resolvedSession,
  workspace,
  onWorkspaceResolved,
  onNavigate,
}: BusinessDetailsStepProps) {
  const [form, setForm] = useState<TenantBusinessDetailsInput>(() => initialForm(workspace, resolvedSession));
  const [verified, setVerified] = useState(() => form.registrationNumber.trim().length >= 3);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<BusinessDetailsErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const countryConfig = useMemo(
    () => getBusinessDetailsFields(resolvedSession?.countryPack),
    [resolvedSession?.countryPack],
  );
  const labelByKey = Object.fromEntries(countryConfig.fields.map((field) => [field.key, field.label])) as Record<string, string>;

  function updateField<K extends keyof TenantBusinessDetailsInput>(key: K, value: TenantBusinessDetailsInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    if (key === 'registrationNumber') {
      setVerified(false);
      setMessage(null);
    }
  }

  async function verifyRegistration() {
    if (form.registrationNumber.trim().length < 3) {
      setErrors({ registrationNumber: 'Registration number must be at least 3 characters.' });
      return;
    }

    setChecking(true);
    setSubmitError(null);
    try {
      const result = await verifyTenantOnboardingBusinessRegistration(workspace.stateToken, {
        registrationNumber: form.registrationNumber.trim(),
        country: form.registrationCountry.trim().toUpperCase() || resolvedSession?.countryPack.country || 'CH',
      });
      if (result.workspace) {
        onWorkspaceResolved(result.workspace);
      }
      if (result.redirectStep) {
        onNavigate(getTenantOnboardingStepUrl(workspace.stateToken, result.redirectStep));
        return;
      }
      setVerified(result.accepted);
      setMessage(result.message ?? 'Registration accepted for draft review.');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Registration could not be checked.');
    } finally {
      setChecking(false);
    }
  }

  async function saveAndContinue() {
    const validationErrors = validateFullForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    setSubmitError(null);
    try {
      const result = await saveTenantOnboardingBusinessDetails(workspace.stateToken, normalizeForm(form));
      onWorkspaceResolved(result.workspace);
      const nextStep = result.redirectStep ?? result.nextStep ?? result.session?.currentStep ?? 'authorized-person';
      onNavigate(getTenantOnboardingStepUrl(result.stateToken, nextStep));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Business details could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-0 bg-white p-0 shadow-none">
      <StepHeader
        stepIndex={2}
        totalSteps={0}
        status={workspace.steps.find((step) => step.stepKey === 'legal_tax_info')?.status ?? 'in_progress'}
        updatedAt={workspace.application.updatedAt}
        title="Business details"
        description="Enter commercial, legal, and tax registration information. Person/owner details stay separate for the authorized-person step."
      />

      <div className="grid gap-5">
        <div className="rounded-[18px] border border-[#f3d7ac] bg-[#fff8ed] px-4 py-4 text-[13px] leading-6 text-[#b54708]">
          {countryConfig.legalReviewNote}
        </div>

        {submitError ? (
          <div className="rounded-[14px] border border-danger-200 bg-danger-50 px-4 py-3 text-[13px] text-danger-600">
            {submitError}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-[14px] border border-[#bbf7d0] bg-[#ecfdf3] px-4 py-3 text-[13px] text-[#067647]">
            {message}
          </div>
        ) : null}

        <label className="block">
          <span className="mb-2 block text-[13px] font-semibold text-ink-700">
            {labelByKey.registrationNumber}
          </span>
          <Input
            value={form.registrationNumber}
            onChange={(event) => updateField('registrationNumber', event.target.value)}
            disabled={checking || saving}
            className={errors.registrationNumber ? 'border-danger-200' : ''}
          />
          {errors.registrationNumber ? (
            <span className="mt-1 block text-[12px] text-danger-600">{errors.registrationNumber}</span>
          ) : null}
        </label>

        {!verified ? (
          <OnboardingBottomActionBar
            primaryLabel="Check registration"
            onPrimary={() => void verifyRegistration()}
            primaryDisabled={checking || form.registrationNumber.trim().length < 3}
            primaryLoading={checking}
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[13px] font-semibold text-ink-700">{labelByKey.registeredBusinessName}</span>
                <Input
                  value={form.registeredBusinessName}
                  onChange={(event) => updateField('registeredBusinessName', event.target.value)}
                  disabled={saving}
                  className={errors.registeredBusinessName ? 'border-danger-200' : ''}
                />
                {errors.registeredBusinessName ? <span className="mt-1 block text-[12px] text-danger-600">{errors.registeredBusinessName}</span> : null}
              </label>

              <label className="block">
                <span className="mb-2 block text-[13px] font-semibold text-ink-700">{labelByKey.legalForm}</span>
                <Input value={form.legalForm ?? ''} onChange={(event) => updateField('legalForm', event.target.value)} disabled={saving} />
              </label>

              <label className="block">
                <span className="mb-2 block text-[13px] font-semibold text-ink-700">{labelByKey.taxNumber}</span>
                <Input value={form.taxNumber ?? ''} onChange={(event) => updateField('taxNumber', event.target.value)} disabled={saving} />
              </label>

              <label className="block">
                <span className="mb-2 block text-[13px] font-semibold text-ink-700">{labelByKey.registrationCountry}</span>
                <Input
                  value={form.registrationCountry}
                  maxLength={2}
                  onChange={(event) => updateField('registrationCountry', event.target.value.toUpperCase())}
                  disabled={saving}
                  className={errors.registrationCountry ? 'border-danger-200' : ''}
                />
                {errors.registrationCountry ? <span className="mt-1 block text-[12px] text-danger-600">{errors.registrationCountry}</span> : null}
              </label>
            </div>

            <label className="flex items-center gap-3 rounded-[14px] border border-ink-200 px-4 py-3 text-[14px] text-ink-700">
              <input
                type="checkbox"
                checked={Boolean(form.vatRegistered)}
                onChange={(event) => updateField('vatRegistered', event.target.checked)}
                disabled={saving}
              />
              VAT registered
            </label>

            {form.vatRegistered ? (
              <label className="block">
                <span className="mb-2 block text-[13px] font-semibold text-ink-700">{labelByKey.vatNumber}</span>
                <Input
                  value={form.vatNumber ?? ''}
                  onChange={(event) => updateField('vatNumber', event.target.value)}
                  disabled={saving}
                  className={errors.vatNumber ? 'border-danger-200' : ''}
                />
                {errors.vatNumber ? <span className="mt-1 block text-[12px] text-danger-600">{errors.vatNumber}</span> : null}
              </label>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-[13px] font-semibold text-ink-700">{labelByKey.registeredAddress}</span>
              <Textarea
                rows={3}
                value={form.registeredAddress}
                onChange={(event) => updateField('registeredAddress', event.target.value)}
                disabled={saving}
                className={errors.registeredAddress ? 'border-danger-200' : ''}
              />
              {errors.registeredAddress ? <span className="mt-1 block text-[12px] text-danger-600">{errors.registeredAddress}</span> : null}
            </label>

            <label className="block">
              <span className="mb-2 block text-[13px] font-semibold text-ink-700">Registry / tax authority name</span>
              <Input value={form.authorityName ?? ''} onChange={(event) => updateField('authorityName', event.target.value)} disabled={saving} />
            </label>

            <OnboardingBottomActionBar
              primaryLabel="Save business details"
              onPrimary={() => void saveAndContinue()}
              primaryDisabled={saving || Boolean(resolvedSession?.redirectStep)}
              primaryLoading={saving}
            />
          </>
        )}
      </div>
    </Card>
  );
}
