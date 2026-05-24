import type { BadgeTone } from '@/components/ui/StatusBadge';

/** Tenants bölümü için mock veri (mağazalar, performans, menüler, kampanyalar). */

export type TenantRow = {
  id: string;
  name: string;
  owner: string;
  city: string;
  stores: number;
  status: 'active' | 'onboarding' | 'suspended';
  plan: 'Starter' | 'Growth' | 'Scale';
  mrr: string;
  joined: string;
};

export type StoreRow = {
  id: string;
  name: string;
  tenant: string;
  city: string;
  cuisine: string;
  status: 'online' | 'busy' | 'offline' | 'paused';
  rating: number;
  ordersToday: number;
  prepTime: string;
};

export type StorePerformanceRow = {
  id: string;
  name: string;
  tenant: string;
  orders: number;
  revenue: string;
  acceptRate: number;
  avgPrep: string;
  cancelRate: number;
  trend: number[];
};

export type MenuRow = {
  id: string;
  store: string;
  tenant: string;
  items: number;
  categories: number;
  status: 'published' | 'review' | 'draft';
  updated: string;
  completeness: number;
};

export type CampaignRow = {
  id: string;
  name: string;
  scope: string;
  type: 'İndirim' | 'Ücretsiz teslimat' | 'Öne çıkan' | 'Paket';
  status: 'live' | 'scheduled' | 'ended' | 'paused';
  reach: string;
  redemptions: number;
  window: string;
};

export const statusTone: Record<string, BadgeTone> = {
  active: 'success',
  online: 'success',
  published: 'success',
  live: 'success',
  onboarding: 'accent',
  scheduled: 'accent',
  review: 'warning',
  busy: 'warning',
  paused: 'warning',
  draft: 'neutral',
  ended: 'neutral',
  offline: 'danger',
  suspended: 'danger',
};

export const tenants: TenantRow[] = [
  { id: 'TEN-1042', name: 'Burger District Group', owner: 'Marco Lentz', city: 'Berlin', stores: 14, status: 'active', plan: 'Scale', mrr: '€2,940', joined: 'Oca 2024' },
  { id: 'TEN-1043', name: 'Sushi Komachi', owner: 'Aiko Tanaka', city: 'Münih', stores: 6, status: 'active', plan: 'Growth', mrr: '€1,180', joined: 'Mar 2024' },
  { id: 'TEN-1051', name: 'Green Bowl Co.', owner: 'Lena Hoffmann', city: 'Hamburg', stores: 0, status: 'onboarding', plan: 'Starter', mrr: '€0', joined: 'May 2026' },
  { id: 'TEN-1067', name: 'Pasta Mancini', owner: 'Giulia Mancini', city: 'Köln', stores: 3, status: 'suspended', plan: 'Growth', mrr: '€640', joined: 'Ağu 2024' },
  { id: 'TEN-1072', name: 'Döner Express Holding', owner: 'Emre Demir', city: 'Frankfurt', stores: 21, status: 'active', plan: 'Scale', mrr: '€4,210', joined: 'Kas 2023' },
  { id: 'TEN-1088', name: 'Nordic Coffee Bar', owner: 'Sofia Berg', city: 'Bremen', stores: 4, status: 'active', plan: 'Starter', mrr: '€380', joined: 'Şub 2025' },
  { id: 'TEN-1094', name: 'Curry House Network', owner: 'Raj Patel', city: 'Stuttgart', stores: 9, status: 'active', plan: 'Growth', mrr: '€1,560', joined: 'Haz 2024' },
  { id: 'TEN-1101', name: 'Vegan Loft', owner: 'Nina Brandt', city: 'Leipzig', stores: 0, status: 'onboarding', plan: 'Starter', mrr: '€0', joined: 'May 2026' },
];

export const stores: StoreRow[] = [
  { id: 'STR-3301', name: 'Burger District — Mitte', tenant: 'Burger District Group', city: 'Berlin', cuisine: 'Burger', status: 'online', rating: 4.7, ordersToday: 184, prepTime: '14 dk' },
  { id: 'STR-3302', name: 'Burger District — Kreuzberg', tenant: 'Burger District Group', city: 'Berlin', cuisine: 'Burger', status: 'busy', rating: 4.5, ordersToday: 232, prepTime: '26 dk' },
  { id: 'STR-3318', name: 'Sushi Komachi — Schwabing', tenant: 'Sushi Komachi', city: 'Münih', cuisine: 'Japon', status: 'online', rating: 4.9, ordersToday: 97, prepTime: '18 dk' },
  { id: 'STR-3340', name: 'Pasta Mancini — Altstadt', tenant: 'Pasta Mancini', city: 'Köln', cuisine: 'İtalyan', status: 'offline', rating: 4.3, ordersToday: 0, prepTime: '—' },
  { id: 'STR-3355', name: 'Döner Express — Hauptbahnhof', tenant: 'Döner Express Holding', city: 'Frankfurt', cuisine: 'Türk', status: 'online', rating: 4.6, ordersToday: 311, prepTime: '11 dk' },
  { id: 'STR-3361', name: 'Nordic Coffee Bar — Centre', tenant: 'Nordic Coffee Bar', city: 'Bremen', cuisine: 'Kafe', status: 'paused', rating: 4.8, ordersToday: 42, prepTime: '8 dk' },
  { id: 'STR-3377', name: 'Curry House — Mitte', tenant: 'Curry House Network', city: 'Stuttgart', cuisine: 'Hint', status: 'online', rating: 4.4, ordersToday: 128, prepTime: '21 dk' },
  { id: 'STR-3390', name: 'Curry House — West', tenant: 'Curry House Network', city: 'Stuttgart', cuisine: 'Hint', status: 'busy', rating: 4.2, ordersToday: 156, prepTime: '29 dk' },
];

export const storePerformance: StorePerformanceRow[] = [
  { id: 'STR-3355', name: 'Döner Express — Hauptbahnhof', tenant: 'Döner Express Holding', orders: 311, revenue: '€6,820', acceptRate: 99, avgPrep: '11 dk', cancelRate: 1.2, trend: [40, 52, 48, 61, 70, 66, 81] },
  { id: 'STR-3302', name: 'Burger District — Kreuzberg', tenant: 'Burger District Group', orders: 232, revenue: '€5,940', acceptRate: 94, avgPrep: '26 dk', cancelRate: 4.8, trend: [30, 44, 39, 50, 47, 58, 62] },
  { id: 'STR-3301', name: 'Burger District — Mitte', tenant: 'Burger District Group', orders: 184, revenue: '€4,710', acceptRate: 98, avgPrep: '14 dk', cancelRate: 2.1, trend: [28, 35, 41, 38, 46, 44, 52] },
  { id: 'STR-3390', name: 'Curry House — West', tenant: 'Curry House Network', orders: 156, revenue: '€3,180', acceptRate: 88, avgPrep: '29 dk', cancelRate: 7.4, trend: [22, 26, 30, 24, 33, 29, 35] },
  { id: 'STR-3377', name: 'Curry House — Mitte', tenant: 'Curry House Network', orders: 128, revenue: '€2,690', acceptRate: 96, avgPrep: '21 dk', cancelRate: 3.0, trend: [18, 24, 22, 28, 31, 27, 33] },
  { id: 'STR-3318', name: 'Sushi Komachi — Schwabing', tenant: 'Sushi Komachi', orders: 97, revenue: '€3,420', acceptRate: 99, avgPrep: '18 dk', cancelRate: 0.8, trend: [16, 19, 22, 21, 25, 28, 30] },
];

export const menus: MenuRow[] = [
  { id: 'MEN-5501', store: 'Burger District — Mitte', tenant: 'Burger District Group', items: 48, categories: 7, status: 'published', updated: '2 gün önce', completeness: 100 },
  { id: 'MEN-5502', store: 'Burger District — Kreuzberg', tenant: 'Burger District Group', items: 46, categories: 7, status: 'published', updated: '5 gün önce', completeness: 96 },
  { id: 'MEN-5510', store: 'Sushi Komachi — Schwabing', tenant: 'Sushi Komachi', items: 62, categories: 9, status: 'review', updated: '4 saat önce', completeness: 88 },
  { id: 'MEN-5524', store: 'Green Bowl — Hamburg HQ', tenant: 'Green Bowl Co.', items: 18, categories: 4, status: 'draft', updated: '1 saat önce', completeness: 41 },
  { id: 'MEN-5530', store: 'Döner Express — Hauptbahnhof', tenant: 'Döner Express Holding', items: 34, categories: 5, status: 'published', updated: '1 hafta önce', completeness: 100 },
  { id: 'MEN-5541', store: 'Curry House — Mitte', tenant: 'Curry House Network', items: 53, categories: 8, status: 'review', updated: '6 saat önce', completeness: 92 },
];

export const campaigns: CampaignRow[] = [
  { id: 'CMP-7701', name: 'Hafta sonu Burgerlerde -%20', scope: 'Burger District Group', type: 'İndirim', status: 'live', reach: '38.2k', redemptions: 1840, window: '16 May – 19 May' },
  { id: 'CMP-7702', name: '€25 üzeri ücretsiz teslimat', scope: 'Platform geneli', type: 'Ücretsiz teslimat', status: 'live', reach: '210k', redemptions: 9120, window: '1 May – 31 May' },
  { id: 'CMP-7708', name: 'Öne çıkan: Sushi Komachi', scope: 'Münih bölgesi', type: 'Öne çıkan', status: 'scheduled', reach: '—', redemptions: 0, window: '20 May – 27 May' },
  { id: 'CMP-7711', name: 'Öğle menüsü paket fırsatı', scope: 'Curry House Network', type: 'Paket', status: 'paused', reach: '12.4k', redemptions: 420, window: '10 May – 24 May' },
  { id: 'CMP-7690', name: 'Bahar lansmanı -%15', scope: 'Platform geneli', type: 'İndirim', status: 'ended', reach: '184k', redemptions: 7610, window: '1 Nis – 30 Nis' },
];
