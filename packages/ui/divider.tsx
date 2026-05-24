import * as React from 'react';
import { cn } from './cn';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  /** Optional centered label — only used for horizontal dividers. */
  label?: React.ReactNode;
  className?: string;
}

/** Hairline separator. Horizontal supports an optional centered label. */
export function Divider({ orientation = 'horizontal', label, className }: DividerProps) {
  if (orientation === 'vertical') {
    return (
      <span
        role="separator"
        aria-orientation="vertical"
        className={cn('inline-block w-px self-stretch bg-ink-200', className)}
      />
    );
  }

  if (label) {
    return (
      <div role="separator" className={cn('flex items-center gap-3', className)}>
        <span className="h-px flex-1 bg-ink-200" />
        <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-400">
          {label}
        </span>
        <span className="h-px flex-1 bg-ink-200" />
      </div>
    );
  }

  return <hr className={cn('border-0 border-t border-ink-200', className)} />;
}
