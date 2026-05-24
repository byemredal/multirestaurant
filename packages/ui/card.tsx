import * as React from 'react';
import { cn } from './cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds a hover lift + shadow transition — use for clickable cards. */
  interactive?: boolean;
  /** Drops the border and shadow for a flat, seamless surface. */
  flat?: boolean;
}

export function Card({ className, interactive = false, flat = false, ...props }: CardProps) {
  return (
    <section
      className={cn(
        'rounded-2xl bg-white transition-all duration-200',
        flat ? 'border border-transparent' : 'border border-ink-200 shadow-card',
        interactive && 'cursor-pointer hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-pop',
        className,
      )}
      {...props}
    />
  );
}
