'use client';

import {
  type KeyboardEvent,
  type ReactElement,
  type SVGProps,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { cn } from '@lieferzonen/ui';
import { useTenantStores } from '@/lib/tenant-store-context';

function StoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M3 9.5 5 5h14l2 4.5" />
      <path d="M3 9.5h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0v-2Z" />
      <path d="M5 13v7h14v-7" />
    </svg>
  );
}

function ChevronIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" {...props}>
      <path d="m5 12 5 5 9-11" />
    </svg>
  );
}

function DotIcon({ isActive }: { isActive: boolean }) {
  return (
    <span
      aria-hidden
      className={cn('h-1.5 w-1.5 rounded-full', isActive ? 'bg-emerald-500' : 'bg-slate-300')}
    />
  );
}

export function StoreSwitcher(): ReactElement | null {
  const { stores, activeStore, activeStoreId, setActiveStore, loading, loadedOnce } =
    useTenantStores();
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const index = stores.findIndex((s) => s.id === activeStoreId);
    setFocusedIndex(index < 0 ? 0 : index);
  }, [open, stores, activeStoreId]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[focusedIndex]?.focus();
  }, [open, focusedIndex]);

  // İlk yüklemede iskelet — boş içerik yerine küçük bir placeholder
  if (loading && !loadedOnce) {
    return (
      <div className="mt-3 rounded-[14px] border border-slate-100 bg-white p-3">
        <div className="h-3 w-20 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-2 h-4 w-32 animate-pulse rounded-full bg-slate-100" />
      </div>
    );
  }

  if (stores.length === 0) return null;

  const isSingle = stores.length === 1;

  if (isSingle && activeStore) {
    return (
      <div className="mt-3 rounded-[14px] border border-slate-100 bg-white p-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
          Aktif restoran
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-slate-100 bg-slate-50 text-[#09479A]">
            <StoreIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold tracking-[-0.005em] text-slate-900">
              {activeStore.name}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
              <DotIcon isActive={Boolean(activeStore.isActive)} />
              {activeStore.isActive ? 'Açık' : 'Kapalı'}
            </span>
          </span>
        </div>
      </div>
    );
  }

  function selectStore(storeId: string) {
    setActiveStore(storeId);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocusedIndex((idx) => Math.min(idx + 1, stores.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusedIndex((idx) => Math.max(idx - 1, 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setFocusedIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setFocusedIndex(stores.length - 1);
    }
  }

  return (
    <div ref={containerRef} className="relative mt-3">
      <button
        type="button"
        ref={buttonRef}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onButtonKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-[14px] border bg-white p-3 text-left transition',
          open
            ? 'border-[#09479A]/30 ring-2 ring-[#09479A]/15'
            : 'border-slate-100 hover:border-[#09479A]/20',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-slate-100 bg-slate-50 text-[#09479A]">
            <StoreIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
              Aktif restoran
            </span>
            <span className="mt-0.5 block truncate text-[13px] font-semibold tracking-[-0.005em] text-slate-900">
              {activeStore?.name ?? 'Restoran seç'}
            </span>
          </span>
        </span>
        <ChevronIcon
          className={cn(
            'h-4 w-4 shrink-0 text-slate-400 transition-transform',
            open ? 'rotate-180' : '',
          )}
        />
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Restoran seç"
          onKeyDown={onListKeyDown}
          className="absolute left-0 right-0 z-30 mt-2 max-h-[280px] overflow-auto rounded-[14px] border border-slate-100 bg-white p-1 shadow-[0_18px_36px_rgba(15,23,42,0.12)]"
        >
          {stores.map((store, index) => {
            const isActive = store.id === activeStoreId;
            return (
              <button
                key={store.id}
                type="button"
                role="option"
                aria-selected={isActive}
                tabIndex={focusedIndex === index ? 0 : -1}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                onClick={() => selectStore(store.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left transition',
                  isActive
                    ? 'bg-[#09479A]/[0.06] text-[#09479A]'
                    : 'text-slate-700 hover:bg-slate-50',
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-slate-100 bg-white text-[#09479A]">
                  <StoreIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate text-[13px] font-semibold tracking-[-0.005em]',
                      isActive ? 'text-[#09479A]' : 'text-slate-900',
                    )}
                  >
                    {store.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                    <DotIcon isActive={Boolean(store.isActive)} />
                    {store.isActive ? 'Açık' : 'Kapalı'}
                  </span>
                </span>
                {isActive ? (
                  <CheckIcon className="h-4 w-4 shrink-0 text-[#09479A]" aria-hidden />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
