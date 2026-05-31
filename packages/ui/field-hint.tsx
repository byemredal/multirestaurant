import * as React from 'react';
import { Tooltip, type TooltipProps } from './tooltip';
import { cn } from './cn';

export interface FieldHintProps {
  /** Description text revealed in a tooltip on hover/focus of the info icon. */
  hint: React.ReactNode;
  side?: TooltipProps['side'];
  /** Accessible label for the info trigger. */
  label?: string;
  className?: string;
}

/**
 * Small info icon that reveals a form field's description in a tooltip on
 * hover or keyboard focus — used next to a field label instead of printing
 * the description as static helper text.
 */
export function FieldHint({
  hint,
  side = 'top',
  label = 'Daha fazla bilgi',
  className,
}: FieldHintProps) {
  return (
    <Tooltip
      content={hint}
      side={side}
      // Override the tooltip's default single-line layout so longer
      // descriptions wrap instead of overflowing on small screens.
      className="!whitespace-normal max-w-[220px] text-left leading-snug"
    >
      <button
        type="button"
        aria-label={label}
        // Sits inside <label>; prevent the click from focusing the field.
        onClick={(event) => event.preventDefault()}
        className={cn(
          'inline-flex h-4 w-4 items-center justify-center rounded-full text-stone-400',
          'transition-colors hover:text-stone-600',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40',
          className,
        )}
      >
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
          <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 7.2v3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="8" cy="5.1" r="0.85" fill="currentColor" />
        </svg>
      </button>
    </Tooltip>
  );
}
