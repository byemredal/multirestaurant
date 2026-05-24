import * as React from 'react';
import { cn } from './cn';

type ProgressVariant = 'primary' | 'success' | 'warning' | 'danger';
type ProgressSize = 'sm' | 'md';

export interface ProgressProps {
  value: number;
  max?: number;
  variant?: ProgressVariant;
  size?: ProgressSize;
  /** Shows the rounded percentage to the right of the track. */
  showLabel?: boolean;
  className?: string;
}

const FILL: Record<ProgressVariant, string> = {
  primary: 'bg-primary',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
};

/** Determinate progress bar with a smooth width transition and a glossy fill. */
export function Progress({
  value,
  max = 100,
  variant = 'primary',
  size = 'md',
  showLabel = false,
  className,
}: ProgressProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn(
          'relative w-full overflow-hidden rounded-full bg-ink-100',
          size === 'sm' ? 'h-1.5' : 'h-2.5',
        )}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500 ease-out', FILL[variant])}
          style={{ width: `${pct}%` }}
        >
          <span className="block h-full w-full bg-gradient-to-b from-white/25 to-transparent" />
        </div>
      </div>
      {showLabel && (
        <span className="w-9 shrink-0 text-right text-[12px] font-semibold tabular-nums text-ink-600">
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}
