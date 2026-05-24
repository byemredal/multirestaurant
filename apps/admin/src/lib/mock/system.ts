import type { BadgeTone } from '@/components/ui/StatusBadge';

/** System bölümü için mock veri. */

export type LocaleRow = {
  id: string;
  language: string;
  code: string;
  coverage: number;
  status: 'default' | 'published' | 'in_progress';
  strings: string;
};

export type RegionRow = {
  id: string;
  name: string;
  country: string;
  cities: number;
  stores: number;
  status: 'live' | 'pilot' | 'planned';
  launched: string;
};

export type PaymentMethodRow = {
  id: string;
  name: string;
  provider: string;
  status: 'enabled' | 'disabled';
  fee: string;
  share: string;
};

export type ServiceTypeRow = {
  id: string;
  name: string;
  description: string;
  status: 'enabled' | 'disabled';
  stores: number;
  slaTarget: string;
};

export const systemStatusTone: Record<string, BadgeTone> = {
  default: 'accent',
  published: 'success',
  live: 'success',
  enabled: 'success',
  in_progress: 'warning',
  pilot: 'warning',
  planned: 'neutral',
  disabled: 'neutral',
};

export const systemStatusLabel: Record<string, string> = {
  default: 'Varsayılan',
  published: 'Yayında',
  live: 'Canlı',
  enabled: 'Etkin',
  in_progress: 'Devam ediyor',
  pilot: 'Pilot',
  planned: 'Planlandı',
  disabled: 'Devre dışı',
};

export const locales: LocaleRow[] = [
  { id: 'lc-de', language: 'Almanca', code: 'de-DE', coverage: 100, status: 'default', strings: '3,184 / 3,184' },
  { id: 'lc-en', language: 'İngilizce', code: 'en-US', coverage: 100, status: 'published', strings: '3,184 / 3,184' },
  { id: 'lc-tr', language: 'Türkçe', code: 'tr-TR', coverage: 94, status: 'published', strings: '2,993 / 3,184' },
  { id: 'lc-fr', language: 'Fransızca', code: 'fr-FR', coverage: 61, status: 'in_progress', strings: '1,942 / 3,184' },
  { id: 'lc-it', language: 'İtalyanca', code: 'it-IT', coverage: 38, status: 'in_progress', strings: '1,210 / 3,184' },
];

export const regions: RegionRow[] = [
  { id: 'rg-1', name: 'Berlin-Brandenburg', country: 'Almanya', cities: 6, stores: 311, status: 'live', launched: 'Kas 2023' },
  { id: 'rg-2', name: 'Bavyera', country: 'Almanya', cities: 4, stores: 188, status: 'live', launched: 'Oca 2024' },
  { id: 'rg-3', name: 'Kuzey Ren-Vestfalya', country: 'Almanya', cities: 8, stores: 242, status: 'live', launched: 'Mar 2024' },
  { id: 'rg-4', name: 'Hessen', country: 'Almanya', cities: 3, stores: 96, status: 'pilot', launched: 'Nis 2026' },
  { id: 'rg-5', name: 'Viyana Metro', country: 'Avusturya', cities: 1, stores: 0, status: 'planned', launched: '3. Çeyrek 2026' },
];

export const paymentMethods: PaymentMethodRow[] = [
  { id: 'pm-1', name: 'Kredi / Banka Kartı', provider: 'Stripe', status: 'enabled', fee: '%1.4 + €0.25', share: '%58' },
  { id: 'pm-2', name: 'Apple Pay', provider: 'Stripe', status: 'enabled', fee: '%1.4 + €0.25', share: '%19' },
  { id: 'pm-3', name: 'PayPal', provider: 'PayPal', status: 'enabled', fee: '%2.5 + €0.35', share: '%14' },
  { id: 'pm-4', name: 'SEPA Otomatik Ödeme', provider: 'Stripe', status: 'enabled', fee: '%0.8', share: '%7' },
  { id: 'pm-5', name: 'Kapıda Ödeme', provider: 'Manuel', status: 'disabled', fee: '—', share: '%2' },
];

export const serviceTypes: ServiceTypeRow[] = [
  { id: 'st-1', name: 'Teslimat', description: 'Müşteri adresine kurye ile teslimat', status: 'enabled', stores: 742, slaTarget: '35 dk' },
  { id: 'st-2', name: 'Gel-Al', description: 'Müşteri siparişi mağazadan teslim alır', status: 'enabled', stores: 689, slaTarget: '15 dk' },
  { id: 'st-3', name: 'Masada', description: 'Önceden sipariş ver ve mağazada ye', status: 'enabled', stores: 214, slaTarget: '20 dk' },
  { id: 'st-4', name: 'Planlı Catering', description: 'Büyük, önceden planlanmış grup siparişleri', status: 'disabled', stores: 0, slaTarget: '—' },
];

export const systemConfig = [
  { id: 'cfg-1', group: 'Siparişler', label: 'Varsayılan sipariş kabul süresi', value: '90 saniye', editable: true },
  { id: 'cfg-2', group: 'Siparişler', label: 'Kabul edilmeyen siparişleri otomatik iptal et', value: 'Etkin', editable: true },
  { id: 'cfg-3', group: 'Teslimat', label: 'Bölgeyi açık tutmak için min. kurye kapsamı', value: '%65', editable: true },
  { id: 'cfg-4', group: 'Finans', label: 'İade otomatik onay eşiği', value: '€20.00', editable: true },
  { id: 'cfg-5', group: 'Finans', label: 'Ödeme takvimi', value: 'Haftalık · Pazartesi', editable: true },
  { id: 'cfg-6', group: 'Güvenlik', label: 'Admin oturumu zaman aşımı', value: '8 saat', editable: true },
  { id: 'cfg-7', group: 'Güvenlik', label: 'Admin hesapları için 2FA zorunlu', value: 'Etkin', editable: false },
];
