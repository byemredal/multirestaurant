'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getTenantStoreCuisines,
  listPublicCuisines,
  replaceTenantStoreCuisines,
  type Cuisine,
  type StoreCuisineDetail,
} from '@/lib/tenant-client';
import type { StoredTenantSession } from '@/lib/storage/tenant-session';

type Props = {
  session: StoredTenantSession;
  storeId: string | null;
};

export function TenantCuisinesPanel({ session, storeId }: Props) {
  const [catalog, setCatalog] = useState<Cuisine[]>([]);
  const [assigned, setAssigned] = useState<StoreCuisineDetail[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [primary, setPrimary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [catalogRes, assignedRes] = await Promise.all([
        listPublicCuisines(),
        getTenantStoreCuisines(session, storeId),
      ]);
      setCatalog(catalogRes.cuisines);
      setAssigned(assignedRes.cuisines);
      const ids = new Set(assignedRes.cuisines.map((c) => c.id));
      setSelected(ids);
      setPrimary(assignedRes.cuisines.find((c) => c.isPrimary)?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mutfaklar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [storeId, session]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggle = (id: string) => {
    setFeedback(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (primary === id) setPrimary(null);
      } else {
        if (next.size >= 6) return prev;
        next.add(id);
        if (!primary) setPrimary(id);
      }
      return next;
    });
  };

  const setAsPrimary = (id: string) => {
    if (!selected.has(id)) return;
    setPrimary(id);
  };

  const save = async () => {
    if (!storeId) return;
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const ids = Array.from(selected);
      const result = await replaceTenantStoreCuisines(
        session,
        storeId,
        ids,
        primary && selected.has(primary) ? primary : undefined,
      );
      setAssigned(result.cuisines);
      setFeedback('Mutfak seçimi güncellendi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mutfak seçimi kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  if (!storeId) {
    return (
      <div className="rounded-[20px] border border-[#ece2d2] bg-white p-6 text-center text-[13.5px] text-[#78716c] shadow-sm">
        Mutfak seçimi için önce bir restoran oluşturup seçmeniz gerekir.
      </div>
    );
  }

  return (
    <section className="rounded-[20px] border border-[#ece2d2] bg-white p-5 shadow-[0_8px_24px_rgba(28,25,23,0.04)] lg:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-bold text-[#1c1917]">Mutfak Tipi</h3>
          <p className="mt-0.5 text-[12.5px] text-[#78716c]">
            Vitrinde gösterilen ve müşterinin keşfetmesine yardımcı olan mutfak
            etiketleri. En fazla 6 mutfak ekleyebilirsiniz; biri birincil olarak
            işaretlenir.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving || selected.size === 0}
          className="rounded-full bg-[#1c1917] px-4 py-2 text-[12.5px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </header>

      {feedback && (
        <p className="mb-3 rounded-[10px] bg-emerald-50 px-3 py-2 text-[12.5px] font-medium text-emerald-700">
          {feedback}
        </p>
      )}
      {error && (
        <p className="mb-3 rounded-[10px] bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-700">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-[44px] animate-pulse rounded-full bg-[#f5f4ee]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.map((cuisine) => {
            const isSelected = selected.has(cuisine.id);
            const isPrimary = primary === cuisine.id;
            return (
              <div
                key={cuisine.id}
                className={`flex items-center justify-between gap-2 rounded-full border px-3 py-2 transition ${
                  isSelected
                    ? 'border-[#1c1917] bg-[#1c1917] text-white'
                    : 'border-[#e7e0cf] bg-white text-[#1c1917] hover:bg-[#faf7ee]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(cuisine.id)}
                  className="flex flex-1 items-center gap-2 text-left text-[13px] font-semibold"
                >
                  <span aria-hidden="true">{cuisine.emoji ?? '🍽️'}</span>
                  {cuisine.name}
                </button>
                {isSelected && (
                  <button
                    type="button"
                    onClick={() => setAsPrimary(cuisine.id)}
                    aria-pressed={isPrimary}
                    className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider transition ${
                      isPrimary
                        ? 'bg-white text-[#1c1917]'
                        : 'border border-white/40 text-white/80 hover:bg-white/10'
                    }`}
                  >
                    {isPrimary ? 'Birincil' : 'Birincil yap'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {assigned.length > 0 && (
        <p className="mt-4 text-[11.5px] text-[#a8a29e]">
          Şu an atanmış: {assigned.map((c) => c.name).join(', ')}
        </p>
      )}
    </section>
  );
}
