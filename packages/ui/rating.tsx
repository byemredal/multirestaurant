'use client';

import * as React from 'react';
import { cn } from './cn';

type RatingSize = 'sm' | 'md' | 'lg';

export interface RatingProps {
  value?: number;
  max?: number;
  /** When provided (and not read-only), stars become clickable. */
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: RatingSize;
  className?: string;
}

const SIZES: Record<RatingSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
};

function StarSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.5l2.95 5.98 6.6.96-4.77 4.65 1.13 6.57L12 17.6l-5.9 3.1 1.13-6.57L2.45 9.44l6.6-.96L12 2.5Z" />
    </svg>
  );
}

/** Star rating — fractional display (e.g. 4.5) for read-only, whole-step picking. */
export function Rating({
  value = 0,
  max = 5,
  onChange,
  readOnly = false,
  size = 'md',
  className,
}: RatingProps) {
  const [hover, setHover] = React.useState<number | null>(null);
  const interactive = !readOnly && typeof onChange === 'function';
  const shown = hover ?? value;
  const sizeClass = SIZES[size];

  return (
    <div
      role="img"
      aria-label={`${value} / ${max}`}
      className={cn('inline-flex items-center gap-0.5', className)}
      onMouseLeave={() => setHover(null)}
    >
      {Array.from({ length: max }, (_, i) => {
        const fill = Math.max(0, Math.min(1, shown - i));
        const star = (
          <span className={cn('relative inline-block', sizeClass)}>
            <StarSvg className={cn('absolute inset-0 text-ink-200', sizeClass)} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <StarSvg className={cn('text-warning-400', sizeClass)} />
            </span>
          </span>
        );

        if (!interactive) return <span key={i}>{star}</span>;

        return (
          <button
            key={i}
            type="button"
            aria-label={`${i + 1} yıldız`}
            onMouseEnter={() => setHover(i + 1)}
            onClick={() => onChange?.(i + 1)}
            className="outline-none transition-transform duration-150 hover:scale-110 active:scale-95 focus-visible:scale-110"
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}
