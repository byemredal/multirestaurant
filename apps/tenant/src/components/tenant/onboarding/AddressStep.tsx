'use client';

import { useState } from 'react';
import { Card, Input, Textarea } from '@lieferzonen/ui';
import {
  saveTenantOnboardingAddress,
  type TenantAddressInput,
  type TenantOnboardingResolvedSession,
  type TenantOnboardingWorkspace,
} from '@/lib/tenant-onboarding-client';
import { getTenantOnboardingStepUrl } from './onboarding-routing';
import { OnboardingBottomActionBar } from './OnboardingBottomActionBar';
import { StepHeader } from './shared/StepHeader';
import { useOnboardingActionGuard } from './hooks/useOnboardingActionGuard';

type AddressStepProps = {
  resolvedSession: TenantOnboardingResolvedSession | null;
  workspace: TenantOnboardingWorkspace;
  onWorkspaceResolved: (workspace: TenantOnboardingWorkspace) => void;
  onNavigate: (url: string) => void;
};

type AddressErrors = Partial<Record<keyof TenantAddressInput, string>>;

function getBusinessInfo(workspace: TenantOnboardingWorkspace) {
  return workspace.steps.find((step) => step.stepKey === 'business_info')?.data as
    | Partial<TenantAddressInput>
    | undefined;
}

function getInitialAddress(workspace: TenantOnboardingWorkspace, resolvedSession: TenantOnboardingResolvedSession | null): TenantAddressInput {
  const businessInfo = getBusinessInfo(workspace);
  const location = workspace.locationSelection;
  return {
    // Single-country platform: the active CountryPack country is authoritative
    // and pinned — stale values from business info / location must not override it.
    country: String(resolvedSession?.countryPack.country ?? businessInfo?.country ?? location?.country ?? ''),
    city: String(businessInfo?.city ?? location?.city ?? ''),
    region: '',
    postalCode: String(businessInfo?.postalCode ?? location?.postalCode ?? ''),
    addressLine1: String(businessInfo?.addressLine1 ?? location?.rawInput ?? location?.locationLabel ?? ''),
    addressLine2: businessInfo?.addressLine2 ? String(businessInfo.addressLine2) : '',
    building: '',
    floor: '',
    door: '',
    addressNote: '',
  };
}

function validateAddress(form: TenantAddressInput) {
  const errors: AddressErrors = {};
  if (!form.country.trim() || !/^[A-Z]{2}$/.test(form.country.trim().toUpperCase())) {
    errors.country = 'Ülke kodu ISO-2 formatında olmalıdır.';
  }
  if (!form.city.trim()) errors.city = 'Şehir / bölge zorunludur.';
  if (!form.postalCode.trim()) errors.postalCode = 'Posta kodu zorunludur.';
  if (!form.addressLine1.trim()) errors.addressLine1 = 'Adres satırı zorunludur.';
  return errors;
}

function normalizeAddress(form: TenantAddressInput): TenantAddressInput {
  return {
    country: form.country.trim().toUpperCase(),
    city: form.city.trim(),
    region: form.region?.trim() || null,
    postalCode: form.postalCode.trim(),
    addressLine1: form.addressLine1.trim(),
    addressLine2: form.addressLine2?.trim() || null,
    building: form.building?.trim() || null,
    floor: form.floor?.trim() || null,
    door: form.door?.trim() || null,
    addressNote: form.addressNote?.trim() || null,
  };
}

export function AddressStep({
  resolvedSession,
  workspace,
  onWorkspaceResolved,
  onNavigate,
}: AddressStepProps) {
  const [form, setForm] = useState<TenantAddressInput>(() => getInitialAddress(workspace, resolvedSession));
  const [errors, setErrors] = useState<AddressErrors>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const runOnce = useOnboardingActionGuard();
  const location = workspace.locationSelection;

  function updateField<K extends keyof TenantAddressInput>(key: K, value: TenantAddressInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function saveAndContinue() {
    const validationErrors = validateAddress(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setSubmitError(null);
      return;
    }

    await runOnce(async () => {
      let navigating = false;
      setSaving(true);
      setSubmitError(null);
      try {
        const result = await saveTenantOnboardingAddress(workspace.stateToken, normalizeAddress(form));
        onWorkspaceResolved(result.workspace);
        const nextStep = result.redirectStep ?? result.nextStep ?? result.session?.currentStep ?? 'business-details';
        navigating = true;
        onNavigate(getTenantOnboardingStepUrl(workspace.stateToken, nextStep));
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Adres kaydedilemedi.');
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
        stepIndex={1}
        totalSteps={0}
        status={getBusinessInfo(workspace) ? 'in_progress' : 'not_started'}
        updatedAt={workspace.application.updatedAt}
        title="İşletme adresi"
        description="Konum seçiminizden sonra tam adres alanlarını tamamlayın. Bu bilgiler inceleme ve işletme profiliniz için kaydedilir."
      />

      <div className="grid gap-5">
        {location ? (
          <div className="rounded-[8px] border border-primary-100 bg-primary-50 px-4 py-4 text-[14px] leading-6 text-primary-700">
            <strong className="font-semibold">Seçilen konum:</strong> {location.locationLabel}
            {location.country ? <span> ({location.country})</span> : null}
          </div>
        ) : (
          <div className="rounded-[8px] border border-[#f3d7ac] bg-[#fff8ed] px-4 py-3 text-[13px] text-[#b54708]">
            Önce konum seçimi tamamlanmalıdır. Sistem bu sayfayı normalde konum adımına yönlendirir.
          </div>
        )}

        {submitError ? (
          <div className="rounded-[8px] border border-danger-200 bg-danger-50 px-4 py-3 text-[13px] text-danger-600">
            {submitError}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">Ülke</span>
            <Input
              value={form.country}
              readOnly
              disabled
              title="Ülke, platformun aktif ülkesine sabittir."
              className={errors.country ? 'border-danger-200' : ''}
            />
            {errors.country ? <span className="mt-1 block text-[12px] text-danger-600">{errors.country}</span> : null}
          </label>

          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">Şehir / kanton / bölge</span>
            <Input
              value={form.city}
              onChange={(event) => updateField('city', event.target.value)}
              disabled={saving}
              className={errors.city ? 'border-danger-200' : ''}
            />
            {errors.city ? <span className="mt-1 block text-[12px] text-danger-600">{errors.city}</span> : null}
          </label>

          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">Posta kodu</span>
            <Input
              value={form.postalCode}
              onChange={(event) => updateField('postalCode', event.target.value)}
              disabled={saving}
              className={errors.postalCode ? 'border-danger-200' : ''}
            />
            {errors.postalCode ? <span className="mt-1 block text-[12px] text-danger-600">{errors.postalCode}</span> : null}
          </label>

          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">Bölge / kanton</span>
            <Input
              value={form.region ?? ''}
              onChange={(event) => updateField('region', event.target.value)}
              disabled={saving}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-[13px] font-semibold text-ink-700">Adres satırı 1</span>
          <Input
            value={form.addressLine1}
            onChange={(event) => updateField('addressLine1', event.target.value)}
            disabled={saving}
            className={errors.addressLine1 ? 'border-danger-200' : ''}
          />
          {errors.addressLine1 ? <span className="mt-1 block text-[12px] text-danger-600">{errors.addressLine1}</span> : null}
        </label>

        <label className="block">
          <span className="mb-2 block text-[13px] font-semibold text-ink-700">Adres satırı 2</span>
          <Input
            value={form.addressLine2 ?? ''}
            onChange={(event) => updateField('addressLine2', event.target.value)}
            disabled={saving}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">Bina</span>
            <Input value={form.building ?? ''} onChange={(event) => updateField('building', event.target.value)} disabled={saving} />
          </label>
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">Kat</span>
            <Input value={form.floor ?? ''} onChange={(event) => updateField('floor', event.target.value)} disabled={saving} />
          </label>
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-ink-700">Kapı</span>
            <Input value={form.door ?? ''} onChange={(event) => updateField('door', event.target.value)} disabled={saving} />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-[13px] font-semibold text-ink-700">Adres notu</span>
          <Textarea
            value={form.addressNote ?? ''}
            onChange={(event) => updateField('addressNote', event.target.value)}
            disabled={saving}
            rows={3}
          />
        </label>
      </div>

      <OnboardingBottomActionBar
        primaryLabel="Adresi kaydet"
        onPrimary={() => void saveAndContinue()}
        primaryDisabled={saving || Boolean(resolvedSession?.redirectStep)}
        primaryLoading={saving}
      />
    </Card>
  );
}
