'use client';

import AdminSurface from '@/components/admin/AdminSurface';
import ComplianceCatalogWorkspace from '@/components/admin/ComplianceCatalogWorkspace';

export default function ComplianceCatalogPage() {
  return (
    <AdminSurface
      title="Partner Başvuru Uyumu"
      description="Partner başvurularında istenecek belgeleri ve başvuru onay kutularını ülke/dil bazında yönetin. Bu ekran müşteri checkout yasal metinlerini yönetmez."
    >
      <ComplianceCatalogWorkspace />
    </AdminSurface>
  );
}
