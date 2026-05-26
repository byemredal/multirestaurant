'use client';

import AdminSurface from '@/components/admin/AdminSurface';
import ComplianceCatalogWorkspace from '@/components/admin/ComplianceCatalogWorkspace';

export default function ComplianceCatalogPage() {
  return (
    <AdminSurface
      title="Onboarding compliance kataloğu"
      description="Ülke ve dil bazında belge yönlendirmelerini ve sürümlü onay metni kaynaklarını yönetin."
    >
      <ComplianceCatalogWorkspace />
    </AdminSurface>
  );
}
