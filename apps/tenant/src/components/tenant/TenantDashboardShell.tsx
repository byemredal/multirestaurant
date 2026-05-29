'use client';

import type { ReactElement, ReactNode, SVGProps } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@lieferzonen/ui';
import { PlatformLogo } from '@lieferzonen/ui';
import { apiBaseUrl } from '@/lib/tenant-client';
import { useTenantOrderStream } from '@/lib/realtime/tenant-order-stream-context';
import { StoreSwitcher } from '@/components/tenant/StoreSwitcher';

type NavItem = {
  id: string;
  label: string;
  section: string;
  description: string;
  icon: (props: SVGProps<SVGSVGElement>) => ReactElement;
  href: string;
  active?: boolean;
  /** Sidebar nav item'ın sağında gösterilecek dikkat sayacı. */
  badgeCount?: number;
};

function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...props}>
      <rect x="4" y="4" width="7" height="9" rx="1.5" />
      <rect x="13" y="4" width="7" height="5" rx="1.5" />
      <rect x="4" y="15" width="7" height="5" rx="1.5" />
      <rect x="13" y="11" width="7" height="9" rx="1.5" />
    </svg>
  );
}

function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...props}>
      <path d="M12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.04.04a2 2 0 1 1-2.83 2.83l-.04-.04a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.92V20a2 2 0 1 1-4 0v-.06a1 1 0 0 0-.66-.93 1 1 0 0 0-1.1.2l-.04.04a2 2 0 1 1-2.83-2.83l.04-.04a1 1 0 0 0 .2-1.1 1 1 0 0 0-.92-.6H4a2 2 0 1 1 0-4h.06a1 1 0 0 0 .93-.66 1 1 0 0 0-.2-1.1l-.04-.04a2 2 0 1 1 2.83-2.83l.04.04a1 1 0 0 0 1.1.2h.01A1 1 0 0 0 9.65 4.06V4a2 2 0 1 1 4 0v.06a1 1 0 0 0 .66.93 1 1 0 0 0 1.1-.2l.04-.04a2 2 0 1 1 2.83 2.83l-.04.04a1 1 0 0 0-.2 1.1v.01a1 1 0 0 0 .92.59H20a2 2 0 1 1 0 4h-.06a1 1 0 0 0-.54.17" />
    </svg>
  );
}

function CutleryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...props}>
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...props}>
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M9 4.5h6a1.5 1.5 0 0 0-3-1h0a1.5 1.5 0 0 0-3 1Z" />
      <path d="M9 10h6" />
      <path d="M9 14h6" />
    </svg>
  );
}

function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...props}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

function ChevronIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function MenuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

export default function TenantDashboardShell({
  currentHref,
  title,
  description,
  companyName,
  userName,
  onSignOut,
  children,
  mobileStickyActions,
}: {
  currentHref: string;
  title: string;
  description: string;
  companyName: string;
  userName: string;
  onSignOut: () => void | Promise<void>;
  children: ReactNode;
  mobileStickyActions?: ReactNode;
}) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'Tenant Paneli': true,
  });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const { pendingCount } = useTenantOrderStream();

  // Route değişince drawer'ı kapat — Link tıklaması mobil drawer içindeyse de geçerli.
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [currentHref]);

  // Esc ile drawer'ı kapat.
  useEffect(() => {
    if (!mobileDrawerOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileDrawerOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileDrawerOpen]);

  // Drawer açıkken body scroll'unu kilitle.
  useEffect(() => {
    if (!mobileDrawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileDrawerOpen]);

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Operasyon',
      section: 'Tenant Paneli',
      description: 'Canlı sipariş ve günlük özet',
      href: '/dashboard',
      active: currentHref === '/dashboard',
      icon: DashboardIcon,
    },
    {
      id: 'orders',
      label: 'Siparişler',
      section: 'Tenant Paneli',
      description: 'Aktif ve geçmiş siparişler',
      href: '/orders',
      active: currentHref.startsWith('/orders'),
      icon: ClipboardIcon,
      badgeCount: pendingCount > 0 ? pendingCount : undefined,
    },
    {
      id: 'studio',
      label: 'Restoran & Menü',
      section: 'Tenant Paneli',
      description: 'Restoran, menü ve seçenekler',
      href: '/dashboard/studio',
      active: currentHref === '/dashboard/studio',
      icon: CutleryIcon,
    },
    {
      id: 'settings',
      label: 'Ayarlar',
      section: 'Tenant Paneli',
      description: 'Vitrin ve yerel yapılandırma',
      href: '/dashboard/settings',
      active: currentHref === '/dashboard/settings',
      icon: SettingsIcon,
    },
  ];

  const sections = Array.from(new Set(navItems.map((item) => item.section)));

  const sidebar = (
    <aside className="flex h-full flex-col border-r border-slate-100 bg-white p-4">
      <div className="flex flex-col items-start gap-3 border-b border-slate-100 px-2 pb-4">
        <div className="flex min-h-[34px] min-w-[46px] items-center justify-center pt-0.5">
          <PlatformLogo apiBaseUrl={apiBaseUrl} height={30} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
            Tenant
          </div>
          <p className="mt-1 max-w-[190px] text-[11.5px] leading-5 text-slate-500">
            Restoran operasyonu ve vitrin kontrol paneli.
          </p>
        </div>
        <button
          type="button"
          aria-label="Menüyü kapat"
          onClick={() => setMobileDrawerOpen(false)}
          className="-mr-1 mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-[#24A94A]/30 hover:text-[#24A94A] lg:hidden"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 rounded-[16px] border border-slate-100 bg-slate-50/60 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,#24A94A,#1F9D52)] text-white shadow-[0_10px_22px_rgba(9,71,154,0.22)]">
            <UserIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="truncate text-[14.5px] font-semibold tracking-[-0.01em] text-slate-900">
              {userName}
            </div>
            <div className="mt-0.5 truncate text-[12px] text-slate-500">{companyName}</div>
          </div>
        </div>
      </div>

      <StoreSwitcher />

      <nav className="mt-4 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
        <div className="grid gap-4">
          {sections.map((section) => (
            <div key={section}>
              <button
                className="flex w-full items-center justify-between px-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 transition hover:text-slate-600"
                onClick={() =>
                  setOpenSections((current) => ({
                    ...current,
                    [section]: !current[section],
                  }))
                }
                type="button"
                aria-expanded={openSections[section] ?? false}
              >
                <span>{section}</span>
                <ChevronIcon
                  className={cn(
                    'h-4 w-4 transition-transform',
                    openSections[section] ? 'rotate-180' : '',
                  )}
                />
              </button>

              {openSections[section] ? (
                <div className="mt-2 grid gap-1.5">
                  {navItems
                    .filter((item) => item.section === section)
                    .map((item) => {
                      const Icon = item.icon;
                      const baseClass =
                        'flex w-full items-center justify-between rounded-[12px] border px-3 py-2.5 text-left transition';

                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          aria-current={item.active ? 'page' : undefined}
                          className={cn(
                            baseClass,
                            item.active
                              ? 'border-[#24A94A]/25 bg-[#24A94A]/[0.06]'
                              : 'border-slate-100 bg-white hover:border-[#24A94A]/20 hover:bg-[#24A94A]/[0.03]',
                          )}
                        >
                          <span className="flex items-center gap-3">
                            {
                              item.active ? (
                                <span
                                  className="rounded-full animate-pulse bg-[#24A94A] w-2 h-2"></span>
                              ) : null
                            }
                            <span
                              className={cn(
                                'flex h-9 w-9 items-center justify-center rounded-[10px] border transition',
                                item.active
                                  ? 'border-[#24A94A]/20 bg-white text-[#24A94A]'
                                  : 'border-slate-100 bg-slate-50 text-slate-500',
                              )}
                            >
                              <Icon className="h-[17px] w-[17px]" />
                            </span>
                            <span>
                              <span
                                className={cn(
                                  'block text-[13px] font-semibold tracking-[-0.005em]',
                                  item.active ? 'text-[#24A94A]' : 'text-slate-900',
                                )}
                              >
                                {item.label}
                              </span>
                              <span className="block text-[10.5px] text-slate-400">
                                {item.description}
                              </span>
                            </span>
                          </span>
                          {item.badgeCount ? (
                            <span
                              className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white shadow-[0_4px_10px_rgba(245,158,11,0.35)]"
                              aria-label={`${item.badgeCount} onay bekleyen sipariş`}
                            >
                              {item.badgeCount}
                            </span>
                          ) : null}
                        </Link>
                      );
                    })}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </nav>

      <button
        className="mt-4 flex items-center justify-between rounded-[12px] border border-slate-100 bg-white px-4 py-3 text-left text-slate-600 transition hover:border-red-200 hover:bg-red-50/40 hover:text-red-600"
        onClick={() => void onSignOut()}
        type="button"
      >
        <span className="text-[13px] font-semibold">Çıkış yap</span>
        <span className="rounded-full border border-slate-100 bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
          Güvenli
        </span>
      </button>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(9,71,154,0.06),_transparent_24%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          aria-label="Menüyü aç"
          aria-expanded={mobileDrawerOpen}
          onClick={() => setMobileDrawerOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-slate-200 bg-white text-slate-700 transition hover:border-[#24A94A]/30 hover:text-[#24A94A]"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <PlatformLogo apiBaseUrl={apiBaseUrl} height={24} />
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Tenant
            </div>
            <div className="truncate text-[14px] font-semibold leading-tight text-slate-900">
              {title}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileDrawerOpen ? (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Tenant navigasyon"
        >
          <button
            type="button"
            aria-label="Menüyü kapat"
            onClick={() => setMobileDrawerOpen(false)}
            className="absolute inset-0 bg-slate-900/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-[320px] max-w-[88vw] flex-col p-3">
            {sidebar}
          </div>
        </div>
      ) : null}

      {/* Desktop sidebar — fixed, flush to the viewport's left edge, full height */}
      <div className="fixed left-0 top-0 z-30 hidden h-screen w-[284px] lg:block">
        {sidebar}
      </div>

      <div
        className={cn(
          'min-h-screen px-4 py-4 lg:pl-[284px] xl:px-6 xl:pl-[284px]',
          mobileStickyActions ? 'pb-24 lg:pb-4' : '',
        )}
      >
        <main className="min-w-0 lg:px-6 lg:py-2">
          <div className="rounded-[24px] border border-slate-100 bg-white/80 backdrop-blur">
            <div className="p-4 lg:p-6">
              <section className="rounded-[20px] border border-slate-100 bg-white p-5 lg:p-6">
                <div className="border-b border-slate-100 pb-5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                    Panel
                  </div>
                  <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[28px]">
                    {title}
                  </h1>
                  <p className="mt-2 max-w-[760px] text-[13.5px] leading-7 text-slate-500">
                    {description}
                  </p>
                </div>

                <div className="mt-6">{children}</div>
              </section>
            </div>
          </div>
        </main>
      </div>

      {mobileStickyActions ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          {mobileStickyActions}
        </div>
      ) : null}
    </div>
  );
}
