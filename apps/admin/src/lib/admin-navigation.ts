import type { AccessGroup } from '@/lib/rbac/roles';
import type { TerminologyPreset } from '@/lib/terminology/terminology.config';
import type { IconName } from '@/lib/icons';

/**
 * Workflow-driven navigation.
 *
 * The sidebar is organised by operational domain, NOT by database table.
 * Labels that depend on installation terminology are resolved lazily via
 * `dynamicLabel` so the same config works for Tenant/Store, Tenant/Store,
 * Brand/Location, etc.
 */

export type AdminNavItem = {
  id: string;
  label: string;
  /** Overrides `label` when terminology must be applied. */
  dynamicLabel?: (t: TerminologyPreset) => string;
  href: string;
  icon: IconName;
  matches: (pathname: string) => boolean;
  /** Renders a "Soon" pill in the sidebar. */
  comingSoon?: boolean;
  /** Key into the live badge map (counts surfaced by pages). */
  badgeKey?: string;
};

export type AdminNavSection = {
  id: string;
  label: string;
  dynamicLabel?: (t: TerminologyPreset) => string;
  access: AccessGroup;
  items: AdminNavItem[];
};

const exact = (href: string) => (pathname: string) => pathname === href;
const startsWith = (href: string) => (pathname: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export const adminNavSections: AdminNavSection[] = [
  {
    id: 'overview',
    label: 'Genel Bakış',
    access: 'overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', href: '/', icon: 'home', matches: exact('/') },
      {
        id: 'live-activity',
        label: 'Canlı Etkinlikler',
        href: '/live-activity',
        icon: 'activity',
        matches: startsWith('/live-activity'),
      },
      {
        id: 'alerts',
        label: 'Uyarılar ve Olaylar',
        href: '/alerts',
        icon: 'alert',
        matches: startsWith('/alerts'),
        badgeKey: 'alerts',
      },
    ],
  },
  {
    id: 'tenants',
    label: 'Partner',
    dynamicLabel: (t) => t.tenant.plural,
    access: 'tenants',
    items: [
      {
        id: 'tenant-list',
        label: 'Partner Listesi',
        dynamicLabel: (t) => `${t.tenant.singular} List`,
        href: '/tenants',
        icon: 'building',
        matches: startsWith('/tenants'),
      },
      {
        id: 'tenant-applications',
        label: 'Partner Başvuruları',
        dynamicLabel: (t) => `${t.tenant.singular} Applications`,
        href: '/tenant-applications',
        icon: 'inbox',
        matches: startsWith('/tenant-applications'),
        badgeKey: 'applications',
      },
      {
        id: 'store-list',
        label: 'Mağaza Listesi',
        dynamicLabel: (t) => `${t.store.singular} List`,
        href: '/stores',
        icon: 'store',
        matches: exact('/stores'),
      },
      {
        id: 'store-performance',
        label: 'Mağaza Performansı',
        dynamicLabel: (t) => `${t.store.singular} Performance`,
        href: '/store-performance',
        icon: 'chart',
        matches: startsWith('/store-performance'),
      },
      { id: 'menus', label: 'Menus', href: '/menus', icon: 'menu', matches: startsWith('/menus') },
      {
        id: 'campaigns',
        label: 'Kampanyalar',
        href: '/campaigns',
        icon: 'megaphone',
        matches: startsWith('/campaigns'),
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operasyonlar',
    access: 'operations',
    items: [
      { id: 'orders', label: 'Orders', href: '/orders', icon: 'bag', matches: startsWith('/orders') },
      {
        id: 'delivery',
        label: 'Teslimat Yönetimi',
        href: '/delivery',
        icon: 'truck',
        matches: startsWith('/delivery'),
      },
      {
        id: 'service-availability',
        label: 'Hizmet Uygunluğu',
        href: '/service-availability',
        icon: 'clock',
        matches: startsWith('/service-availability'),
      },
      {
        id: 'operational-timeline',
        label: 'Operasyonel Timeline',
        href: '/operational-timeline',
        icon: 'timeline',
        matches: startsWith('/operational-timeline'),
      },
    ],
  },
  {
    id: 'finance',
    label: 'Finans',
    access: 'finance',
    items: [
      {
        id: 'transactions',
        label: 'İşlemler',
        href: '/finance/transactions',
        icon: 'card',
        matches: startsWith('/finance/transactions'),
      },
      {
        id: 'payouts',
        label: 'Ödemeler',
        href: '/finance/payouts',
        icon: 'payout',
        matches: startsWith('/finance/payouts'),
      },
      {
        id: 'commissions',
        label: 'Komisyonlar',
        href: '/finance/commissions',
        icon: 'percent',
        matches: startsWith('/finance/commissions'),
      },
      {
        id: 'refunds',
        label: 'İade Talepleri',
        href: '/finance/refunds',
        icon: 'refund',
        matches: startsWith('/finance/refunds'),
      },
      {
        id: 'financial-reports',
        label: 'Finansal Raporlar',
        href: '/finance/reports',
        icon: 'report',
        matches: startsWith('/finance/reports'),
      },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    access: 'platform',
    items: [
      {
        id: 'users-roles',
        label: 'Kullanıcılar & Roller',
        href: '/platform/users',
        icon: 'users',
        matches: startsWith('/platform/users'),
      },
      {
        id: 'permissions',
        label: 'İzinler',
        href: '/platform/permissions',
        icon: 'shield',
        matches: startsWith('/platform/permissions'),
      },
      {
        id: 'feature-flags',
        label: 'Özellik Bayrakları',
        href: '/platform/feature-flags',
        icon: 'flag',
        matches: startsWith('/platform/feature-flags'),
      },
      {
        id: 'integrations',
        label: 'Entegrasyonlar',
        href: '/platform/integrations',
        icon: 'plug',
        matches: startsWith('/platform/integrations'),
      },
      {
        id: 'api-webhooks',
        label: 'API & Webhooks',
        href: '/platform/api-webhooks',
        icon: 'webhook',
        matches: startsWith('/platform/api-webhooks'),
      },
      {
        id: 'audit-logs',
        label: 'Denetim Kayıtları',
        href: '/platform/audit-logs',
        icon: 'logs',
        matches: startsWith('/platform/audit-logs'),
      },
    ],
  },
  {
    id: 'ai',
    label: 'AI Merkezi',
    access: 'ai',
    items: [
      {
        id: 'ai-assistants',
        label: 'AI Asistanları',
        href: '/ai/assistants',
        icon: 'sparkles',
        matches: startsWith('/ai/assistants'),
        comingSoon: true,
      },
      {
        id: 'ai-actions',
        label: 'AI Aksiyonları',
        href: '/ai/actions',
        icon: 'bolt',
        matches: startsWith('/ai/actions'),
        comingSoon: true,
      },
      {
        id: 'ai-suggestions',
        label: 'AI Önerileri',
        href: '/ai/suggestions',
        icon: 'lightbulb',
        matches: startsWith('/ai/suggestions'),
        comingSoon: true,
      },
      {
        id: 'ai-runtime-logs',
        label: 'AI Çalışma Zamanı Günlükleri',
        href: '/ai/runtime-logs',
        icon: 'terminal',
        matches: startsWith('/ai/runtime-logs'),
        comingSoon: true,
      },
      {
        id: 'ai-approvals',
        label: 'AI Onay Kuyruğu',
        href: '/ai/approvals',
        icon: 'checklist',
        matches: startsWith('/ai/approvals'),
        comingSoon: true,
      },
    ],
  },
  {
    id: 'crm',
    label: 'CRM & Büyüme',
    access: 'crm',
    items: [
      { id: 'crm', label: 'CRM', href: '/crm', icon: 'heart', matches: exact('/crm'), comingSoon: true },
      {
        id: 'notifications',
        label: 'Bildirimler',
        href: '/crm/notifications',
        icon: 'bell',
        matches: startsWith('/crm/notifications'),
        comingSoon: true,
      },
      {
        id: 'promotions',
        label: 'Promosyonlar',
        href: '/crm/promotions',
        icon: 'gift',
        matches: startsWith('/crm/promotions'),
        comingSoon: true,
      },
      {
        id: 'coupons',
        label: 'Kuponlar',
        href: '/crm/coupons',
        icon: 'ticket',
        matches: startsWith('/crm/coupons'),
        comingSoon: true,
      },
    ],
  },
  {
    id: 'system',
    label: 'Sistem',
    access: 'system',
    items: [
      {
        id: 'localization',
        label: 'Yerelleştirme',
        href: '/system/localization',
        icon: 'globe',
        matches: startsWith('/system/localization'),
      },
      {
        id: 'regions',
        label: 'Bölgeler & Şehirler',
        href: '/system/regions',
        icon: 'map',
        matches: startsWith('/system/regions'),
      },
      {
        id: 'payment-methods',
        label: 'Ödeme Yöntemleri',
        href: '/system/payment-methods',
        icon: 'wallet',
        matches: startsWith('/system/payment-methods'),
      },
      {
        id: 'service-types',
        label: 'Servis Türleri',
        href: '/system/service-types',
        icon: 'layers',
        matches: startsWith('/system/service-types'),
      },
      {
        id: 'system-configuration',
        label: 'Sistem Yapılandırması',
        href: '/system/configuration',
        icon: 'settings',
        matches: startsWith('/system/configuration'),
      },
      {
        id: 'compliance-catalog',
        label: 'Partner Başvuru Uyumu',
        href: '/system/compliance-catalog',
        icon: 'shield',
        matches: startsWith('/system/compliance-catalog'),
      },
      {
        id: 'geo-provider',
        label: 'Adres Arama Sağlayıcısı',
        href: '/system/geo-provider',
        icon: 'map',
        matches: startsWith('/system/geo-provider'),
      },
    ],
  },
];

export const adminNavItems = adminNavSections.flatMap((s) => s.items);

export function resolveSectionLabel(
  section: AdminNavSection,
  preset: TerminologyPreset,
): string {
  return section.dynamicLabel ? section.dynamicLabel(preset) : section.label;
}

export function resolveItemLabel(
  item: AdminNavItem,
  preset: TerminologyPreset,
): string {
  return item.dynamicLabel ? item.dynamicLabel(preset) : item.label;
}

export function findNavItemByPath(pathname: string): AdminNavItem | null {
  return adminNavItems.find((item) => item.matches(pathname)) ?? null;
}

/**
 * Nav items backed by real, production API data. Everything else still
 * renders demo/mock content — these are flagged in the sidebar and carry a
 * banner so an MVP operator is never shown fabricated data as production.
 */
export const liveNavItemIds = new Set<string>([
  'tenant-list',
  'tenant-applications',
  'store-list',
  'orders',
  'compliance-catalog',
]);

export function isLiveNavItem(item: AdminNavItem): boolean {
  return liveNavItemIds.has(item.id);
}

export const adminDemoSurfacesEnabled =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_ADMIN_ENABLE_DEMO === 'true';

export const visibleAdminNavSections: AdminNavSection[] = adminDemoSurfacesEnabled
  ? adminNavSections
  : adminNavSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => isLiveNavItem(item)),
      }))
      .filter((section) => section.items.length > 0);
