import TenantStudio from '@/components/tenant/TenantStudio';
import { TenantSetPasswordCard } from '@/components/tenant/TenantSetPasswordCard';

export default function TenantStudioPage() {
  return (
    <>
      <TenantSetPasswordCard />
      <TenantStudio />
    </>
  );
}
