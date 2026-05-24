import * as React from 'react';
import { cn } from './cn';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: React.ReactNode;
}

/** Native checkbox with a custom-styled box and an animated checkmark. */
export function Checkbox({ className, label, disabled, ...props }: CheckboxProps) {
  return (
    <label
      className={cn(
        'inline-flex items-center gap-2.5',
        disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer',
        className,
      )}
    >
      <span className="relative inline-flex h-5 w-5 shrink-0">
        <input type="checkbox" className="peer sr-only" disabled={disabled} {...props} />
        <span
          className={cn(
            'inline-flex h-5 w-5 items-center justify-center rounded-[7px] border-2 border-ink-300 bg-white',
            'transition-colors duration-150',
            'peer-checked:border-primary peer-checked:bg-primary',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-primary/35 peer-focus-visible:ring-offset-1',
            'peer-checked:[&>svg]:scale-100',
          )}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-3.5 w-3.5 scale-0 text-white transition-transform duration-150 ease-out"
          >
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>
      {label && <span className="select-none text-[14px] font-medium text-ink-700">{label}</span>}
    </label>
  );
}
