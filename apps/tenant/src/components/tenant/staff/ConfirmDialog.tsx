'use client';

import { useEffect } from 'react';

/**
 * Minimal destructive-action modal. Used for staff deactivation and resend-
 * invite confirmation. Closes on Escape and when the backdrop is clicked.
 *
 * Mobile: full-bleed bottom sheet below `sm`; centered card above.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Onayla',
  cancelLabel = 'Vazgeç',
  tone = 'danger',
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'neutral';
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const confirmClasses =
    tone === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-[#09479A] hover:bg-[#06366f] text-white';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-t-[18px] bg-white p-5 shadow-card sm:rounded-[18px]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-[15px] font-semibold text-slate-900">
          {title}
        </h2>
        <div className="mt-2 text-[13px] leading-5 text-slate-600">{body}</div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={busy}
            className={`rounded-[10px] px-3.5 py-2 text-[12.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmClasses}`}
          >
            {busy ? 'İşleniyor…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
