'use client';

import { useEffect, useState } from 'react';
import AdminSurface from '@/components/admin/AdminSurface';
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageProvider';
import { getTenantApplication } from '@/lib/admin-api/admin-review-client';
import { requireAdminSession } from '@/lib/admin-api/require-admin-session';
import { useParams, useRouter } from 'next/navigation';

export default function TenantApplicationDetailPage() {
  const { t } = useAdminLanguage();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const session = await requireAdminSession();
        const detail = await getTenantApplication(session, params.id);
        router.replace(`/tenants/${detail.application.tenantAccountId}?tab=review`);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Tenant workspace could not be opened.');
      }
    };

    void run();
  }, [params.id, router]);

  return (
    <AdminSurface
      title={t('admin.applicationDetail.title', 'Opening tenant workspace')}
      description={t('admin.applicationDetail.description', 'Tenant inceleme ekranına yönlendiriliyor.')}
    >
      {error ? (
        <div className="admin-state admin-state--error">{error}</div>
      ) : (
        <div className="admin-state">Tenant workspace açılıyor…</div>
      )}
    </AdminSurface>
  );
}
