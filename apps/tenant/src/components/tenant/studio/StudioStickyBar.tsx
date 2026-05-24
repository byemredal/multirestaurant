'use client';

import type { ReactElement } from 'react';
import { cn } from '@lieferzonen/ui';

type PillTone = 'muted' | 'success' | 'warning';

export function StudioStickyBar({
  categoryCount,
  productCount,
  publishedCount,
  storeIsActive,
  onCreateCategory,
  onCreateProduct,
}: {
  categoryCount: number;
  productCount: number;
  publishedCount: number;
  storeIsActive: boolean;
  onCreateCategory: () => void;
  onCreateProduct: () => void;
}): ReactElement {
  return (
    <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-slate-100 bg-white/95 px-4 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <Pill label="Kategori" value={categoryCount} />
        <Pill label="Ürün" value={productCount} />
        <Pill
          label="Yayında"
          value={publishedCount}
          tone={publishedCount > 0 ? 'success' : 'muted'}
        />
        {!storeIsActive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
            Restoran kapalı — vitrin görünmüyor
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onCreateCategory}
          className="rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 transition hover:border-[#09479A]/30 hover:text-[#09479A]"
        >
          + Kategori
        </button>
        <button
          type="button"
          onClick={onCreateProduct}
          className="rounded-[10px] bg-[#09479A] px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-[0_8px_18px_rgba(9,71,154,0.22)] transition hover:bg-[#073a82]"
        >
          + Ürün
        </button>
      </div>
    </div>
  );
}

function Pill({ label, value, tone = 'muted' }: { label: string; value: number; tone?: PillTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold',
        tone === 'success'
          ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
          : tone === 'warning'
            ? 'border-amber-100 bg-amber-50 text-amber-700'
            : 'border-slate-100 bg-slate-50 text-slate-600',
      )}
    >
      <span className="uppercase tracking-[0.12em] text-[10px] opacity-80">{label}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}
