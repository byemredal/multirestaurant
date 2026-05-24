'use client';

import type { ReactNode } from 'react';
import { Icon } from '@/lib/icons';

export type FilterChip = {
  id: string;
  label: string;
  count?: number;
};

/**
 * Toolbar with a search field and an optional set of single-select filter
 * chips. Designed to sit directly above a {@link DataTable}.
 */
export default function FilterBar({
  search,
  onSearch,
  searchPlaceholder = 'Search…',
  chips,
  activeChip,
  onChipChange,
  trailing,
}: {
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  chips?: FilterChip[];
  activeChip?: string;
  onChipChange?: (id: string) => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="admin-toolbar">
      <div className="admin-filterbar__search admin-toolbar__search">
        <span className="admin-filterbar__search-icon">
          <Icon.search width={15} height={15} />
        </span>
        <input
          className="admin-input"
          value={search}
          placeholder={searchPlaceholder}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>

      {chips && chips.length > 0 && (
        <div className="admin-row" style={{ gap: 6 }}>
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`admin-chip${
                activeChip === chip.id ? ' admin-chip--active' : ''
              }`}
              onClick={() => onChipChange?.(chip.id)}
            >
              {chip.label}
              {typeof chip.count === 'number' && (
                <span className="admin-chip__count">{chip.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {trailing && (
        <div className="admin-row" style={{ marginLeft: 'auto', gap: 6 }}>
          {trailing}
        </div>
      )}
    </div>
  );
}
