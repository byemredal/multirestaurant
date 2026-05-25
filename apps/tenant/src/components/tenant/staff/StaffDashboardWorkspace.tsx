'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStaffAuth } from '@/lib/auth/staff-auth-context';
import { getStaffMe, type StaffMeResponse } from '@/lib/auth/staff-client';
import { StaffAvailableTools } from './StaffAvailableTools';
import { StaffProfileCard } from './StaffProfileCard';
import { StaffStoreScopeCard } from './StaffStoreScopeCard';

/**
 * `/staff/dashboard` workspace. Pulls a fresh snapshot from GET /staff/me
 * on mount so the page renders the live employment status and store scope
 * (rather than the potentially-stale claims baked into the cached JWT).
 */
export default function StaffDashboardWorkspace() {
  const { session, logout } = useStaffAuth();
  const router = useRouter();
  const [me, setMe] = useState<StaffMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      setMe(await getStaffMe(session));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profil yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      router.replace('/staff/login');
    }
  }

  if (loading && !me) {
    return (
      <div className="mx-auto w-full max-w-[1100px] space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <div className="h-[200px] animate-pulse rounded-[18px] border border-slate-100 bg-slate-50" />
        <div className="h-[160px] animate-pulse rounded-[18px] border border-slate-100 bg-slate-50" />
      </div>
    );
  }

  if (error || !me) {
    return (
      <div className="mx-auto w-full max-w-[680px] px-4 py-10 sm:px-6">
        <div className="rounded-[16px] border border-red-200 bg-red-50 p-5 text-[13px] text-red-800">
          <div className="font-semibold">Personel oturumu yüklenemedi</div>
          <div className="mt-1 break-words">{error ?? 'Bilinmeyen hata'}</div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-3 rounded-[10px] border border-red-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-red-700 transition hover:bg-red-50"
          >
            Tekrar dene
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="ml-2 mt-3 rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Çıkış yap
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-slate-900 sm:text-[24px]">
            Merhaba, {me.fullName.split(' ')[0]}
          </h1>
          <p className="mt-1 text-[13px] text-slate-500">
            Personel çalışma alanınız.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
          className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loggingOut ? 'Çıkış yapılıyor…' : 'Çıkış yap'}
        </button>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <StaffProfileCard me={me} />
          <StaffAvailableTools />
        </div>
        <StaffStoreScopeCard storeScope={me.storeScope} />
      </div>
    </div>
  );
}
