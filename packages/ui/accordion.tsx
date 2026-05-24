'use client';

import * as React from 'react';
import { cn } from './cn';

export interface AccordionItemData {
  id: string;
  title: React.ReactNode;
  content: React.ReactNode;
}

export interface AccordionProps {
  items: AccordionItemData[];
  /** Id (or ids) open on first render. */
  defaultOpen?: string | string[];
  /** Allow more than one panel open at a time. */
  allowMultiple?: boolean;
  className?: string;
}

/** Accordion with a smooth grid-rows height transition — no fixed max-height. */
export function Accordion({ items, defaultOpen, allowMultiple = false, className }: AccordionProps) {
  const [open, setOpen] = React.useState<string[]>(
    defaultOpen ? (Array.isArray(defaultOpen) ? defaultOpen : [defaultOpen]) : [],
  );

  const toggle = (id: string) => {
    setOpen((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id);
      return allowMultiple ? [...current, id] : [id];
    });
  };

  return (
    <div
      className={cn(
        'divide-y divide-ink-200 overflow-hidden rounded-xl border border-ink-200 bg-white',
        className,
      )}
    >
      {items.map((item) => {
        const on = open.includes(item.id);
        return (
          <div key={item.id}>
            <button
              type="button"
              aria-expanded={on}
              onClick={() => toggle(item.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-[14px] font-semibold text-ink-800 outline-none transition-colors hover:bg-ink-50 focus-visible:bg-ink-50"
            >
              {item.title}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className={cn(
                  'h-4 w-4 shrink-0 text-ink-400 transition-transform duration-300',
                  on && 'rotate-180',
                )}
              >
                <path
                  d="m6 9 6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div
              className={cn(
                'grid transition-[grid-template-rows] duration-300 ease-out',
                on ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <div className="px-4 pb-4 text-[13px] leading-relaxed text-ink-600">
                  {item.content}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
