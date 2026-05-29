'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn, IconButton } from '@lieferzonen/ui';

/* ── Icons (inline SVG — the design system ships no icon library) ──────── */

export function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="M4 20h4l10.5-10.5a2.121 2.121 0 0 0-3-3L5 17v3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="M5 7h14M9 7V5h6v2m-7 0 1 12h6l1-12"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3v2m0 14v2m9-9h-2M5 12H3m13.5-6.5-1.4 1.4M8.9 15.1l-1.4 1.4m9.6 0-1.4-1.4M8.9 8.9 7.5 7.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ── Slide-over (right drawer) ────────────────────────────────────────── */

/**
 * Right-side drawer for add/edit forms. Closes on Escape (unless busy) and on
 * backdrop click; full-width on mobile, fixed panel on `sm`+. The footer is
 * sticky so primary actions stay reachable while the body scrolls.
 */
export function TenantSlideOver({
  open,
  title,
  description,
  busy = false,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  description?: string;
  busy?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  // `mounted` keeps the panel in the DOM during the exit animation; `entered`
  // drives the enter/exit transition.
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);

  // Mount/unmount around the exit transition.
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    setEntered(false);
    const timer = setTimeout(() => setMounted(false), 260);
    return () => clearTimeout(timer);
  }, [open]);

  // Trigger the enter transition only AFTER the closed state has painted.
  // A double rAF guarantees the browser commits the initial `translate-x-full`
  // / `opacity-0` frame first, so the panel actually animates in (a single rAF
  // can be batched with the mount and skip the transition).
  useEffect(() => {
    if (!mounted || !open) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [mounted, open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, busy, onClose]);

  if (!mounted || typeof document === 'undefined') return null;

  // Rendered through a portal to `document.body` so the drawer escapes any
  // ancestor that establishes a containing block for fixed elements (the
  // dashboard content wrapper uses `backdrop-blur`, which would otherwise clip
  // the overlay to the content column).
  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={cn(
          'absolute inset-0 bg-slate-900/45 backdrop-blur-sm transition-opacity duration-300 ease-out',
          entered ? 'opacity-100' : 'opacity-0',
        )}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        className={cn(
          'relative flex h-full w-full flex-col bg-white shadow-pop transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] sm:max-w-[560px]',
          entered ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#ece2d2] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-[#1c1917]">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-[12.5px] text-[#78716c]">{description}</p>
            ) : null}
          </div>
          <IconButton variant="ghost" aria-label="Kapat" onClick={onClose} disabled={busy}>
            <CloseIcon />
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#e2dccd] [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-[#d6c9ad]">
          {children}
        </div>

        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-[#ece2d2] bg-[#fbfaf7] px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/* ── Row action icon button ───────────────────────────────────────────── */

export function RowAction({
  label,
  onClick,
  tone = 'neutral',
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  tone?: 'neutral' | 'danger';
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-[9px] border transition disabled:cursor-not-allowed disabled:opacity-50',
        tone === 'danger'
          ? 'border-red-200 text-red-600 hover:bg-red-50'
          : 'border-[#ece2d2] text-[#57534e] hover:bg-[#f3f6fb] hover:text-[#1c1917]',
      )}
    >
      {children}
    </button>
  );
}

/* ── Collapsible form section (accordion step inside a slide-over) ─────── */

function ChevronUpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="m6 15 6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path d="m5 12 5 5 9-11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A collapsible step within a long form: the header shows a status chip + title,
 * a pencil affordance when collapsed (click to edit) and a chevron when open.
 * `done` marks a completed step; `summary` is a short recap shown while collapsed.
 */
export function FormSection({
  title,
  open,
  done = false,
  index,
  summary,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  done?: boolean;
  index?: number;
  summary?: React.ReactNode;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[14px] border bg-white transition-colors',
        open ? 'border-primary-200' : 'border-[#ece2d2]',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[#fbfaf7]"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors',
              done
                ? 'bg-primary text-white'
                : open
                  ? 'bg-primary-50 text-primary-700'
                  : 'bg-[#f1efe8] text-[#a8a29e]',
            )}
          >
            {done ? <CheckIcon /> : index != null ? index : ''}
          </span>
          <span className="min-w-0">
            <span className="block text-[13.5px] font-semibold text-[#1c1917]">{title}</span>
            {!open && summary ? (
              <span className="mt-0.5 block truncate text-[12px] text-[#78716c]">{summary}</span>
            ) : null}
          </span>
        </span>
        <span className="shrink-0 text-[#a8a29e]">{open ? <ChevronUpIcon /> : <EditIcon />}</span>
      </button>
      {open ? <div className="border-t border-[#f1efe8] px-4 py-4">{children}</div> : null}
    </div>
  );
}

/* ── Data table (responsive: rows on sm+, cards on mobile) ────────────── */

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** Hide this column on mobile cards (shown only in the desktop table). */
  hideOnMobile?: boolean;
};

export function TenantDataTable<T>({
  columns,
  rows,
  getRowId,
  rowActions,
  loading = false,
  empty,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  rowActions?: (row: T) => React.ReactNode;
  loading?: boolean;
  empty?: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="grid gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-[12px] bg-[#f1efe8]" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <>{empty}</>;
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-[14px] border border-[#ece2d2] sm:block">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#ece2d2] bg-[#fbfaf7]">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#a8a29e]"
                >
                  {column.header}
                </th>
              ))}
              {rowActions ? <th className="w-px px-4 py-2.5" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getRowId(row)}
                className="border-b border-[#f1efe8] last:border-0 hover:bg-[#fbfaf7]"
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 align-middle text-[#44403c]">
                    {column.render(row)}
                  </td>
                ))}
                {rowActions ? (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">{rowActions(row)}</div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-2 sm:hidden">
        {rows.map((row) => (
          <div
            key={getRowId(row)}
            className="rounded-[14px] border border-[#ece2d2] bg-white p-3.5"
          >
            <div className="grid gap-1.5">
              {columns
                .filter((column) => !column.hideOnMobile)
                .map((column) => (
                  <div key={column.key} className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#a8a29e]">
                      {column.header}
                    </span>
                    <span className="text-right text-[13px] text-[#44403c]">
                      {column.render(row)}
                    </span>
                  </div>
                ))}
            </div>
            {rowActions ? (
              <div className="mt-3 flex justify-end gap-1.5 border-t border-[#f1efe8] pt-3">
                {rowActions(row)}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
