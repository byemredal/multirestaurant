'use client';

import AdminSurface from '@/components/admin/AdminSurface';
import TenantApplicationsList from '@/components/admin/TenantApplicationsList';
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageProvider';

export default function TenantApplicationsPage() {
  const { t } = useAdminLanguage();

  return (
    <AdminSurface
      title={t('admin.tenantApplications.title', 'Tenant Applications')}
      description={t('admin.tenantApplications.description', 'Onboarding başvurularını incele, onayla veya revizyon iste.')}
    >
      <TenantApplicationsList />
    </AdminSurface>
  );
}
