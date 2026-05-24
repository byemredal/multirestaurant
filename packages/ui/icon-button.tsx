import * as React from 'react';
import { cn } from './cn';
import { Spinner } from './spinner';

type IconButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger';
type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  loading?: boolean;
  /** Required — icon buttons carry no visible label. */
  'aria-label': string;
}

const BASE =
  'inline-flex shrink-0 select-none items-center justify-center rounded-[10px] ' +
  'transition-all duration-200 ease-out active:scale-90 outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1 ' +
  'disabled:pointer-events-none disabled:opacity-55';

const SIZES: Record<IconButtonSize, string> = {
  sm: 'h-9 w-9 [&>svg]:h-4 [&>svg]:w-4',
  md: 'h-11 w-11 [&>svg]:h-[18px] [&>svg]:w-[18px]',
  lg: 'h-12 w-12 [&>svg]:h-5 [&>svg]:w-5',
};

const VARIANTS: Record<IconButtonVariant, string> = {
  primary: 'bg-primary text-white shadow-sm hover:bg-primary-600',
  secondary: 'border border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50',
  soft: 'bg-primary-50 text-primary-700 hover:bg-primary-100',
  ghost: 'bg-transparent text-ink-600 hover:bg-ink-100 hover:text-ink-800',
  danger: 'bg-danger-50 text-danger-600 hover:bg-danger-100',
};

/** Square, icon-only button. Pass a single SVG/icon as children. */
export function IconButton({
  className,
  variant = 'ghost',
  size = 'md',
  loading = false,
  type = 'button',
  disabled,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(BASE, SIZES[size], VARIANTS[variant], className)}
      {...props}
    >
      {loading ? <Spinner size={size === 'sm' ? 'sm' : 'md'} /> : children}
    </button>
  );
}
