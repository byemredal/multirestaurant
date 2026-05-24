import TenantOperationsDashboard from '@/components/tenant/dashboard/TenantOperationsDashboard';
import { TenantSetPasswordCard } from '@/components/tenant/TenantSetPasswordCard';

export default function TenantDashboardPage() {
  return (
    <>
      <TenantSetPasswordCard />
      <TenantOperationsDashboard />
    </>
  );
}
