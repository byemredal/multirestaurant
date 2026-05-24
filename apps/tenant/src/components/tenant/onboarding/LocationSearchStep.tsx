'use client';

import { useState } from 'react';
import { Card, Input } from '@lieferzonen/ui';
import {
  saveTenantOnboardingLocationSelection,
  type TenantLocationSelectionInput,
  type TenantOnboardingResolvedSession,
  type TenantOnboardingWorkspace,
} from '@/lib/tenant-onboarding-client';
import { getTenantOnboardingStepUrl } from './onboarding-routing';
import { OnboardingBottomActionBar } from './OnboardingBottomActionBar';
import { StepHeader } from './shared/StepHeader';

type LocationSearchStepProps = {
  resolvedSession: TenantOnboardingResolvedSession | null;
  workspace: TenantOnboardingWorkspace;
  onWorkspaceResolved: (workspace: TenantOnboardingWorkspace) => void;
  onNavigate: (url: string) => void;
};

function getInitialLocationInput(workspace: TenantOnboardingWorkspace) {
  const businessInfo = workspace.steps.find((step) => step.stepKey === 'business_info')
    ?.data as { addressLine1?: string | null; country?: string | null } | undefined;
  return (
    workspace.locationSelection?.rawInput ??
    workspace.locationSelection?.locationLabel ??
    businessInfo?.addressLine1 ??
    ''
  );
}

function buildLocationPayload(rawInput: string, country: string): TenantLocationSelectionInput {
  const normalized = rawInput.trim();
  return {
    locationLabel: normalized,
    rawInput: normalized,
    country,
    city: null,
    postalCode: null,
    latitude: null,
    longitude: null,
  };
}

export function LocationSearchStep({
  resolvedSession,
  workspace,
  onWorkspaceResolved,
  onNavigate,
}: LocationSearchStepProps) {
  const [rawInput, setRawInput] = useState(() => getInitialLocationInput(workspace));
  const [country, setCountry] = useState(
    () => workspace.locationSelection?.country ?? resolvedSession?.countryPack.country ?? 'CH',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canContinue = rawInput.trim().length >= 2 && /^[A-Z]{2}$/.test(country.trim().toUpperCase());

  async function saveAndContinue() {
    if (!canContinue) {
      setError('Lutfen isletme konumunu ve ulke kodunu girin.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await saveTenantOnboardingLocationSelection(
        workspace.stateToken,
        buildLocationPayload(rawInput, country.trim().toUpperCase()),
      );
      onWorkspaceResolved(result.workspace);
      const nextStep = result.redirectStep ?? result.nextStep ?? result.session?.currentStep ?? 'address';
      onNavigate(getTenantOnboardingStepUrl(result.stateToken, nextStep));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Konum kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-0 bg-white p-0 shadow-none">
      <StepHeader
        stepIndex={0}
        totalSteps={0}
        status={workspace.locationSelection ? 'completed' : 'in_progress'}
        updatedAt={workspace.application.updatedAt}
        title="Isletme konumu"
        description="Once yalnizca isletmenizin konumunu arayin veya yazin. Tam adres alanlari bir sonraki adimda netlesecek."
      />

      <div className="grid gap-5">
        <div className="rounded-[18px] border border-primary-100 bg-primary-50 px-4 py-4 text-[14px] leading-6 text-primary-700">
          Harita veya yer arama saglayicisi henuz bagli degil. Bu alan, Switzerland-first ilerideki adres ve koordinat modeline uyumlu yalin bir konum taslagi kaydeder.
        </div>

        {error ? (
          <div className="rounded-[14px] border border-danger-200 bg-danger-50 px-4 py-3 text-[13px] text-danger-600">
            {error}
          </div>
        ) : null}

        <label className="block">
          <span className="mb-2 block text-[13px] font-semibold text-ink-700">Konum ara</span>
          <Input
            placeholder="Restoran adi, sokak veya bolge"
            value={rawInput}
            onChange={(event) => setRawInput(event.target.value)}
            disabled={saving}
          />
          <span className="mt-2 block text-[12px] leading-5 text-ink-500">
            Ornek: Bahnhofstrasse 1, Zurich veya isletme adiniz. Sonraki adimda adres detaylarini tamamlayacagiz.
          </span>
        </label>

        <label className="block max-w-[160px]">
          <span className="mb-2 block text-[13px] font-semibold text-ink-700">Ulke</span>
          <Input
            value={country}
            maxLength={2}
            onChange={(event) => setCountry(event.target.value.toUpperCase())}
            disabled={saving}
          />
        </label>
      </div>

      <OnboardingBottomActionBar
        primaryLabel="Konumu kaydet"
        onPrimary={() => void saveAndContinue()}
        primaryDisabled={!canContinue || Boolean(resolvedSession?.redirectStep)}
        primaryLoading={saving}
      />
    </Card>
  );
}
