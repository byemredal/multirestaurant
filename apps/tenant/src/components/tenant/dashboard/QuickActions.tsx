'use client';

import { useState, type ReactElement, type SVGProps } from 'react';
import Link from 'next/link';
import { TestOrderLauncher } from '@/components/tenant/tools/TestOrderLauncher';

type Action = {
  href: string;
  label: string;
  description: string;
  icon: (props: SVGProps<SVGSVGElement>) => ReactElement;
};

function CutleryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M7 3v8" />
      <path d="M10 3v8" />
      <path d="M4 3v8a3 3 0 0 0 6 0" />
      <path d="M14 3v7a3 3 0 0 0 3 3h1v8" />
      <path d="M18 3v10" />
    </svg>
  );
}

function ClipboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M9 4.5h6a1.5 1.5 0 0 0-3-1h0a1.5 1.5 0 0 0-3 1Z" />
      <path d="M9 10h6" />
      <path d="M9 14h6" />
    </svg>
  );
}

function BeakerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M9 3h6" />
      <path d="M10 3v6.5L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V3" />
      <path d="M7.5 14h9" />
    </svg>
  );
}

function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const ACTIONS: Action[] = [
  {
    href: '/dashboard/studio',
    label: 'Restoran & Menü',
    description: 'Menü öğeleri, opsiyonlar ve restoran bilgisi',
    icon: CutleryIcon,
  },
  {
    href: '/orders',
    label: 'Tüm Siparişler',
    description: 'Aktif kuyruk ve geçmiş',
    icon: ClipboardIcon,
  },
  {
    href: '/dashboard/settings',
    label: 'Ayarlar',
    description: 'Ödeme, vergi, fiş ve teslimat ücretleri',
    icon: SettingsIcon,
  },
];

export function QuickActions() {
  const testOrderToolsEnabled =
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_ENABLE_TEST_ORDERS === 'true';
  const [testOrderOpen, setTestOrderOpen] = useState(false);

  return (
    <section className="rounded-[18px] border border-slate-100 bg-white p-6">
      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
        Hızlı Erişim
      </div>
      <h3 className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-slate-900">
        Kısayollar
      </h3>
      <div className="mt-4 grid gap-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="group flex items-center gap-3 rounded-[12px] border border-slate-100 bg-white p-3 transition hover:border-[#09479A]/30 hover:bg-[#09479A]/[0.03]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-slate-100 bg-slate-50 text-slate-500 transition group-hover:border-[#09479A]/20 group-hover:bg-white group-hover:text-[#09479A]">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-slate-900">
                  {action.label}
                </span>
                <span className="block truncate text-[11.5px] text-slate-500">
                  {action.description}
                </span>
              </span>
              <span
                className="text-[14px] font-bold text-slate-300 transition group-hover:text-[#09479A]"
                aria-hidden
              >
                →
              </span>
            </Link>
          );
        })}

        {testOrderToolsEnabled ? <button
          type="button"
          onClick={() => setTestOrderOpen(true)}
          className="group flex items-center gap-3 rounded-[12px] border border-amber-100 bg-amber-50/40 p-3 text-left transition hover:border-amber-200 hover:bg-amber-50"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-amber-100 bg-white text-amber-600 transition">
            <BeakerIcon className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold text-slate-900">
                Test siparişi oluştur
              </span>
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-amber-700">
                Tooling
              </span>
            </span>
            <span className="block truncate text-[11.5px] text-slate-500">
              Realtime ve dashboard akışını gerçek sipariş ile test et
            </span>
          </span>
          <span
            className="text-[14px] font-bold text-amber-300 transition group-hover:text-amber-600"
            aria-hidden
          >
            →
          </span>
        </button> : null}
      </div>

      {testOrderToolsEnabled ? (
        <TestOrderLauncher open={testOrderOpen} onClose={() => setTestOrderOpen(false)} />
      ) : null}
    </section>
  );
}
