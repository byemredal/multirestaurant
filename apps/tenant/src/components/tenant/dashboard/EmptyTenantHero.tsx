'use client';

import type { ReactElement, SVGProps } from 'react';
import Link from 'next/link';

function StorefrontIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M3 9.5 5 5h14l2 4.5" />
      <path d="M3 9.5h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0v-2Z" />
      <path d="M5 13v7h14v-7" />
      <path d="M10 20v-4h4v4" />
    </svg>
  );
}

function ChecklistIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="m4 7 2 2 4-4" />
      <path d="m4 14 2 2 4-4" />
      <path d="M14 7h6" />
      <path d="M14 14h6" />
      <path d="M14 21h6" />
      <path d="m4 21 2-2" />
    </svg>
  );
}

function MenuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </svg>
  );
}

export function EmptyTenantHero(): ReactElement {
  return (
    <section className="overflow-hidden rounded-[20px] border border-slate-100 bg-white">
      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#09479A]/20 bg-[#09479A]/[0.05] px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#09479A]">
            Hoş geldin
          </div>
          <h2 className="mt-3 text-[24px] font-semibold leading-tight tracking-[-0.025em] text-slate-900 sm:text-[28px]">
            İlk restoranını oluşturarak başla
          </h2>
          <p className="mt-2 max-w-[560px] text-[14px] leading-7 text-slate-600">
            Henüz panelinde aktif bir restoran yok. Restoran bilgilerini gir, ilk kategori ile birkaç ürün ekle —
            müşteri vitrini birkaç dakika içinde canlı olur.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/studio"
              className="inline-flex items-center gap-2 rounded-[12px] bg-[#09479A] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_22px_rgba(9,71,154,0.22)] transition hover:bg-[#073a82]"
            >
              Restoran oluştur
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:border-[#09479A]/30 hover:text-[#09479A]"
            >
              Önce ayarları gör
            </Link>
          </div>
        </div>

        <div className="hidden h-[180px] w-[180px] shrink-0 items-center justify-center rounded-[20px] bg-[radial-gradient(circle_at_30%_20%,_rgba(9,71,154,0.15),_transparent_60%),linear-gradient(135deg,#f8fafc,#eef2ff)] text-[#09479A] lg:flex">
          <StorefrontIcon className="h-20 w-20" />
        </div>
      </div>

      <div className="grid gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-3">
        <HintTile
          icon={StorefrontIcon}
          title="1 · Restoranı tanımla"
          description="Ad, adres ve teslimat bölgeleri."
        />
        <HintTile
          icon={ChecklistIcon}
          title="2 · Kategorileri kur"
          description="Pizzalar, içecekler, tatlılar…"
        />
        <HintTile
          icon={MenuIcon}
          title="3 · İlk ürünleri ekle"
          description="Fiyat ve varsa seçenekler."
        />
      </div>
    </section>
  );
}

function HintTile({
  icon: Icon,
  title,
  description,
}: {
  icon: (props: SVGProps<SVGSVGElement>) => ReactElement;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-slate-100 bg-slate-50 text-[#09479A]">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold tracking-[-0.005em] text-slate-900">{title}</div>
          <div className="mt-0.5 text-[11.5px] leading-5 text-slate-500">{description}</div>
        </div>
      </div>
    </div>
  );
}
