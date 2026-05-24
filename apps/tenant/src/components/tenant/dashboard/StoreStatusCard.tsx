'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTenantAuth } from '@/lib/auth/tenant-auth-context';
import { updateTenantStore } from '@/lib/tenant-client';

type StoreLike = {
  id: string;
  name: string;
  status?: string;
  isActive?: boolean;
};

export function StoreStatusCard({
  stores,
  loading,
  error,
  onUpdated,
}: {
  stores: StoreLike[];
  loading: boolean;
  error: string | null;
  onUpdated: () => void | Promise<void>;
}) {
  const { session } = useTenantAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { id: string; type: 'success' | 'error'; message: string } | null
  >(null);

  async function toggle(store: StoreLike) {
    if (!session || busyId) return;
    setBusyId(store.id);
    setFeedback(null);
    try {
      const next = !(store.isActive ?? false);
      await updateTenantStore(session, store.id, { isActive: next });
      setFeedback({
        id: store.id,
        type: 'success',
        message: next ? 'Restoran açıldı — müşteriler sipariş verebilir.' : 'Restoran kapatıldı.',
      });
      await onUpdated();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Güncelleme başarısız.';
      setFeedback({ id: store.id, type: 'error', message });
    } finally {
      setBusyId(null);
    }
  }

  if (loading && stores.length === 0) {
    return (
      <section className="rounded-[18px] border border-slate-100 bg-white p-6">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
        <div className="mt-4 h-[88px] animate-pulse rounded-[14px] bg-slate-50" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-[18px] border border-red-200 bg-red-50 p-5 text-[13px] text-red-700">
        Restoran durumu yüklenemedi: {error}
      </section>
    );
  }

  if (stores.length === 0) {
    return (
      <section className="rounded-[18px] border border-slate-100 bg-white p-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
          Restoran Durumu
        </div>
        <h3 className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-slate-900">
          Henüz restoran yok
        </h3>
        <p className="mt-2 text-[12.5px] leading-5 text-slate-500">
          Operasyonu başlatmak için önce bir restoran oluşturmalısınız.
        </p>
        <Link
          href="/dashboard/studio"
          className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] bg-[#09479A] px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-[#06366f]"
        >
          Restoran oluştur
          <span aria-hidden>→</span>
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-[18px] border border-slate-100 bg-white p-6">
      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
        Restoran Durumu
      </div>
      <h3 className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-slate-900">
        Açık / Kapalı kontrolü
      </h3>
      <p className="mt-1 text-[11.5px] text-slate-500">
        Restoranı geçici kapatın — yeni sipariş alımı anında durur.
      </p>

      <div className="mt-4 grid gap-2.5">
        {stores.map((store) => {
          const isLive = store.status === 'active' && (store.isActive ?? false);
          const isDraft = store.status !== 'active';
          const isPaused = store.status === 'active' && !(store.isActive ?? false);
          const isBusy = busyId === store.id;
          const fb = feedback?.id === store.id ? feedback : null;

          return (
            <div
              key={store.id}
              className="rounded-[14px] border border-slate-100 bg-white p-4 transition hover:border-slate-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold tracking-[-0.01em] text-slate-900">
                    {store.name}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {isLive ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#09479A]/[0.08] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#09479A]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#09479A]" />
                        Yayında
                      </span>
                    ) : isPaused ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-amber-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Geçici Kapalı
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Yayında Değil
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isBusy || isDraft}
                  onClick={() => void toggle(store)}
                  title={isDraft ? 'Restoran "draft" durumda — önce yayınlanmalı' : undefined}
                  className={`shrink-0 rounded-[10px] px-3.5 py-2 text-[12px] font-bold uppercase tracking-[0.06em] transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    isLive
                      ? 'border border-slate-200 bg-white text-slate-700 hover:border-amber-300 hover:text-amber-700'
                      : isPaused
                        ? 'bg-[#09479A] text-white hover:bg-[#06366f]'
                        : 'border border-slate-200 bg-white text-slate-400'
                  }`}
                >
                  {isBusy ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      İşleniyor
                    </span>
                  ) : isLive ? (
                    'Kapat'
                  ) : isPaused ? (
                    'Tekrar Aç'
                  ) : (
                    'Yayında Değil'
                  )}
                </button>
              </div>

              {fb ? (
                <div
                  className={`mt-3 rounded-[10px] px-3 py-1.5 text-[11.5px] ${
                    fb.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  {fb.message}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
