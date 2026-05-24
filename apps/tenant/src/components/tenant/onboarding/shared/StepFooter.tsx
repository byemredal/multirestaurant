'use client';

import { Button } from '@lieferzonen/ui';

export type StepFooterProps = {
  disableSave?: boolean;
  onSave: () => void;
  onBack: () => void;
  saving: boolean;
  showBack: boolean;
  primaryLabel?: string;
};

export function StepFooter({
  disableSave,
  onSave,
  onBack,
  saving,
  showBack,
  primaryLabel,
}: StepFooterProps) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-6">
      {showBack ? (
        <Button
          type="button"
          onClick={onBack}
          variant="outline"
          className="inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-[14px] font-semibold text-[#44403c] transition hover:bg-[#fffbf5]"
        >
          <span className="flex flex-row items-center justify-between">
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 6-6 6 6 6" />
            </svg>
            Geri
          </span>
        </Button>
      ) : (
        <span />
      )}
      <Button
        type="button"
        disabled={saving || disableSave}
        onClick={onSave}
        className="inline-flex items-center gap-2 rounded-[14px] bg-primary px-5 py-2.5 text-[14px] font-semibold text-white shadow-pop transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'Kaydediliyor…' : (primaryLabel ?? 'Kaydet ve devam et')}
      </Button>
    </div>
  );
}
