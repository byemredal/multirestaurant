import type { BadgeTone } from '@/components/ui/StatusBadge';
import type { IconName } from '@/lib/icons';

/** Operations bölümü için mock veri. */

export type OrderRow = {
  id: string;
  customer: string;
  store: string;
  items: number;
  total: string;
  channel: 'Teslimat' | 'Gel-Al' | 'Masada';
  status: 'new' | 'preparing' | 'in_transit' | 'delivered' | 'cancelled';
  placed: string;
  eta: string;
};

export type CourierRow = {
  id: string;
  name: string;
  zone: string;
  status: 'available' | 'on_delivery' | 'break' | 'offline';
  activeOrders: number;
  completed: number;
  rating: number;
};

export type ServiceZoneRow = {
  id: string;
  zone: string;
  city: string;
  storesOnline: string;
  state: 'normal' | 'high_demand' | 'paused';
  avgWait: string;
  coverage: number;
};

export const opsStatusTone: Record<string, BadgeTone> = {
  new: 'accent',
  preparing: 'warning',
  in_transit: 'accent',
  delivered: 'success',
  cancelled: 'danger',
  available: 'success',
  on_delivery: 'accent',
  break: 'warning',
  offline: 'neutral',
  normal: 'success',
  high_demand: 'warning',
  paused: 'danger',
};

export const opsStatusLabel: Record<string, string> = {
  new: 'Yeni',
  preparing: 'Hazırlanıyor',
  in_transit: 'Yolda',
  delivered: 'Teslim edildi',
  cancelled: 'İptal edildi',
  available: 'Müsait',
  on_delivery: 'Teslimatta',
  break: 'Molada',
  offline: 'Çevrimdışı',
  normal: 'Normal',
  high_demand: 'Yoğun talep',
  paused: 'Duraklatıldı',
};

export const orders: OrderRow[] = [
  { id: 'LZ-92481', customer: 'Jonas Weber', store: 'Burger District — Mitte', items: 3, total: '€42.80', channel: 'Teslimat', status: 'preparing', placed: '12:48', eta: '13:22' },
  { id: 'LZ-92479', customer: 'Mira Schulz', store: 'Sushi Komachi — Schwabing', items: 5, total: '€68.10', channel: 'Teslimat', status: 'in_transit', placed: '12:41', eta: '13:15' },
  { id: 'LZ-92474', customer: 'Tom Becker', store: 'Döner Express — Hauptbahnhof', items: 2, total: '€18.40', channel: 'Gel-Al', status: 'new', placed: '12:52', eta: '13:08' },
  { id: 'LZ-92468', customer: 'Anna Klein', store: 'Curry House — Mitte', items: 4, total: '€51.20', channel: 'Teslimat', status: 'delivered', placed: '12:20', eta: '12:58' },
  { id: 'LZ-92462', customer: 'Felix Wagner', store: 'Burger District — Kreuzberg', items: 1, total: '€12.90', channel: 'Teslimat', status: 'cancelled', placed: '12:14', eta: '—' },
  { id: 'LZ-92458', customer: 'Sara Vogel', store: 'Nordic Coffee Bar — Centre', items: 2, total: '€9.60', channel: 'Gel-Al', status: 'delivered', placed: '12:05', eta: '12:19' },
  { id: 'LZ-92455', customer: 'David Horn', store: 'Curry House — West', items: 6, total: '€74.30', channel: 'Teslimat', status: 'preparing', placed: '12:55', eta: '13:34' },
  { id: 'LZ-92450', customer: 'Lea Fischer', store: 'Sushi Komachi — Schwabing', items: 3, total: '€33.70', channel: 'Masada', status: 'delivered', placed: '11:58', eta: '12:30' },
];

export const couriers: CourierRow[] = [
  { id: 'CR-201', name: 'Kemal Yıldız', zone: 'Berlin-Mitte', status: 'on_delivery', activeOrders: 2, completed: 14, rating: 4.9 },
  { id: 'CR-205', name: 'Hannah Roth', zone: 'Berlin-Kreuzberg', status: 'available', activeOrders: 0, completed: 11, rating: 4.7 },
  { id: 'CR-212', name: 'Luca Greco', zone: 'Munich-Schwabing', status: 'on_delivery', activeOrders: 1, completed: 9, rating: 4.8 },
  { id: 'CR-220', name: 'Paula Neumann', zone: 'Frankfurt-Centre', status: 'break', activeOrders: 0, completed: 16, rating: 4.6 },
  { id: 'CR-228', name: 'Onur Acar', zone: 'Stuttgart-West', status: 'available', activeOrders: 0, completed: 7, rating: 4.5 },
  { id: 'CR-233', name: 'Greta Hahn', zone: 'Bremen-Centre', status: 'offline', activeOrders: 0, completed: 12, rating: 4.9 },
];

export const serviceZones: ServiceZoneRow[] = [
  { id: 'ZN-01', zone: 'Berlin-Mitte', city: 'Berlin', storesOnline: '64 / 71', state: 'high_demand', avgWait: '38 dk', coverage: 92 },
  { id: 'ZN-02', zone: 'Berlin-Kreuzberg', city: 'Berlin', storesOnline: '48 / 52', state: 'normal', avgWait: '29 dk', coverage: 88 },
  { id: 'ZN-03', zone: 'Munich-Schwabing', city: 'Münih', storesOnline: '31 / 33', state: 'normal', avgWait: '24 dk', coverage: 95 },
  { id: 'ZN-04', zone: 'Cologne-Altstadt', city: 'Köln', storesOnline: '12 / 19', state: 'paused', avgWait: '—', coverage: 61 },
  { id: 'ZN-05', zone: 'Frankfurt-Centre', city: 'Frankfurt', storesOnline: '57 / 60', state: 'high_demand', avgWait: '41 dk', coverage: 90 },
  { id: 'ZN-06', zone: 'Stuttgart-West', city: 'Stuttgart', storesOnline: '22 / 25', state: 'normal', avgWait: '27 dk', coverage: 84 },
];

export type OpsTimelineEvent = {
  id: string;
  title: string;
  meta: string;
  icon: IconName;
  tone: 'accent' | 'success' | 'warning' | 'danger' | 'neutral';
};

export const opsTimeline: OpsTimelineEvent[] = [
  { id: 't1', title: 'Cologne-Altstadt bölgesi duraklatıldı', meta: '13:04 · Otomatik duraklatıldı — kurye kapsamı %65 altında', icon: 'truck', tone: 'danger' },
  { id: 't2', title: 'Yoğun talep dalgası — Frankfurt-Centre', meta: '12:50 · Teslimat süreleri 12 dk uzatıldı', icon: 'activity', tone: 'warning' },
  { id: 't3', title: 'Ödeme partisi PB-2271 tamamlandı', meta: '12:32 · 211 mağazada €128,400', icon: 'payout', tone: 'success' },
  { id: 't4', title: '"Sushi Komachi" mağazası yeniden açıldı', meta: '12:18 · Mağaza müdürü tarafından elle açıldı', icon: 'store', tone: 'accent' },
  { id: 't5', title: 'Bildirim ağ geçidi sorunlu', meta: '11:56 · SMS sağlayıcısı yedeğe geçti', icon: 'alert', tone: 'danger' },
  { id: 't6', title: 'Vardiya değişimi — 18 kurye çevrimiçi', meta: '11:30 · Öğle vardiyası başladı', icon: 'users', tone: 'neutral' },
  { id: 't7', title: 'Menü güncellemesi yayınlandı — Döner Express', meta: '10:45 · 6 yeni ürün eklendi', icon: 'menu', tone: 'accent' },
];
