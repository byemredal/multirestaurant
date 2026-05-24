'use client';

import type { ReactElement } from 'react';
import { cn } from '@lieferzonen/ui';

export type ProductCardItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl?: string | null;
  basePrice: number;
  currencyCode: string;
  categoryName?: string | null;
  isActive?: boolean;
};

function formatPrice(amount: number) {
  if (Number.isNaN(amount)) return '0.00';
  return amount.toFixed(2);
}

export function ProductCard({
  item,
  isSelected,
  onClick,
}: {
  item: ProductCardItem;
  isSelected: boolean;
  onClick: () => void;
}): ReactElement {
  const isPublished = item.isActive ?? true;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={cn(
        'group flex flex-col overflow-hidden rounded-[14px] border bg-white text-left transition',
        isSelected
          ? 'border-[#09479A]/35 ring-2 ring-[#09479A]/15'
          : 'border-slate-100 hover:border-[#09479A]/25 hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]',
      )}
    >
      <div
        className={cn(
          'relative aspect-[16/10] w-full overflow-hidden',
          item.imageUrl ? '' : 'bg-[linear-gradient(135deg,#f1f5f9,#e2e8f0)]',
        )}
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <svg
              viewBox="0 0 24 24"
              className="h-10 w-10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            >
              <rect x="4" y="4" width="16" height="16" rx="3" />
              <circle cx="9" cy="10" r="1.5" />
              <path d="m4 18 4-4 4 3 4-5 4 4" />
            </svg>
          </div>
        )}
        <span
          className={cn(
            'absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]',
            isPublished ? 'bg-emerald-500/95 text-white' : 'bg-slate-700/85 text-white',
          )}
        >
          {isPublished ? 'Yayında' : 'Taslak'}
        </span>
      </div>
      <div className="flex flex-col gap-1 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <span className="line-clamp-2 text-[13.5px] font-semibold tracking-[-0.005em] text-slate-900">
            {item.name}
          </span>
          <span className="shrink-0 text-[13px] font-bold tabular-nums text-[#09479A]">
            {formatPrice(item.basePrice)} {item.currencyCode}
          </span>
        </div>
        {item.categoryName ? (
          <span className="text-[11px] text-slate-500">{item.categoryName}</span>
        ) : (
          <span className="text-[11px] text-slate-400">Kategorisiz</span>
        )}
      </div>
    </button>
  );
}
