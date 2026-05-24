import * as React from 'react';
import { cn } from './cn';
import { Spinner } from './spinner';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'soft' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonRounded = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  rounded?: ButtonRounded;
  /** Optional light-sweep shimmer that glides across the button on hover. */
  shimmer?: boolean;
  /** Shows a centered spinner, hides the label and blocks interaction. */
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const BASE =
  'group relative inline-flex select-none items-center justify-center gap-2 ' +
  'overflow-hidden whitespace-nowrap font-semibold leading-none ' +
  'transition-all duration-200 ease-out active:scale-[0.97] outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1 ' +
  'disabled:pointer-events-none disabled:opacity-55';

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-[13px]',
  md: 'h-11 px-5 text-[14px]',
  lg: 'h-12 px-6 text-[15px]',
};

const ROUNDED: Record<ButtonRounded, string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl', 
  full: 'rounded-full',
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white shadow-sm hover:bg-primary-600 hover:shadow-pop active:bg-primary-700',
  secondary:
    'border border-ink-200 bg-white text-ink-800 hover:border-ink-300 hover:bg-ink-50',
  outline:
    'border border-primary/35 bg-transparent text-primary hover:border-primary hover:bg-primary-50',
  soft:
    'bg-primary-50 text-primary-700 hover:bg-primary-100 active:bg-primary-200',
  ghost:
    'bg-transparent text-ink-700 hover:bg-ink-100 active:bg-ink-200',
  danger:
    'bg-danger-600 text-white shadow-sm hover:bg-danger-700 active:bg-danger-700',
};

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  rounded = 'md',
  shimmer = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  type = 'button',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(BASE, SIZES[size], VARIANTS[variant], ROUNDED[rounded], fullWidth && 'w-full', className)}
      {...props}
    >
      {shimmer && (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12',
            'bg-gradient-to-r from-transparent via-white/35 to-transparent',
            'transition-[left] duration-700 ease-out group-hover:left-full',
          )}
        />
      )}

      {loading && (
        <span className="absolute inset-0 z-20 inline-flex items-center justify-center">
          <Spinner size={size === 'lg' ? 'md' : 'sm'} />
        </span>
      )}

      {!loading && leftIcon && (
        <span className="relative z-10 inline-flex shrink-0">{leftIcon}</span>
      )}
      {children != null && (
        <span className={cn('relative z-10', loading && 'opacity-0')}>{children}</span>
      )}
      {!loading && rightIcon && (
        <span className="relative z-10 inline-flex shrink-0">{rightIcon}</span>
      )}
    </button>
  );
}
