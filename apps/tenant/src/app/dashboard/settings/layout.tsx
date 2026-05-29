import type { ReactNode } from 'react';
import TenantSettingsLayout from '@/components/tenant/settings/TenantSettingsLayout';

export default function DashboardSettingsLayout({ children }: { children: ReactNode }) {
  return <TenantSettingsLayout>{children}</TenantSettingsLayout>;
}
