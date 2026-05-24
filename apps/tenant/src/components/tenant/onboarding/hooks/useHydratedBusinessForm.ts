'use client';

import { useEffect, useState } from 'react';
import type {
  TenantBusinessInfoInput,
  TenantOnboardingWorkspace,
} from '@/lib/tenant-onboarding-client';

/**
 * Reads the `business_info` step's persisted data from the workspace and
 * mirrors it into a controlled form state slot. Re-hydrates whenever the
 * workspace reference changes (i.e. after a save / refresh).
 *
 * Pure input → state mapping. No side-effects beyond `setState`, no module
 * caches, no singletons. One of four such hooks extracted from the
 * 50-line useEffect that used to live in TenantOnboardingStepPanel.tsx.
 */
export function useHydratedBusinessForm(workspace: TenantOnboardingWorkspace) {
  const [form, setForm] = useState<TenantBusinessInfoInput>({});

  useEffect(() => {
    const data = workspace.steps.find((step) => step.stepKey === 'business_info')?.data as
      | Record<string, unknown>
      | undefined;

    setForm({
      businessName: String(data?.businessName ?? ''),
      businessType: String(data?.businessType ?? ''),
      registrationNumber: data?.registrationNumber ? String(data.registrationNumber) : '',
      taxNumber: data?.taxNumber ? String(data.taxNumber) : '',
      addressLine1: String(data?.addressLine1 ?? ''),
      addressLine2: data?.addressLine2 ? String(data.addressLine2) : '',
      city: String(data?.city ?? ''),
      postalCode: String(data?.postalCode ?? ''),
      country: String(data?.country ?? ''),
    });
  }, [workspace]);

  return [form, setForm] as const;
}
