'use client';

import { useParams } from 'next/navigation';
import StaffDetailWorkspace from '@/components/tenant/staff/StaffDetailWorkspace';

export default function TenantStaffDetailPage() {
  const params = useParams<{ staffId: string }>();
  return <StaffDetailWorkspace staffId={params.staffId} />;
}
