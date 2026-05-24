'use client';

import type { ReactElement } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@lieferzonen/ui';
import type { SetupProgressResult } from '@/lib/dashboard/setup-progress';
import { SetupChecklistItem } from './SetupChecklistItem';

export function SetupProgressCard({
  progress,
  loading,
}: {
  progress: SetupProgressResult | null;
  loading: boolean;
}): ReactElement | null {
  const [collapsed, setCollapsed] = useState(false);

  if (loading) {
    return (
      <section className="rounded-[18px] border border-slate-100 bg-white p-6">
        <div className="h-3 w-24 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-3 h-5 w-64 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-5 h-2.5 w-full animate-pulse rounded-full bg-slate-100" />
        <div className="mt-5 grid gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-[14px] bg-slate-50" />
          ))}
        </div>
      </section>
    );
  }

  if (!progress) return null;

  if (progress.isComplete) {
    return (
      <section className="flex items-center justify-between gap-3 rounded-[18px] border border-emerald-100 bg-emerald-50/60 px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-4 w-4">
              <path d="m5 12 5 5 9-11" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700">
              Kurulum tamam
            </div>
            <p className="mt-0.5 text-[13.5px] font-semibold tracking-[-0.005em] text-emerald-900">
              Operasyona hazırsın. Tüm kurulum adımları tamamlandı.
            </p>
          </div>
        </div>
        <Link
          href="/orders"
          className="shrink-0 rounded-[10px] border border-emerald-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
        >
          Siparişlere git
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-[18px] border border-slate-100 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
            Kurulum durumu
          </div>
          <h3 className="mt-1 text-[16px] font-semibold tracking-[-0.01em] text-slate-900">
            Operasyona hazır olmak için {progress.totalCount - progress.doneCount} adım kaldı
          </h3>
          {progress.nextStep ? (
            <p className="mt-1 text-[12.5px] leading-5 text-slate-500">
              Sıradaki adım:{' '}
              <span className="font-semibold text-slate-700">{progress.nextStep.label}</span>
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              İlerleme
            </div>
            <div className="mt-0.5 text-[22px] font-bold tabular-nums tracking-[-0.02em] text-[#09479A]">
              %{progress.percent}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
            className="rounded-[10px] border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:border-[#09479A]/30 hover:text-[#09479A]"
          >
            {collapsed ? 'Aç' : 'Daralt'}
          </button>
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#09479A,#2563eb)] transition-[width] duration-500"
          style={{ width: `${progress.percent}%` }}
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11.5px] text-slate-500">
        <span>
          <span className="font-semibold text-slate-700 tabular-nums">{progress.doneCount}</span>
          {' / '}
          <span className="tabular-nums">{progress.totalCount}</span> adım tamam
        </span>
        <span className="hidden sm:inline">Eksikleri tamamladıkça oran otomatik artar.</span>
      </div>

      {!collapsed ? (
        <ul className={cn('mt-5 grid gap-2')}>
          {progress.steps.map((step) => (
            <SetupChecklistItem
              key={step.id}
              step={step}
              highlightNext={progress.nextStep?.id === step.id}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
