'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import TenantDashboardShell from '@/components/tenant/TenantDashboardShell';
import { useTenantAuth } from '@/lib/auth/tenant-auth-context';
import { cn } from '@lieferzonen/ui';

type SettingsNavItem = {
  href: string;
  label: string;
  description: string;
  comingSoon?: boolean;
};

const SETTINGS_NAV: SettingsNavItem[] = [
  { href: '/dashboard/settings', label: 'Genel', description: 'Hesap ve vitrin özeti' },
  {
    href: '/dashboard/settings/storefront',
    label: 'Vitrin',
    description: 'Görünüm ve marka',
    comingSoon: true,
  },
  {
    href: '/dashboard/settings/notifications',
    label: 'Bildirimler',
    description: 'E-posta ve sipariş bildirimleri',
    comingSoon: true,
  },
  {
    href: '/dashboard/settings/billing',
    label: 'Faturalama / Vergi',
    description: 'Platform faturalama',
    comingSoon: true,
  },
  {
    href: '/dashboard/settings/legal',
    label: 'Yasal / Dokümanlar',
    description: 'Mesafeli satış ve ön bilgilendirme',
  },
  {
    href: '/dashboard/settings/integrations',
    label: 'Entegrasyonlar',
    description: 'Ödeme, teslimat ve servisler',
    comingSoon: true,
  },
  {
    href: '/dashboard/settings/security',
    label: 'Güvenlik',
    description: 'Oturum ve erişim',
    comingSoon: true,
  },
  {
    href: '/dashboard/staff',
    label: 'Kullanıcılar / Ekip',
    description: 'Ekip ve roller',
  },
];

export default function TenantSettingsLayout({ children }: { children: ReactNode }) {
  const { session, logout } = useTenantAuth();
  const pathname = usePathname();

  return (
    <TenantDashboardShell
      companyName={session?.tenant.companyName ?? 'Tenant çalışma alanı'}
      currentHref="/dashboard/settings"
      description="Tenant ve vitrin genel ayarlarını buradan yönetin. Restoran düzeyindeki ayarlar restoran detayında yer alır."
      onSignOut={() => void logout()}
      title="Ayarlar"
      userName={
        `${session?.tenant.firstName ?? ''} ${session?.tenant.lastName ?? ''}`.trim() ||
        'Tenant Yönetici'
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,240px)_1fr]">
        <nav className="grid h-fit gap-1 rounded-[18px] border border-[#ece2d2] bg-white p-2">
          {SETTINGS_NAV.map((item) => {
            const active =
              item.href === '/dashboard/settings'
                ? pathname === item.href
                : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col gap-0.5 rounded-[12px] px-3 py-2.5 transition-colors',
                  active
                    ? 'bg-[#1c1917] text-white'
                    : 'text-[#44403c] hover:bg-[#f7f3ec]',
                )}
              >
                <span className="flex items-center justify-between gap-2 text-[13.5px] font-semibold">
                  {item.label}
                  {item.comingSoon ? (
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        active ? 'bg-white/20 text-white' : 'bg-[#f0e9dc] text-[#a8a29e]',
                      )}
                    >
                      Yakında
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    'text-[11.5px]',
                    active ? 'text-white/70' : 'text-[#a8a29e]',
                  )}
                >
                  {item.description}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="min-w-0">{children}</div>
      </div>
    </TenantDashboardShell>
  );
}
