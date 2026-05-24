import * as React from 'react';
import { cn } from './cn';

type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: AlertVariant;
  title?: React.ReactNode;
  /** Override the default variant icon. */
  icon?: React.ReactNode;
  /** When provided, renders a dismiss button in the top-right corner. */
  onClose?: () => void;
}

const STYLES: Record<AlertVariant, { box: string; chip: string; icon: string }> = {
  info: { box: 'border-ink-200 bg-ink-50', chip: 'bg-ink-100 text-ink-600', icon: 'text-ink-600' },
  success: {
    box: 'border-success-200 bg-success-50',
    chip: 'bg-success-100 text-success-600',
    icon: 'text-success-600',
  },
  warning: {
    box: 'border-warning-200 bg-warning-50',
    chip: 'bg-warning-100 text-warning-600',
    icon: 'text-warning-600',
  },
  danger: {
    box: 'border-danger-200 bg-danger-50',
    chip: 'bg-danger-100 text-danger-600',
    icon: 'text-danger-600',
  },
};

const ICON_PATHS: Record<AlertVariant, string> = {
  info: 'M12 8h.01M11 12h1v4h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  success: 'M8 12.5l2.5 2.5L16 9M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  warning: 'M12 9v4m0 3h.01M10.3 4.3 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z',
  danger: 'M12 8v4m0 4h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
};

/** Inline message banner with an icon chip, optional title and dismiss action. */
export function Alert({
  className,
  variant = 'info',
  title,
  icon,
  onClose,
  children,
  ...props
}: AlertProps) {
  const s = STYLES[variant];
  return (
    <div
      role={variant === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-xl border p-3.5', s.box, className)}
      {...props}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          s.chip,
        )}
      >
        {icon ?? (
          <svg viewBox="0 0 24 24" fill="none" className={cn('h-5 w-5', s.icon)}>
            <path
              d={ICON_PATHS[variant]}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        {title && <p className="text-[14px] font-bold text-ink-900">{title}</p>}
        {children && (
          <div className={cn('text-[13px] leading-relaxed text-ink-600', !!title && 'mt-0.5')}>
            {children}
          </div>
        )}
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-black/5 hover:text-ink-700"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
