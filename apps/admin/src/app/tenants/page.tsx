'use client';

import AdminSurface from '@/components/admin/AdminSurface';
import TenantsWorkspace from '@/components/admin/TenantsWorkspace';
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageProvider';

export default function TenantsPage() {
  const { t } = useAdminLanguage();

  return (
    <AdminSurface
      title={t('admin.tenants.title', 'Tenants')}
      description={t('admin.tenants.description', 'Aktif ve geçmiş tenantleri yönet, aktivasyon ve askıya alma işlemleri.')}
    >
      <TenantsWorkspace />
    </AdminSurface>
  );
}
