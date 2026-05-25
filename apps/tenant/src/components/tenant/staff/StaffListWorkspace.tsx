'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useTenantAuth } from '@/lib/auth/tenant-auth-context';
import { listStaff, type TenantStaff } from '@/lib/tenant-staff-client';
import { StaffList } from './StaffList';

/**
 * Page-level workspace for `/dashboard/staff`. Owns the data fetch and
 * the loading / empty / error coordination; the list itself is a dumb
 * component that just renders. Refetch on mount + on session changes.
 */
export default function StaffListWorkspace() {
  const { session } = useTenantAuth();
  const [staff, setStaff] = useState<TenantStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listStaff(session);
      setStaff(result.staff);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Beklenmeyen hata');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-slate-900 sm:text-[24px]">
            Personel
          </h1>
          <p className="mt-1 text-[13px] text-slate-500">
            Mağaza personelinizi davet edin ve yetkilerini yönetin.
          </p>
        </div>
        <Link
          href="/dashboard/staff/new"
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#09479A] px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-[#06366f]"
        >
          Personel davet et
        </Link>
      </header>

      <StaffList staff={staff} loading={loading} error={error} onRetry={refresh} />
    </div>
  );
}
