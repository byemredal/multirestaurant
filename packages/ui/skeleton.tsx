import * as React from 'react';
import { cn } from './cn';

type SkeletonVariant = 'text' | 'circle' | 'rect';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
}

const VARIANTS: Record<SkeletonVariant, string> = {
  text: 'h-3.5 w-full rounded-md',
  circle: 'h-10 w-10 rounded-full',
  rect: 'h-24 w-full rounded-xl',
};

/** Pulsing placeholder block for loading states. Override size via className. */
export function Skeleton({ className, variant = 'text', ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse bg-ink-100', VARIANTS[variant], className)}
      {...props}
    />
  );
}
