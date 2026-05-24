import type { BadgeTone } from '@/components/ui/StatusBadge';
import type { IconName } from '@/lib/icons';

/** Platform bölümü için mock veri. */

export type PlatformUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  scope: string;
  status: 'active' | 'invited' | 'disabled';
  lastActive: string;
};

export type PermissionGroup = {
  id: string;
  domain: string;
  description: string;
  capabilities: { label: string; roles: string[] }[];
};

export type FeatureFlagRow = {
  id: string;
  key: string;
  description: string;
  status: 'on' | 'off' | 'rollout';
  rollout: number;
  environment: string;
  updated: string;
};

export type IntegrationRow = {
  id: string;
  name: string;
  category: string;
  status: 'connected' | 'error' | 'available';
  detail: string;
  icon: IconName;
};

export type WebhookRow = {
  id: string;
  event: string;
  endpoint: string;
  status: 'healthy' | 'failing' | 'paused';
  successRate: string;
  lastDelivery: string;
};

export type AuditLogRow = {
  id: string;
  actor: string;
  action: string;
  target: string;
  ip: string;
  time: string;
  category: 'auth' | 'finance' | 'config' | 'tenant';
};

export const platformStatusTone: Record<string, BadgeTone> = {
  active: 'success',
  connected: 'success',
  healthy: 'success',
  on: 'success',
  invited: 'accent',
  rollout: 'accent',
  available: 'neutral',
  paused: 'warning',
  off: 'neutral',
  disabled: 'neutral',
  error: 'danger',
  failing: 'danger',
};

export const platformUsers: PlatformUserRow[] = [
  { id: 'U-01', name: 'Emre Dal', email: 'emre@lieferzonen.io', role: 'Süper Yönetici', scope: 'Platform', status: 'active', lastActive: '2 dk önce' },
  { id: 'U-02', name: 'Clara Mendel', email: 'clara@lieferzonen.io', role: 'Finans Yöneticisi', scope: 'Platform', status: 'active', lastActive: '1 s önce' },
  { id: 'U-03', name: 'Devon Aric', email: 'devon@lieferzonen.io', role: 'Operasyon Yöneticisi', scope: 'Berlin bölgesi', status: 'active', lastActive: '20 dk önce' },
  { id: 'U-04', name: 'Priya Nair', email: 'priya@lieferzonen.io', role: 'Destek Temsilcisi', scope: 'Platform', status: 'active', lastActive: '5 dk önce' },
  { id: 'U-05', name: 'Marco Lentz', email: 'marco@burgerdistrict.de', role: 'Tenant Sahibi', scope: 'Burger District Group', status: 'active', lastActive: '3 s önce' },
  { id: 'U-06', name: 'Sofia Berg', email: 'sofia@nordiccoffee.de', role: 'Mağaza Müdürü', scope: 'Nordic Coffee — Centre', status: 'invited', lastActive: '—' },
  { id: 'U-07', name: 'Hans Krüger', email: 'hans@lieferzonen.io', role: 'Operasyon Yöneticisi', scope: 'Münih bölgesi', status: 'disabled', lastActive: '12 gün önce' },
];

export const permissionGroups: PermissionGroup[] = [
  {
    id: 'pg-tenants',
    domain: 'Tenantler ve Mağazalar',
    description: 'Onboarding incelemesi, aktivasyon, askıya alma ve katalog kontrolü.',
    capabilities: [
      { label: 'Tenant başvurularını onayla', roles: ['Süper Yönetici', 'Operasyon Yöneticisi'] },
      { label: 'Mağazaları askıya al / yeniden etkinleştir', roles: ['Süper Yönetici', 'Operasyon Yöneticisi'] },
      { label: 'Menü ve kampanyaları düzenle', roles: ['Süper Yönetici', 'Operasyon Yöneticisi', 'Tenant Sahibi'] },
    ],
  },
  {
    id: 'pg-finance',
    domain: 'Finans',
    description: 'Ödemeler, komisyonlar, iadeler ve finansal raporlama.',
    capabilities: [
      { label: 'Ödeme partilerini onayla', roles: ['Süper Yönetici', 'Finans Yöneticisi'] },
      { label: 'Manuel iade gerçekleştir', roles: ['Süper Yönetici', 'Finans Yöneticisi', 'Destek Temsilcisi'] },
      { label: 'Komisyon oranlarını düzenle', roles: ['Süper Yönetici', 'Finans Yöneticisi'] },
    ],
  },
  {
    id: 'pg-platform',
    domain: 'Platform',
    description: 'Kullanıcı yönetimi, özellik bayrakları, entegrasyonlar ve denetim erişimi.',
    capabilities: [
      { label: 'Kullanıcı ve rolleri yönet', roles: ['Süper Yönetici'] },
      { label: 'Özellik bayraklarını aç/kapat', roles: ['Süper Yönetici'] },
      { label: 'Denetim kayıtlarını görüntüle', roles: ['Süper Yönetici', 'Finans Yöneticisi'] },
    ],
  },
];

export const featureFlags: FeatureFlagRow[] = [
  { id: 'ff-1', key: 'express-checkout', description: 'Geri dönen müşteriler için tek dokunuşla ödeme', status: 'rollout', rollout: 25, environment: 'Production', updated: '17 May' },
  { id: 'ff-2', key: 'ai-menu-suggestions', description: 'AI destekli menü ürünü önerileri', status: 'off', rollout: 0, environment: 'Staging', updated: '12 May' },
  { id: 'ff-3', key: 'live-courier-map', description: 'Sipariş sayfasında gerçek zamanlı kurye takibi', status: 'on', rollout: 100, environment: 'Production', updated: '4 May' },
  { id: 'ff-4', key: 'dynamic-delivery-fee', description: 'Talebe dayalı teslimat ücreti hesaplama', status: 'rollout', rollout: 60, environment: 'Production', updated: '15 May' },
  { id: 'ff-5', key: 'tenant-self-payout', description: 'Tenantlerin talep üzerine ödeme başlatmasına izin ver', status: 'off', rollout: 0, environment: 'Production', updated: '28 Nis' },
];

export const integrations: IntegrationRow[] = [
  { id: 'int-1', name: 'Stripe', category: 'Ödemeler', status: 'connected', detail: 'Kart, Apple Pay, SEPA · canlı anahtarlar', icon: 'card' },
  { id: 'int-2', name: 'PayPal', category: 'Ödemeler', status: 'connected', detail: 'Hızlı ödeme etkin', icon: 'wallet' },
  { id: 'int-3', name: 'Twilio', category: 'Bildirimler', status: 'error', detail: 'SMS iletimi sorunlu — yedek aktif', icon: 'bell' },
  { id: 'int-4', name: 'SendGrid', category: 'Bildirimler', status: 'connected', detail: 'İşlemsel e-posta · %99.4 teslim', icon: 'inbox' },
  { id: 'int-5', name: 'Google Maps', category: 'Lojistik', status: 'connected', detail: 'Coğrafi kodlama ve rotalama', icon: 'map' },
  { id: 'int-6', name: 'Datadog', category: 'Gözlemlenebilirlik', status: 'connected', detail: 'APM ve log hattı', icon: 'activity' },
  { id: 'int-7', name: 'Slack', category: 'Dahili', status: 'available', detail: 'Kanallara operasyonel uyarılar', icon: 'megaphone' },
  { id: 'int-8', name: 'QuickBooks', category: 'Muhasebe', status: 'available', detail: 'Hesaplaşma ve faturaları senkronize et', icon: 'report' },
];

export const webhooks: WebhookRow[] = [
  { id: 'wh-1', event: 'order.created', endpoint: 'https://hooks.lieferzonen.io/orders', status: 'healthy', successRate: '99.8%', lastDelivery: '12 sn önce' },
  { id: 'wh-2', event: 'order.updated', endpoint: 'https://hooks.lieferzonen.io/orders', status: 'healthy', successRate: '99.6%', lastDelivery: '4 sn önce' },
  { id: 'wh-3', event: 'payout.settled', endpoint: 'https://finance.internal/webhooks', status: 'failing', successRate: '71.2%', lastDelivery: '2 dk önce' },
  { id: 'wh-4', event: 'tenant.activated', endpoint: 'https://crm.internal/sync', status: 'healthy', successRate: '100%', lastDelivery: '1 s önce' },
  { id: 'wh-5', event: 'refund.processed', endpoint: 'https://finance.internal/webhooks', status: 'paused', successRate: '—', lastDelivery: '3 g önce' },
];

export const auditLogs: AuditLogRow[] = [
  { id: 'al-1', actor: 'Clara Mendel', action: 'PB-2271 ödeme partisini onayladı', target: 'PB-2271', ip: '88.214.10.4', time: '18 May, 12:32', category: 'finance' },
  { id: 'al-2', actor: 'Emre Dal', action: 'express-checkout özellik bayrağını etkinleştirdi', target: 'express-checkout', ip: '88.214.10.1', time: '17 May, 16:08', category: 'config' },
  { id: 'al-3', actor: 'Devon Aric', action: 'STR-3340 mağazasını askıya aldı', target: 'Pasta Mancini — Altstadt', ip: '91.40.22.8', time: '17 May, 11:14', category: 'tenant' },
  { id: 'al-4', actor: 'Priya Nair', action: 'RF-5519 manuel iadesini gerçekleştirdi', target: 'LZ-92340', ip: '91.40.22.9', time: '17 May, 10:02', category: 'finance' },
  { id: 'al-5', actor: 'Sistem', action: 'Başarısız giriş denemesi engellendi', target: 'pasta-mancini-owner', ip: '203.0.113.55', time: '17 May, 03:41', category: 'auth' },
  { id: 'al-6', actor: 'Emre Dal', action: 'Komisyon oranını %12 olarak güncelledi', target: 'Burger District Group', ip: '88.214.10.1', time: '16 May, 14:50', category: 'finance' },
  { id: 'al-7', actor: 'Hans Krüger', action: 'Hesap yönetici tarafından devre dışı bırakıldı', target: 'hans@lieferzonen.io', ip: '88.214.10.1', time: '6 May, 09:30', category: 'auth' },
];
