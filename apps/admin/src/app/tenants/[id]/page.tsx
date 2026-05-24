'use client';

import { useParams } from 'next/navigation';
import AdminSurface from '@/components/admin/AdminSurface';
import TenantWorkspaceShell from '@/components/admin/TenantWorkspaceShell';
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageProvider';

export default function TenantBusinessOverviewPage() {
  const { t } = useAdminLanguage();
  const params = useParams<{ id: string }>();

  return (
    <AdminSurface
      title={t('admin.tenantBusiness.title', 'Tenant Workspace')}
      description={t('admin.tenantBusiness.description', 'Tek tenant için inceleme, belge ve denetim geçmişi.')}
    >
      <TenantWorkspaceShell tenantId={params.id} />
    </AdminSurface>
  );
}
