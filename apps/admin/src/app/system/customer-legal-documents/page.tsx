'use client';

import AdminSurface from '@/components/admin/AdminSurface';
import LegalDocumentsWorkspace from '@/components/admin/LegalDocumentsWorkspace';

export default function CustomerLegalDocumentsPage() {
  return (
    <AdminSurface
      title="Müşteri Yasal Metinleri"
      description="Bu ekran müşterinin checkout sırasında gördüğü ve kabul ettiği yasal metinleri yönetir. Partner başvuru belgeleri bu ekrandan yönetilmez."
    >
      <LegalDocumentsWorkspace />
    </AdminSurface>
  );
}
