import * as React from 'react';
import { cn } from './cn';

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: React.ReactNode;
  side?: TooltipSide;
  className?: string;
  children: React.ReactNode;
}

const POSITION: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
};

/** Pure-CSS tooltip — reveals on hover or keyboard focus, no JS state. */
export function Tooltip({ content, side = 'top', className, children }: TooltipProps) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-lg bg-ink-900 px-2.5 py-1.5',
          'text-[12px] font-medium text-white shadow-pop',
          'scale-95 opacity-0 transition-all duration-150 ease-out',
          'group-hover/tip:scale-100 group-hover/tip:opacity-100',
          'group-focus-within/tip:scale-100 group-focus-within/tip:opacity-100',
          POSITION[side],
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}
