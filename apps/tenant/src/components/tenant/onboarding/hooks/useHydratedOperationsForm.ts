'use client';

import { useEffect, useState } from 'react';
import type {
  TenantOnboardingWorkspace,
  TenantOperationsInfoInput,
} from '@/lib/tenant-onboarding-client';

export function useHydratedOperationsForm(workspace: TenantOnboardingWorkspace) {
  const [form, setForm] = useState<TenantOperationsInfoInput>({});

  useEffect(() => {
    const data = workspace.steps.find((step) => step.stepKey === 'operations_info')?.data as
      | Record<string, unknown>
      | undefined;

    setForm({
      primaryCity: String(data?.primaryCity ?? ''),
      primaryPostalCode: String(data?.primaryPostalCode ?? ''),
      deliveryModel: String(data?.deliveryModel ?? ''),
      supportsPickup: Boolean(data?.supportsPickup),
      openingHoursSummary: data?.openingHoursSummary ? String(data.openingHoursSummary) : '',
      estimatedGoLiveDate: data?.estimatedGoLiveDate
        ? new Date(String(data.estimatedGoLiveDate)).toISOString().slice(0, 10)
        : '',
    });
  }, [workspace]);

  return [form, setForm] as const;
}
