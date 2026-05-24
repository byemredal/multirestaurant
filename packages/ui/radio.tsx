import * as React from 'react';
import { cn } from './cn';

export interface RadioProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: React.ReactNode;
}

/** Native radio with a custom-styled ring and an animated inner dot. */
export function Radio({ className, label, disabled, ...props }: RadioProps) {
  return (
    <label
      className={cn(
        'inline-flex items-center gap-2.5',
        disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer',
        className,
      )}
    >
      <span className="relative inline-flex h-5 w-5 shrink-0">
        <input type="radio" className="peer sr-only" disabled={disabled} {...props} />
        <span
          className={cn(
            'inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-ink-300 bg-white',
            'transition-colors duration-150',
            'peer-checked:border-primary',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-primary/35 peer-focus-visible:ring-offset-1',
            'peer-checked:[&>span]:scale-100',
          )}
        >
          <span className="h-2.5 w-2.5 scale-0 rounded-full bg-primary transition-transform duration-150 ease-out" />
        </span>
      </span>
      {label && <span className="select-none text-[14px] font-medium text-ink-700">{label}</span>}
    </label>
  );
}
