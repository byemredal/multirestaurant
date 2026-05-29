'use client';

import { TenantSlideOver } from '@/components/tenant/studio/StudioPrimitives';
import StoreSettingsPanel from '@/components/tenant/StoreSettingsPanel';
import type { StoredTenantSession } from '@/lib/storage/tenant-session';

export default function StoreSettingsDrawer({
  open,
  storeId,
  storeName,
  session,
  onClose,
}: {
  open: boolean;
  storeId: string | null;
  storeName?: string;
  session: StoredTenantSession;
  onClose: () => void;
}) {
  return (
    <TenantSlideOver
      open={open && Boolean(storeId)}
      title={storeName ? `${storeName} · Ayarlar` : 'Restoran ayarları'}
      description="Operasyon, ödeme yöntemleri, teslimat ücreti, vergi ve fiş ayarları."
      onClose={onClose}
    >
      {storeId ? <StoreSettingsPanel storeId={storeId} session={session} /> : null}
    </TenantSlideOver>
  );
}
