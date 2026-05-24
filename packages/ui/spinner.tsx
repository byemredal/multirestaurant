import * as React from 'react';
import { cn } from './cn';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<SpinnerSize, string> = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
};

export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  size?: SpinnerSize;
}

/** Lightweight loading spinner — an arc that rotates over a faint track ring. */
export function Spinner({ size = 'md', className, ...props }: SpinnerProps) {
  return (
    <svg
      role="status"
      aria-label="Yükleniyor"
      viewBox="0 0 24 24"
      fill="none"
      className={cn('animate-spin', SIZES[size], className)}
      {...props}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="opacity-90"
      />
    </svg>
  );
}
