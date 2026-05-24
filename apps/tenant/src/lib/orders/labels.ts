/**
 * Sipariş alanlarının kullanıcıya gösterilen Türkçe karşılıkları.
 * Backend snake_case enum kodlarını döndürür; UI bu sözlükten çevirir.
 * Bilinmeyen bir kod gelirse humanize fallback devreye girer ("foo_bar" → "Foo Bar").
 */

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Ödeme Bekleniyor',
  payment_processing: 'Ödeme İşleniyor',
  payment_failed: 'Ödeme Başarısız',
  pending_confirmation: 'Onay Bekliyor',
  confirmed: 'Onaylandı',
  preparing: 'Hazırlanıyor',
  ready: 'Hazır',
  completed: 'Tamamlandı',
  rejected: 'Reddedildi',
  cancelled: 'İptal Edildi',
};

export const ORDER_PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Nakit',
  credit_card: 'Kredi Kartı (Kapıda)',
  online_payment: 'Online Ödeme',
  sodexo: 'Sodexo',
  meal_voucher: 'Yemek Çeki',
  bank_transfer: 'Havale / EFT',
};

export const ORDER_SERVICE_TYPE_LABELS: Record<string, string> = {
  delivery: 'Adrese Teslimat',
  pickup: 'Gel-Al',
  dine_in: 'Restoranda Yemek',
  reservation: 'Rezervasyon',
};

function humanizeFallback(token: string): string {
  return token
    .split(/[_\s-]+/)
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
    .filter(Boolean)
    .join(' ');
}

export function getOrderStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return ORDER_STATUS_LABELS[status] ?? humanizeFallback(status);
}

export function getOrderPaymentMethodLabel(method: string | null | undefined): string {
  if (!method) return '—';
  return ORDER_PAYMENT_METHOD_LABELS[method] ?? humanizeFallback(method);
}

export function getOrderServiceTypeLabel(serviceType: string | null | undefined): string {
  if (!serviceType) return '—';
  return ORDER_SERVICE_TYPE_LABELS[serviceType] ?? humanizeFallback(serviceType);
}
