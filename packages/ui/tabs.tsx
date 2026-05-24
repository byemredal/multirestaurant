'use client';

import * as React from 'react';
import { cn } from './cn';

export interface TabItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  /** Controlled active tab id. Omit for uncontrolled usage. */
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  size?: 'sm' | 'md';
  className?: string;
}

/** Segmented-control style tabs — the active tab slides onto a raised pill. */
export function Tabs({ tabs, value, defaultValue, onChange, size = 'md', className }: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? tabs[0]?.id);
  const active = value ?? internal;

  const select = (id: string) => {
    if (value === undefined) setInternal(id);
    onChange?.(id);
  };

  return (
    <div
      role="tablist"
      className={cn('inline-flex items-center gap-1 rounded-xl bg-ink-100 p-1', className)}
    >
      {tabs.map((tab) => {
        const on = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => select(tab.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg font-semibold outline-none transition-all duration-200',
              'focus-visible:ring-2 focus-visible:ring-primary/35',
              size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-10 px-4 text-[13px]',
              on
                ? 'bg-white text-primary shadow-sm'
                : 'text-ink-500 hover:text-ink-800',
            )}
          >
            {tab.icon && <span className="inline-flex shrink-0">{tab.icon}</span>}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
