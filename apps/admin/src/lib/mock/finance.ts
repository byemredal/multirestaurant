import type { BadgeTone } from '@/components/ui/StatusBadge';

/** Finance bölümü için mock veri. */

export type TransactionRow = {
  id: string;
  store: string;
  type: 'Sipariş ödemesi' | 'İade' | 'Ödeme' | 'Düzeltme';
  method: 'Kart' | 'PayPal' | 'Apple Pay' | 'SEPA';
  gross: string;
  fee: string;
  net: string;
  status: 'settled' | 'pending' | 'processing' | 'failed';
  date: string;
};

export type PayoutRow = {
  id: string;
  tenant: string;
  period: string;
  stores: number;
  amount: string;
  status: 'paid' | 'awaiting_approval' | 'processing' | 'on_hold';
  scheduled: string;
};

export type CommissionRow = {
  id: string;
  tenant: string;
  plan: string;
  rate: string;
  orders: number;
  commissionEarned: string;
  effective: string;
};

export type RefundRow = {
  id: string;
  order: string;
  customer: string;
  store: string;
  amount: string;
  reason: string;
  status: 'requested' | 'approved' | 'rejected' | 'auto_approved';
  date: string;
};

export const financeStatusTone: Record<string, BadgeTone> = {
  settled: 'success',
  paid: 'success',
  approved: 'success',
  auto_approved: 'success',
  pending: 'warning',
  awaiting_approval: 'warning',
  processing: 'accent',
  requested: 'accent',
  on_hold: 'warning',
  failed: 'danger',
  rejected: 'danger',
};

export const financeStatusLabel: Record<string, string> = {
  settled: 'Tamamlandı',
  paid: 'Ödendi',
  approved: 'Onaylandı',
  auto_approved: 'Otomatik onaylandı',
  pending: 'Beklemede',
  awaiting_approval: 'Onay bekliyor',
  processing: 'İşleniyor',
  requested: 'Talep edildi',
  on_hold: 'Beklemeye alındı',
  failed: 'Başarısız',
  rejected: 'Reddedildi',
};

export const financeMetrics = [
  { key: 'gmv', label: 'Bu ayki GMV', value: '€2.41M', icon: 'card' as const, tone: 'accent' as const, trend: { direction: 'up' as const, value: '11.2%' }, foot: 'geçen aya göre' },
  { key: 'commission', label: 'Komisyon geliri', value: '€312,840', icon: 'percent' as const, tone: 'success' as const, trend: { direction: 'up' as const, value: '9.4%' }, foot: 'platform kazancı' },
  { key: 'payouts', label: 'Bekleyen ödemeler', value: '€96,210', icon: 'payout' as const, tone: 'warning' as const, trend: { direction: 'flat' as const, value: '2 parti' }, foot: 'onay bekliyor' },
  { key: 'refunds', label: 'Bu ayki iadeler', value: '€18,470', icon: 'refund' as const, tone: 'danger' as const, trend: { direction: 'down' as const, value: '3.1%' }, foot: "GMV'nin %0.77'si" },
];

export const transactions: TransactionRow[] = [
  { id: 'TXN-88204', store: 'Burger District — Mitte', type: 'Sipariş ödemesi', method: 'Kart', gross: '€42.80', fee: '€1.54', net: '€41.26', status: 'settled', date: '18 May, 12:48' },
  { id: 'TXN-88203', store: 'Sushi Komachi — Schwabing', type: 'Sipariş ödemesi', method: 'Apple Pay', gross: '€68.10', fee: '€2.18', net: '€65.92', status: 'pending', date: '18 May, 12:41' },
  { id: 'TXN-88198', store: 'Curry House — Mitte', type: 'İade', method: 'Kart', gross: '-€18.50', fee: '€0.00', net: '-€18.50', status: 'settled', date: '18 May, 12:12' },
  { id: 'TXN-88190', store: 'Döner Express — HBF', type: 'Sipariş ödemesi', method: 'PayPal', gross: '€18.40', fee: '€0.71', net: '€17.69', status: 'settled', date: '18 May, 11:55' },
  { id: 'TXN-88182', store: 'Burger District Group', type: 'Ödeme', method: 'SEPA', gross: '-€12,840', fee: '€0.00', net: '-€12,840', status: 'processing', date: '18 May, 09:00' },
  { id: 'TXN-88176', store: 'Nordic Coffee Bar — Centre', type: 'Sipariş ödemesi', method: 'Kart', gross: '€9.60', fee: '€0.42', net: '€9.18', status: 'failed', date: '18 May, 09:42' },
  { id: 'TXN-88170', store: 'Curry House — West', type: 'Düzeltme', method: 'SEPA', gross: '€120.00', fee: '€0.00', net: '€120.00', status: 'settled', date: '17 May, 18:30' },
];

export const payouts: PayoutRow[] = [
  { id: 'PB-2272', tenant: 'Birden fazla tenant', period: '12 May – 18 May', stores: 184, amount: '€96,210', status: 'awaiting_approval', scheduled: '20 May' },
  { id: 'PB-2271', tenant: 'Birden fazla tenant', period: '5 May – 11 May', stores: 211, amount: '€128,400', status: 'paid', scheduled: '13 May' },
  { id: 'PB-2270', tenant: 'Döner Express Holding', period: '5 May – 11 May', stores: 21, amount: '€31,180', status: 'paid', scheduled: '13 May' },
  { id: 'PB-2269', tenant: 'Pasta Mancini', period: '5 May – 11 May', stores: 3, amount: '€2,640', status: 'on_hold', scheduled: '—' },
  { id: 'PB-2268', tenant: 'Burger District Group', period: '28 Nis – 4 May', stores: 14, amount: '€42,910', status: 'paid', scheduled: '6 May' },
  { id: 'PB-2273', tenant: 'Curry House Network', period: '12 May – 18 May', stores: 9, amount: '€14,720', status: 'processing', scheduled: '20 May' },
];

export const commissions: CommissionRow[] = [
  { id: 'CM-01', tenant: 'Burger District Group', plan: 'Scale', rate: '%12.0', orders: 8420, commissionEarned: '€41,280', effective: 'Oca 2024' },
  { id: 'CM-02', tenant: 'Döner Express Holding', plan: 'Scale', rate: '%12.0', orders: 11240, commissionEarned: '€52,640', effective: 'Kas 2023' },
  { id: 'CM-03', tenant: 'Sushi Komachi', plan: 'Growth', rate: '%15.0', orders: 3180, commissionEarned: '€18,920', effective: 'Mar 2024' },
  { id: 'CM-04', tenant: 'Curry House Network', plan: 'Growth', rate: '%15.0', orders: 4560, commissionEarned: '€22,410', effective: 'Haz 2024' },
  { id: 'CM-05', tenant: 'Nordic Coffee Bar', plan: 'Starter', rate: '%18.0', orders: 980, commissionEarned: '€3,640', effective: 'Şub 2025' },
];

export const refunds: RefundRow[] = [
  { id: 'RF-5521', order: 'LZ-92402', customer: 'Anna Klein', store: 'Curry House — Mitte', amount: '€18.50', reason: 'Eksik ürün', status: 'auto_approved', date: '18 May' },
  { id: 'RF-5522', order: 'LZ-92388', customer: 'Felix Wagner', store: 'Burger District — Kreuzberg', amount: '€51.20', reason: 'Sipariş hiç ulaşmadı', status: 'requested', date: '18 May' },
  { id: 'RF-5523', order: 'LZ-92375', customer: 'Sara Vogel', store: 'Sushi Komachi — Schwabing', amount: '€68.10', reason: 'Kalite şikayeti', status: 'requested', date: '18 May' },
  { id: 'RF-5519', order: 'LZ-92340', customer: 'Tom Becker', store: 'Döner Express — HBF', amount: '€12.40', reason: 'Geç teslimat', status: 'approved', date: '17 May' },
  { id: 'RF-5512', order: 'LZ-92299', customer: 'Lea Fischer', store: 'Curry House — West', amount: '€96.00', reason: 'Mükerrer tahsilat', status: 'rejected', date: '17 May' },
  { id: 'RF-5508', order: 'LZ-92271', customer: 'David Horn', store: 'Nordic Coffee Bar — Centre', amount: '€9.60', reason: 'Yanlış ürün', status: 'auto_approved', date: '16 May' },
];

export const revenueByMonth = [
  { label: 'Ara', value: 1820000 },
  { label: 'Oca', value: 1960000 },
  { label: 'Şub', value: 2010000 },
  { label: 'Mar', value: 2180000 },
  { label: 'Nis', value: 2170000 },
  { label: 'May', value: 2410000 },
];

export const financialReports = [
  { id: 'RP-01', name: 'Aylık hesaplaşma raporu', period: 'Nisan 2026', format: 'PDF · CSV', generated: '2 May', size: '2.4 MB' },
  { id: 'RP-02', name: 'Tenant bazında komisyon dökümü', period: 'Nisan 2026', format: 'CSV', generated: '2 May', size: '880 KB' },
  { id: 'RP-03', name: 'İade ve ters ibraz defteri', period: 'Nisan 2026', format: 'CSV', generated: '2 May', size: '1.1 MB' },
  { id: 'RP-04', name: 'KDV özeti — DE', period: '1. Çeyrek 2026', format: 'PDF', generated: '8 Nis', size: '640 KB' },
  { id: 'RP-05', name: 'Ödeme mutabakatı', period: 'Nisan 2026', format: 'CSV · XLSX', generated: '2 May', size: '1.9 MB' },
];
