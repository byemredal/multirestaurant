'use client';

import type { ReactElement } from 'react';
import { cn } from '@lieferzonen/ui';

export type CategoryRailItem = {
  id: string;
  name: string;
  sortOrder: number;
  isActive?: boolean;
};

export function CategoryRail({
  categories,
  selectedCategoryId,
  productCountByCategory,
  uncategorizedCount,
  totalCount,
  editingCategoryId,
  onSelect,
  onEdit,
}: {
  categories: CategoryRailItem[];
  selectedCategoryId: string | null;
  productCountByCategory: Map<string, number>;
  uncategorizedCount: number;
  totalCount: number;
  editingCategoryId: string | null;
  onSelect: (id: string | null) => void;
  onEdit: (category: CategoryRailItem) => void;
}): ReactElement {
  const sorted = [...categories].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name, 'tr');
  });

  return (
    <aside className="rounded-[16px] border border-slate-100 bg-white p-3">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
          Kategoriler
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold tabular-nums text-slate-600">
          {sorted.length}
        </span>
      </div>

      <ul className="grid gap-1">
        <li>
          <RailRow
            label="Tümü"
            count={totalCount}
            active={selectedCategoryId === null}
            onSelect={() => onSelect(null)}
          />
        </li>

        {sorted.length === 0 ? (
          <li className="mt-1 rounded-[10px] border border-dashed border-slate-200 px-3 py-3 text-center text-[12px] text-slate-500">
            Henüz kategori yok.
          </li>
        ) : (
          sorted.map((cat) => (
            <li key={cat.id}>
              <RailRow
                label={cat.name}
                count={productCountByCategory.get(cat.id) ?? 0}
                active={selectedCategoryId === cat.id}
                editing={editingCategoryId === cat.id}
                inactive={cat.isActive === false}
                onSelect={() => onSelect(cat.id)}
                onEdit={() => onEdit(cat)}
              />
            </li>
          ))
        )}

        {uncategorizedCount > 0 ? (
          <li className="mt-1">
            <RailRow
              label="Kategorisiz"
              count={uncategorizedCount}
              active={selectedCategoryId === '__uncategorized__'}
              onSelect={() => onSelect('__uncategorized__')}
              muted
            />
          </li>
        ) : null}
      </ul>
    </aside>
  );
}

function RailRow({
  label,
  count,
  active,
  editing,
  inactive,
  muted,
  onSelect,
  onEdit,
}: {
  label: string;
  count: number;
  active: boolean;
  editing?: boolean;
  inactive?: boolean;
  muted?: boolean;
  onSelect: () => void;
  onEdit?: () => void;
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-[10px] border px-2.5 py-2 transition',
        active
          ? 'border-[#09479A]/25 bg-[#09479A]/[0.06]'
          : 'border-transparent hover:bg-slate-50',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span
          aria-hidden
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            inactive
              ? 'bg-slate-300'
              : muted
                ? 'bg-slate-400'
                : active
                  ? 'bg-[#09479A]'
                  : 'bg-emerald-500',
          )}
        />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-[13px] font-semibold tracking-[-0.005em]',
            active ? 'text-[#09479A]' : muted ? 'text-slate-500' : 'text-slate-800',
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums',
            active ? 'bg-white text-[#09479A]' : 'bg-slate-100 text-slate-500',
          )}
        >
          {count}
        </span>
      </button>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`${label} kategorisini düzenle`}
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-white hover:text-slate-700',
            editing && 'text-[#09479A] opacity-100',
          )}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
