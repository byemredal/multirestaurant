import * as React from 'react';
import { cn } from './cn';

type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'outline';
type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Shows a leading status dot tinted to match the variant. */
  dot?: boolean;
}

const SIZES: Record<BadgeSize, string> = {
  sm: 'h-5 gap-1 px-2 text-[11px]',
  md: 'h-6 gap-1.5 px-2.5 text-[12px]',
};

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: 'bg-ink-100 text-ink-700',
  primary: 'bg-primary-50 text-primary-700',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
  outline: 'border border-ink-200 bg-white text-ink-700',
};

const DOTS: Record<BadgeVariant, string> = {
  neutral: 'bg-ink-400',
  primary: 'bg-primary-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  outline: 'bg-ink-400',
};

export function Badge({
  className,
  variant = 'neutral',
  size = 'md',
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold leading-none',
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', DOTS[variant])} />}
      {children}
    </span>
  );
}
