'use client';

import { useCallback, useRef, useState } from 'react';
import { cn } from './cn';

type FileDropzoneProps = {
  accept?: string;
  maxSizeMb?: number;
  file?: File | null;
  onFile: (file: File) => void;
  className?: string;
  disabled?: boolean;
};

export function FileDropzone({
  accept,
  maxSizeMb = 10,
  file,
  onFile,
  className,
  disabled = false,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);

  const openPicker = () => {
    if (disabled) {
      return;
    }
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.click();
    }
  };

  const handleFile = useCallback(
    (f: File) => {
      if (f.size > maxSizeMb * 1024 * 1024) {
        setSizeError(`Dosya boyutu ${maxSizeMb} MB sınırını aşıyor.`);
        return;
      }
      setSizeError(null);
      onFile(f);
    },
    [maxSizeMb, onFile],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) {
      return;
    }
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const acceptLabel = accept
    ? accept
        .split(',')
        .map((s) => s.trim().replace('.', '').toUpperCase())
        .join(', ')
    : null;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Dosya yükle"
        aria-disabled={disabled}
        onClick={openPicker}
        onKeyDown={(e) => e.key === 'Enter' && openPicker()}
        onDragEnter={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center rounded-[16px] border-2 border-dashed px-6 py-8 text-center transition-all select-none',
          disabled
            ? 'cursor-not-allowed border-ink-300 bg-ink-50 opacity-60'
            : 'cursor-pointer',
          !disabled &&
            (dragging
              ? 'border-brand bg-brand-50'
              : file
                ? 'border-success-100 bg-success-50'
                : 'border-ink-300 bg-ink-50 hover:border-brand-400 hover:bg-brand-50'),
        )}
      >
        <input
          ref={inputRef}
          accept={accept}
          className="sr-only"
          type="file"
          onChange={onInputChange}
        />

        {file ? (
          /* ── File selected state ── */
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-success-50">
              <svg
                className="h-5 w-5 text-success-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-ink-800">{file.name}</p>
              <p className="mt-0.5 text-[12px] text-ink-500">
                {(file.size / 1024).toFixed(0)} KB
              </p>
            </div>
            <button
              type="button"
              className="text-[12px] font-medium text-brand-500 underline underline-offset-2 hover:text-brand-600"
              onClick={(e) => { e.stopPropagation(); openPicker(); }}
            >
              Farklı dosya seç
            </button>
          </div>
        ) : (
          /* ── Empty state ── */
          <div className="flex flex-col items-center gap-3">
            <div
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full transition-colors',
                dragging ? 'bg-brand-100' : 'bg-ink-200',
              )}
            >
              <svg
                className={cn('h-5 w-5 transition-colors', dragging ? 'text-brand-600' : 'text-ink-500')}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                />
              </svg>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-ink-700">
                {dragging ? 'Bırakın, yüklensin' : 'Dosyayı buraya sürükleyin'}
              </p>
              <p className="mt-0.5 text-[13px] text-ink-500">veya tıklayarak seçin</p>
            </div>
            {(acceptLabel || maxSizeMb) && (
              <p className="text-[11px] text-ink-400">
                {[acceptLabel, maxSizeMb && `Maks. ${maxSizeMb} MB`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>
        )}
      </div>

      {sizeError && (
        <p className="text-[12px] text-danger-600">{sizeError}</p>
      )}
    </div>
  );
}
