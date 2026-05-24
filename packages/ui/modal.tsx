'use client';

import * as React from 'react';
import { cn } from './cn';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Footer area — typically action buttons, right-aligned. */
  footer?: React.ReactNode;
  size?: ModalSize;
}

const SIZES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
  full: 'max-w-full',
};

/** Centered dialog with a blurred backdrop, scale-in entrance and Escape-to-close. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  // Keep the node mounted through the exit transition.
  React.useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timer = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(timer);
  }, [open]);

  // Escape key + body scroll lock while open.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-ink-900/45 backdrop-blur-sm transition-opacity duration-200',
          visible ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-2xl bg-white shadow-pop',
          'transition-all duration-200 ease-out',
          SIZES[size],
          visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-95 opacity-0',
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
            <div className="min-w-0">
              {title && <h2 className="text-[16px] font-bold text-ink-900">{title}</h2>}
              {description && <p className="mt-0.5 text-[13px] text-ink-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="-mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        {children != null && <div className="px-5 py-4 text-[14px] text-ink-700">{children}</div>}

        {footer && (
          <div className="flex justify-end gap-2 border-t border-ink-100 bg-ink-50 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
