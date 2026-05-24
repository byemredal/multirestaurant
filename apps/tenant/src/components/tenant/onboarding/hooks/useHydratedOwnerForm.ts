'use client';

import { useEffect, useState } from 'react';
import type {
  TenantOnboardingWorkspace,
  TenantOwnerContactInfoInput,
} from '@/lib/tenant-onboarding-client';

export function useHydratedOwnerForm(workspace: TenantOnboardingWorkspace) {
  const [form, setForm] = useState<TenantOwnerContactInfoInput>({});

  useEffect(() => {
    const data = workspace.steps.find((step) => step.stepKey === 'owner_contact_info')?.data as
      | Record<string, unknown>
      | undefined;

    setForm({
      fullName: String(data?.fullName ?? ''),
      email: String(data?.email ?? ''),
      phoneNumber: String(data?.phoneNumber ?? ''),
      roleTitle: data?.roleTitle ? String(data.roleTitle) : '',
      ownershipPercentage:
        data?.ownershipPercentage === null || data?.ownershipPercentage === undefined
          ? null
          : Number(data.ownershipPercentage),
    });
  }, [workspace]);

  return [form, setForm] as const;
}
