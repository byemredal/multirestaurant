'use client';

import DocumentsQueue from '@/components/admin/DocumentsQueue';
import AdminSurface from '@/components/admin/AdminSurface';
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageProvider';

export default function DocumentsPage() {
  const { t } = useAdminLanguage();

  return (
    <AdminSurface
      title={t('admin.documents.title', 'Documents')}
      description={t('admin.documents.description', 'Tüm tenantlerden gelen belge inceleme kuyruğu.')}
    >
      <DocumentsQueue />
    </AdminSurface>
  );
}
