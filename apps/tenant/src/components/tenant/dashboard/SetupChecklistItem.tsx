'use client';

import type { ReactElement, SVGProps } from 'react';
import Link from 'next/link';
import { cn } from '@lieferzonen/ui';
import type { SetupStep } from '@/lib/dashboard/setup-progress';

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" {...props}>
      <path d="m5 12 5 5 9-11" />
    </svg>
  );
}

function PendingDotIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}

export function SetupChecklistItem({
  step,
  highlightNext,
}: {
  step: SetupStep;
  highlightNext: boolean;
}): ReactElement {
  const isDone = step.status === 'done';
  const isNext = !isDone && highlightNext;

  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-[14px] border px-4 py-3 transition',
        isDone
          ? 'border-emerald-100 bg-emerald-50/40'
          : isNext
            ? 'border-[#09479A]/25 bg-[#09479A]/[0.04]'
            : 'border-slate-100 bg-white',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
          isDone
            ? 'border-emerald-200 bg-emerald-500 text-white'
            : isNext
              ? 'border-[#09479A]/30 bg-white text-[#09479A]'
              : 'border-slate-200 bg-white text-slate-400',
        )}
      >
        {isDone ? (
          <CheckIcon className="h-3.5 w-3.5" />
        ) : (
          <PendingDotIcon className="h-2.5 w-2.5" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn(
              'text-[13.5px] font-semibold tracking-[-0.005em]',
              isDone ? 'text-emerald-900' : 'text-slate-900',
            )}
          >
            {step.label}
          </span>
          {isNext ? (
            <span className="rounded-full bg-[#09479A]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#09479A]">
              Sıradaki
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-[12px] leading-5 text-slate-500">{step.description}</p>
      </div>

      {!isDone ? (
        <Link
          href={step.ctaHref}
          className={cn(
            'shrink-0 self-center whitespace-nowrap rounded-[10px] border px-3 py-1.5 text-[12px] font-semibold transition',
            isNext
              ? 'border-transparent bg-[#09479A] text-white hover:bg-[#073a82]'
              : 'border-slate-200 bg-white text-slate-700 hover:border-[#09479A]/30 hover:text-[#09479A]',
          )}
        >
          {step.ctaLabel}
        </Link>
      ) : null}
    </li>
  );
}
