import * as React from 'react';
import { cn } from './cn';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-[10px] border border-ink-300 bg-white px-3 py-2.5 text-[14px] text-ink-800 outline-none transition',
        'placeholder:text-ink-400',
        'focus:border-primary focus:ring-2 focus:ring-primary/20',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}
