'use client';

import * as React from 'react';
import { Button, Input, Select, Textarea, cn } from '@lieferzonen/ui';

type FieldChromeProps = {
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
};

function FieldChrome({
  label,
  helperText,
  error,
  required,
  children,
  className,
  htmlFor,
}: FieldChromeProps) {
  return (
    <div className={cn('min-w-0', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-ink-800">
          {label}
          {required ? (
            <span className="ml-1 text-danger-600" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {helperText && !error ? (
        <p className="mt-1.5 text-[12px] leading-5 text-ink-500">{helperText}</p>
      ) : null}
      {error ? (
        <p className="mt-1.5 text-[12px] leading-5 text-danger-700">{error}</p>
      ) : null}
    </div>
  );
}

const controlClass =
  'min-h-11 rounded-[8px] border-ink-200 bg-white px-3.5 text-[14px] shadow-[0_1px_0_rgba(15,18,22,0.02)] placeholder:text-ink-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-ink-50 disabled:text-ink-400';
const errorClass = 'border-danger-200 bg-danger-50/40 focus:border-danger-300 focus:ring-danger-100';

export type PartnerTextFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  error?: React.ReactNode;
};

export function PartnerTextField({
  label,
  helperText,
  error,
  required,
  className,
  id,
  ...props
}: PartnerTextFieldProps) {
  return (
    <FieldChrome
      label={label}
      helperText={helperText}
      error={error}
      required={required}
      htmlFor={id}
      className={className}
    >
      <Input
        id={id}
        aria-invalid={Boolean(error) || props['aria-invalid']}
        className={cn(controlClass, error && errorClass)}
        required={required}
        {...props}
      />
    </FieldChrome>
  );
}

export type PartnerTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  error?: React.ReactNode;
};

export function PartnerTextarea({
  label,
  helperText,
  error,
  required,
  className,
  id,
  ...props
}: PartnerTextareaProps) {
  return (
    <FieldChrome
      label={label}
      helperText={helperText}
      error={error}
      required={required}
      htmlFor={id}
      className={className}
    >
      <Textarea
        id={id}
        aria-invalid={Boolean(error) || props['aria-invalid']}
        className={cn(controlClass, 'min-h-[92px]', error && errorClass)}
        required={required}
        {...props}
      />
    </FieldChrome>
  );
}

export type PartnerSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  error?: React.ReactNode;
};

export function PartnerSelect({
  label,
  helperText,
  error,
  required,
  className,
  id,
  children,
  ...props
}: PartnerSelectProps) {
  return (
    <FieldChrome
      label={label}
      helperText={helperText}
      error={error}
      required={required}
      htmlFor={id}
      className={className}
    >
      <Select
        id={id}
        aria-invalid={Boolean(error) || props['aria-invalid']}
        className={cn(controlClass, error && errorClass)}
        required={required}
        {...props}
      >
        {children}
      </Select>
    </FieldChrome>
  );
}

export type PartnerCheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: React.ReactNode;
  description?: React.ReactNode;
};

export function PartnerCheckbox({
  label,
  description,
  checked,
  disabled,
  className,
  ...props
}: PartnerCheckboxProps) {
  return (
    <label
      className={cn(
        'flex min-w-0 items-start gap-3 rounded-[8px] border px-4 py-3 text-[13px] leading-5 transition',
        checked ? 'border-primary-200 bg-primary-50/70' : 'border-ink-200 bg-white hover:border-ink-300',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        className,
      )}
    >
      <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          {...props}
        />
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-[6px] border-2 border-ink-300 bg-white transition peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/35 peer-focus-visible:ring-offset-1 peer-checked:[&>svg]:scale-100">
          <svg
            aria-hidden="true"
            className="h-3.5 w-3.5 scale-0 text-white transition"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3.5"
            />
          </svg>
        </span>
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-ink-800">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[12.5px] leading-5 text-ink-500">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

export function PartnerFormSection({
  title,
  description,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-[8px] border border-ink-200 bg-white p-4 sm:p-5', className)}>
      <div className="mb-4">
        <h3 className="text-[14px] font-bold text-ink-900">{title}</h3>
        {description ? (
          <p className="mt-1 text-[12.5px] leading-5 text-ink-500">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function PartnerInlineAlert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const styles = {
    info: 'border-primary-100 bg-primary-50 text-primary-700',
    success: 'border-success-100 bg-success-50 text-success-700',
    warning: 'border-warning-200 bg-warning-50 text-warning-700',
    danger: 'border-danger-200 bg-danger-50 text-danger-700',
  }[tone];

  return (
    <div className={cn('rounded-[8px] border px-4 py-3 text-[13px] leading-6', styles, className)}>
      {title ? <strong className="block font-semibold">{title}</strong> : null}
      <div>{children}</div>
    </div>
  );
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function PartnerFileDropzone({
  accept,
  maxSizeMb = 10,
  file,
  onFile,
  onClear,
  disabled,
  uploading,
  className,
}: {
  accept?: string;
  maxSizeMb?: number;
  file: File | null;
  onFile: (file: File) => void;
  onClear?: () => void;
  disabled?: boolean;
  uploading?: boolean;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const acceptLabel = accept
    ?.split(',')
    .map((part) => part.trim().replace('.', '').toUpperCase())
    .filter(Boolean)
    .join(', ');

  const openPicker = () => {
    if (!disabled && !uploading) {
      inputRef.current?.click();
    }
  };

  const handleFile = (nextFile: File | undefined) => {
    if (!nextFile) return;
    if (nextFile.size > maxSizeMb * 1024 * 1024) {
      setError(`Dosya boyutu ${maxSizeMb} MB sinirini asiyor.`);
      return;
    }
    setError(null);
    onFile(nextFile);
  };

  return (
    <div className={cn('grid gap-2', className)}>
      <div
        role="button"
        tabIndex={disabled || uploading ? -1 : 0}
        aria-disabled={disabled || uploading}
        aria-label="Dosya yukle"
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled && !uploading) setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled && !uploading) handleFile(event.dataTransfer.files[0]);
        }}
        className={cn(
          'min-h-[188px] rounded-[8px] border border-dashed px-5 py-6 transition',
          'flex cursor-pointer flex-col items-center justify-center text-center',
          dragging
            ? 'border-primary bg-primary-50'
            : file
              ? 'border-success-200 bg-success-50/60'
              : 'border-ink-300 bg-ink-50 hover:border-primary-300 hover:bg-primary-50/50',
          (disabled || uploading) && 'cursor-not-allowed opacity-70',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={disabled || uploading}
          onChange={(event) => handleFile(event.target.files?.[0])}
        />

        <span className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-white text-primary shadow-sm">
          <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 16V4m0 0 4 4m-4-4-4 4M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        </span>

        {file ? (
          <div className="mt-4 min-w-0">
            <p className="truncate text-[14px] font-semibold text-ink-900">{file.name}</p>
            <p className="mt-1 text-[12px] text-ink-500">
              {formatFileSize(file.size)} - yuklemeye hazir
            </p>
            {uploading ? (
              <div className="mx-auto mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-white">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-[14px] font-semibold text-ink-800">
              {dragging ? 'Dosyayi birakin' : 'Belgeyi buraya surukleyin'}
            </p>
            <p className="mt-1 text-[13px] text-ink-500">veya dosya secmek icin tiklayin</p>
          </div>
        )}

        <p className="mt-4 text-[11.5px] font-medium text-ink-500">
          {[acceptLabel, `Maks. ${maxSizeMb} MB`].filter(Boolean).join(' - ')}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {error ? <p className="text-[12px] text-danger-700">{error}</p> : <span />}
        {file && onClear && !uploading ? (
          <Button type="button" variant="ghost" rounded="sm" size="sm" onClick={onClear}>
            Dosyayi kaldir
          </Button>
        ) : null}
      </div>
    </div>
  );
}
