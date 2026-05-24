import type { IconName } from '@/lib/icons';
import type { BadgeTone } from '@/components/ui/StatusBadge';

/** Genel bakış / Dashboard sayfaları için mock operasyon verisi. */

export type HealthState = 'ok' | 'warn' | 'down';

export type ServiceHealth = {
  id: string;
  name: string;
  detail: string;
  state: HealthState;
  metric: string;
};

export type FeedEvent = {
  id: string;
  title: string;
  meta: string;
  time: string;
  icon: IconName;
};

export type PendingAction = {
  id: string;
  title: string;
  meta: string;
  icon: IconName;
  href: string;
  tone: BadgeTone;
  tag: string;
};

export type DashboardAlert = {
  id: string;
  title: string;
  meta: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  time: string;
};

export const dashboardMetrics = [
  { key: 'active-orders', label: 'Aktif siparişler', value: '1,284', icon: 'bag' as IconName, tone: 'accent' as const, trend: { direction: 'up' as const, value: '8.4%' }, foot: 'son saate göre' },
  { key: 'online-stores', label: 'Çevrimiçi mağazalar', value: '742 / 911', icon: 'store' as IconName, tone: 'success' as const, trend: { direction: 'up' as const, value: '12' }, foot: 'şu an sipariş alıyor' },
  { key: 'revenue-today', label: 'Bugünkü ciro', value: '€86,420', icon: 'card' as IconName, tone: 'accent' as const, trend: { direction: 'up' as const, value: '5.1%' }, foot: 'düne göre' },
  { key: 'failed-payments', label: 'Başarısız ödemeler', value: '37', icon: 'refund' as IconName, tone: 'danger' as const, trend: { direction: 'down' as const, value: '2.3%' }, foot: 'son 24 saat' },
  { key: 'incidents', label: 'Açık olaylar', value: '4', icon: 'alert' as IconName, tone: 'warning' as const, trend: { direction: 'flat' as const, value: 'sabit' }, foot: '1 kritik' },
];

export const operationalHealth: ServiceHealth[] = [
  { id: 'api', name: 'Çekirdek API', detail: 'p95 yanıt süresi', state: 'ok', metric: '186 ms' },
  { id: 'orders-queue', name: 'Sipariş işleme kuyruğu', detail: 'Bekleyen iş derinliği', state: 'warn', metric: '1,940 iş' },
  { id: 'payments', name: 'Ödeme sağlayıcısı — Stripe', detail: 'Yetkilendirme başarısı', state: 'warn', metric: '97.1%' },
  { id: 'webhooks', name: 'Webhook iletimi', detail: 'Başarı oranı · 1s', state: 'ok', metric: '99.6%' },
  { id: 'search', name: 'Arama ve keşif', detail: 'İndeks tazeliği', state: 'ok', metric: '< 30 sn' },
  { id: 'notifications', name: 'Bildirim ağ geçidi', detail: 'SMS sağlayıcısı', state: 'down', metric: 'Sorunlu' },
];

export const liveFeed: FeedEvent[] = [
  { id: 'f1', title: '#LZ-92481 siparişi verildi · Burger District', meta: '€42.80 · Teslimat', time: 'şimdi', icon: 'bag' },
  { id: 'f2', title: '"Sushi Komachi" mağazası servisi yeniden açtı', meta: 'Operasyon · Münih', time: '1 dk önce', icon: 'store' },
  { id: 'f3', title: 'Ödeme partisi PB-2271 onaylandı', meta: 'Finans · €128,400', time: '3 dk önce', icon: 'payout' },
  { id: 'f4', title: 'Tenant başvurusu gönderildi · Green Bowl Co.', meta: 'Onboarding kuyruğu', time: '6 dk önce', icon: 'inbox' },
  { id: 'f5', title: '#LZ-92402 siparişi için iade yapıldı', meta: 'Destek · €18.50', time: '8 dk önce', icon: 'refund' },
  { id: 'f6', title: 'Kurye vardiyası başladı · Zone Berlin-Mitte', meta: 'Teslimat operasyonu', time: '11 dk önce', icon: 'truck' },
  { id: 'f7', title: '"express-checkout" özellik bayrağı etkinleştirildi', meta: 'Platform · %25 dağıtım', time: '14 dk önce', icon: 'flag' },
  { id: 'f8', title: '#LZ-92455 siparişi teslim edildi', meta: '32 dk teslimat süresi', time: '17 dk önce', icon: 'check' },
];

export const pendingActions: PendingAction[] = [
  { id: 'p1', title: 'İnceleme bekleyen 3 tenant başvurusu', meta: 'En eskisi 2 gündür bekliyor', icon: 'inbox', href: '/tenant-applications', tone: 'warning', tag: 'Onboarding' },
  { id: 'p2', title: 'Ödeme partisi PB-2272 onay bekliyor', meta: '184 mağazada €96,210', icon: 'payout', href: '/finance/payouts', tone: 'accent', tag: 'Finans' },
  { id: 'p3', title: 'Otomatik onay limitinin üstünde 7 iade talebi', meta: 'Manuel inceleme gerekli', icon: 'refund', href: '/finance/refunds', tone: 'danger', tag: 'Finans' },
  { id: 'p4', title: 'İçerik onayı bekleyen 2 mağaza menüsü', meta: 'Bugün gönderildi', icon: 'menu', href: '/menus', tone: 'neutral', tag: 'Katalog' },
];

export const dashboardAlerts: DashboardAlert[] = [
  { id: 'a1', title: 'SMS bildirim sağlayıcısı sorunlu', meta: 'Müşteriler sipariş güncellemelerini almayabilir', severity: 'critical', time: '12 dk' },
  { id: 'a2', title: 'Artan ödeme hataları — Stripe 3DS', meta: 'Son bir saatte 37 başarısız yetkilendirme', severity: 'high', time: '24 dk' },
  { id: 'a3', title: 'Sipariş kuyruğu birikimi artıyor', meta: 'İşleme gecikmesi taban değerin ~90 sn üstünde', severity: 'medium', time: '40 dk' },
  { id: 'a4', title: 'Olağandışı giriş deseni işaretlendi', meta: 'Tenant hesabı "Pasta Mancini"', severity: 'low', time: '1 s' },
];

export const orderVolumeByHour = [
  { label: '08', value: 210 },
  { label: '10', value: 480 },
  { label: '12', value: 940 },
  { label: '14', value: 760 },
  { label: '16', value: 520 },
  { label: '18', value: 880 },
  { label: '20', value: 1180 },
  { label: '22', value: 690 },
];
