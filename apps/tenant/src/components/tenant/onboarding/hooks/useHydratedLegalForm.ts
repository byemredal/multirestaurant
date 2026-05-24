'use client';

import { useEffect, useState } from 'react';
import type {
  TenantLegalTaxInfoInput,
  TenantOnboardingWorkspace,
} from '@/lib/tenant-onboarding-client';

export function useHydratedLegalForm(workspace: TenantOnboardingWorkspace) {
  const [form, setForm] = useState<TenantLegalTaxInfoInput>({});

  useEffect(() => {
    const data = workspace.steps.find((step) => step.stepKey === 'legal_tax_info')?.data as
      | Record<string, unknown>
      | undefined;

    setForm({
      legalEntityName: String(data?.legalEntityName ?? ''),
      taxId: data?.taxId ? String(data.taxId) : '',
      vatId: data?.vatId ? String(data.vatId) : '',
      registrationCountry: String(data?.registrationCountry ?? ''),
      registeredAddress: String(data?.registeredAddress ?? ''),
    });
  }, [workspace]);

  return [form, setForm] as const;
}
