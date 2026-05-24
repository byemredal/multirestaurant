import * as React from 'react';
import { cn } from './cn';

type SwitchSize = 'sm' | 'md';

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: React.ReactNode;
  size?: SwitchSize;
}

/** Toggle switch built on a native checkbox — works controlled or uncontrolled. */
export function Switch({ className, label, size = 'md', disabled, ...props }: SwitchProps) {
  const sm = size === 'sm';
  return (
    <label
      className={cn(
        'inline-flex items-center gap-2.5',
        disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer',
        className,
      )}
    >
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" disabled={disabled} {...props} />
        <span
          className={cn(
            'rounded-full bg-ink-300 transition-colors duration-200',
            'peer-checked:bg-primary',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-primary/35 peer-focus-visible:ring-offset-1',
            sm ? 'h-5 w-9' : 'h-6 w-11',
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            'absolute left-0.5 top-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm',
            'transition-transform duration-200 ease-out',
            sm ? 'h-4 w-4 peer-checked:translate-x-4' : 'h-5 w-5 peer-checked:translate-x-5',
          )}
        />
      </span>
      {label && <span className="select-none text-[14px] font-medium text-ink-700">{label}</span>}
    </label>
  );
}
