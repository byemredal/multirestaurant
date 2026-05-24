'use client';

import AdminSurface from '@/components/admin/AdminSurface';
import LegalDocumentsWorkspace from '@/components/admin/LegalDocumentsWorkspace';
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageProvider';

export default function LegalPage() {
  const { t } = useAdminLanguage();

  return (
    <AdminSurface
      title={t('admin.legal.title', 'Legal Documents')}
      description={t(
        'admin.legal.description',
        'Platform yasal dokümanları + immutable versiyon yönetimi.',
      )}
    >
      <LegalDocumentsWorkspace />
    </AdminSurface>
  );
}
