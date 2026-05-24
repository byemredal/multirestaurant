'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import TenantDashboardShell from '@/components/tenant/TenantDashboardShell';
import { useTenantAuth } from '@/lib/auth/tenant-auth-context';
import {
  getTenantOrder,
  updateTenantOrderStatus,
  type TenantOrderCustomerSummary,
  type TenantOrderDeliveryAddress,
  type TenantOrderDetail,
} from '@/lib/tenant-client';
import { useTenantOrderStream } from '@/lib/realtime/tenant-order-stream-context';
import {
  getOrderPaymentMethodLabel,
  getOrderServiceTypeLabel,
  getOrderStatusLabel,
} from '@/lib/orders/labels';

const STATUS_COLORS: Record<string, string> = {
  pending_confirmation: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  preparing: 'bg-blue-50 text-blue-700 border-blue-200',
  ready: 'bg-green-50 text-green-700 border-green-200',
  completed: 'bg-zinc-50 text-zinc-500 border-zinc-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-zinc-50 text-zinc-400 border-zinc-200',
  payment_failed: 'bg-red-50 text-red-600 border-red-200',
  pending_payment: 'bg-amber-50 text-amber-600 border-amber-200',
};

type NextAction = {
  status: string;
  label: string;
  variant: 'primary' | 'danger';
  requiresReason?: boolean;
};

const NEXT_ACTIONS: Record<string, NextAction[]> = {
  pending_confirmation: [
    { status: 'confirmed', label: 'Siparişi Onayla', variant: 'primary' },
    { status: 'rejected', label: 'Reddet', variant: 'danger', requiresReason: true },
    { status: 'cancelled', label: 'İptal Et', variant: 'danger', requiresReason: true },
  ],
  confirmed: [
    { status: 'preparing', label: 'Hazırlanıyor Olarak İşaretle', variant: 'primary' },
    { status: 'cancelled', label: 'İptal Et', variant: 'danger', requiresReason: true },
  ],
  preparing: [
    { status: 'ready', label: 'Hazır Olarak İşaretle', variant: 'primary' },
    { status: 'cancelled', label: 'İptal Et', variant: 'danger', requiresReason: true },
  ],
  ready: [
    { status: 'completed', label: 'Tamamlandı Olarak İşaretle', variant: 'primary' },
  ],
};

const ACTION_PANEL_STYLES: Record<string, string> = {
  pending_confirmation: 'border-amber-200 bg-amber-50',
  confirmed: 'border-blue-200 bg-blue-50',
  preparing: 'border-blue-200 bg-blue-50',
  ready: 'border-green-200 bg-green-50',
};

const ACTION_PANEL_TEXT: Record<string, string> = {
  pending_confirmation: 'Bu sipariş onayınızı bekliyor.',
  confirmed: 'Sipariş onaylandı. Hazırlanmaya başlayabilirsiniz.',
  preparing: 'Sipariş hazırlanıyor.',
  ready: 'Sipariş hazır. Tamamlandı olarak işaretleyebilirsiniz.',
};

const FINAL_STATE_MESSAGES: Record<string, string> = {
  completed: 'Bu sipariş başarıyla tamamlandı.',
  rejected: 'Bu sipariş reddedildi.',
  cancelled: 'Bu sipariş iptal edildi.',
  payment_failed: 'Ödeme başarısız oldu. Bu sipariş işlem dışı.',
  pending_payment: 'Müşteri henüz ödeme yapmadı.',
};

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export default function TenantOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;
  const { session, logout } = useTenantAuth();
  const { applyLocalStatusChange } = useTenantOrderStream();

  const [order, setOrder] = useState<TenantOrderDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [reasonPending, setReasonPending] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState('');

  // TenantGate guarantees an authenticated ACTIVE session here.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoadError(null);
    getTenantOrder(session, orderId)
      .then((payload) => {
        if (!cancelled) setOrder(payload.order);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Sipariş yüklenemedi.');
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, session]);

  async function handleStatusUpdate(targetStatus: string, reason?: string) {
    if (!session || !order) return;
    setActionBusy(true);
    setActionFeedback(null);
    try {
      const payload = await updateTenantOrderStatus(session, orderId, targetStatus, reason);
      setOrder(payload.order);
      // Operasyon merkezi ve sipariş listesi bayatlamasın: stream context'i de
      // bildir. Sipariş aktif statüden çıkıyorsa otomatik listeden düşer.
      applyLocalStatusChange(orderId, payload.order.status);
      setActionFeedback({
        type: 'success',
        message: `Durum güncellendi: ${getOrderStatusLabel(targetStatus)}`,
      });
      setReasonPending(null);
      setReasonText('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'İşlem başarısız oldu.';
      setActionFeedback({ type: 'error', message: msg });
    } finally {
      setActionBusy(false);
    }
  }

  async function handleSignOut() {
    await logout();
  }

  if (!session) return null;

  const statusLabel = order ? getOrderStatusLabel(order.status) : '';
  const statusColor = order
    ? (STATUS_COLORS[order.status] ?? 'bg-zinc-50 text-zinc-500 border-zinc-200')
    : '';
  const nextActions = order ? (NEXT_ACTIONS[order.status] ?? []) : [];
  const finalMessage = order ? (FINAL_STATE_MESSAGES[order.status] ?? null) : null;

  return (
    <TenantDashboardShell
      currentHref={`/orders/${orderId}`}
      title="Sipariş Detayı"
      description="Sipariş öğeleri, durum geçmişi ve aksiyon alanı."
      companyName={session.tenant.companyName}
      userName={`${session.tenant.firstName} ${session.tenant.lastName}`}
      onSignOut={handleSignOut}
    >
      <div className="mb-4">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#f97316] hover:underline"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Tüm siparişler
        </Link>
      </div>

      {loadError && (
        <div className="rounded-[14px] border border-red-200 bg-red-50 px-5 py-4 text-[14px] text-red-700">
          {loadError}
        </div>
      )}

      {order && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 rounded-[16px] border border-[#ece2d2] bg-white p-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a8a29e]">Sipariş No</p>
              <p className="mt-0.5 font-mono text-[13px] text-[#1c1917]">{order.id}</p>
              <p className="mt-2 text-[14px] font-semibold text-[#1c1917]">{order.storeName}</p>
              <p className="text-[12px] text-[#a8a29e]">{formatTime(order.createdAt)}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${statusColor}`}>
              {statusLabel}
            </span>
          </div>

          {/* Red banner — sadece rejected siparişlerde, en üstte vurucu uyarı */}
          {order.status === 'rejected' && order.rejectedReason ? (
            <RejectionBanner reason={order.rejectedReason} />
          ) : null}

          {/* Action panel */}
          {nextActions.length > 0 && (
            <div className={`rounded-[16px] border p-5 ${ACTION_PANEL_STYLES[order.status] ?? 'border-[#ece2d2] bg-white'}`}>
              <p className="mb-3 text-[13px] font-semibold text-[#1c1917]">
                {ACTION_PANEL_TEXT[order.status]}
              </p>

              {actionFeedback && (
                <div
                  className={`mb-3 rounded-[10px] border px-4 py-2.5 text-[13px] ${
                    actionFeedback.type === 'success'
                      ? 'border-green-200 bg-white text-green-700'
                      : 'border-red-200 bg-white text-red-600'
                  }`}
                >
                  {actionFeedback.message}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {nextActions.map((action) => (
                  <button
                    key={action.status}
                    disabled={actionBusy || reasonPending !== null}
                    onClick={() => {
                      if (action.requiresReason) {
                        setReasonPending(action.status);
                        setReasonText('');
                        setActionFeedback(null);
                      } else {
                        void handleStatusUpdate(action.status);
                      }
                    }}
                    className={`flex items-center gap-2 rounded-[12px] px-4 py-2.5 text-[13px] font-semibold transition disabled:opacity-50 ${
                      action.variant === 'primary'
                        ? 'bg-[#f97316] text-white hover:bg-[#ea580c]'
                        : 'border border-red-200 bg-white text-red-600 hover:bg-red-50'
                    }`}
                  >
                    {actionBusy && reasonPending === null && action.variant === 'primary' && (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    )}
                    {action.label}
                  </button>
                ))}
              </div>

              {/* Inline reason form */}
              {reasonPending && (
                <div className="mt-4 rounded-[12px] border border-[#ece2d2] bg-white p-4">
                  <p className="mb-2 text-[13px] font-semibold text-[#1c1917]">
                    {reasonPending === 'rejected' ? 'Reddetme gerekçesi' : 'İptal gerekçesi'}
                  </p>
                  <textarea
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    placeholder="Gerekçenizi yazın..."
                    rows={3}
                    className="w-full resize-none rounded-[10px] border border-[#fed7aa] bg-[#fffbf5] px-3 py-2 text-[13px] text-[#1c1917] outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]"
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      disabled={actionBusy || !reasonText.trim()}
                      onClick={() => void handleStatusUpdate(reasonPending, reasonText.trim())}
                      className="flex items-center gap-2 rounded-[10px] bg-red-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                    >
                      {actionBusy && (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      )}
                      Onayla
                    </button>
                    <button
                      disabled={actionBusy}
                      onClick={() => { setReasonPending(null); setReasonText(''); }}
                      className="rounded-[10px] border border-[#ece2d2] bg-white px-4 py-2 text-[13px] font-semibold text-[#78716c] transition hover:bg-[#fffbf5] disabled:opacity-50"
                    >
                      Vazgeç
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Final state message */}
          {finalMessage && (
            <div className="rounded-[16px] border border-[#ece2d2] bg-[#fffbf5] px-5 py-4 text-[13px] text-[#78716c]">
              {finalMessage}
            </div>
          )}

          {/* Items */}
          <div className="rounded-[16px] border border-[#ece2d2] bg-white p-5">
            <h2 className="mb-3 text-[13px] font-bold text-[#1c1917]">Ürünler</h2>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="border-b border-dashed border-[#ece2d2] pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f97316] text-[11px] font-bold text-white">
                        {item.quantity}
                      </span>
                      <div className="min-w-0">
                        <span className="text-[13px] font-medium text-[#1c1917]">
                          {item.itemNameSnapshot}
                        </span>
                        {item.selectedOptions.length > 0 ? (
                          <ul className="mt-1 space-y-0.5">
                            {item.selectedOptions.map((option) => (
                              <li
                                key={option.id}
                                className="flex flex-wrap items-baseline gap-x-1.5 text-[12px] text-[#78716c]"
                              >
                                <span className="font-semibold text-[#a8a29e]">
                                  {option.optionGroupNameSnapshot}:
                                </span>
                                <span className="text-[#44403c]">
                                  {option.optionItemNameSnapshot}
                                </span>
                                {option.optionPriceDeltaSnapshot > 0 ? (
                                  <span className="text-[#a8a29e]">
                                    +{option.optionPriceDeltaSnapshot.toFixed(2)}{' '}
                                    {item.currencySnapshot}
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold text-[#1c1917]">
                      {item.lineTotal.toFixed(2)} {item.currencySnapshot}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-[#ece2d2] pt-3 flex items-center justify-between">
              <span className="text-[14px] font-bold text-[#1c1917]">Toplam</span>
              <span className="text-[16px] font-bold text-[#f97316]">
                {order.totalAmount.toFixed(2)} {order.currency}
              </span>
            </div>
          </div>

          {/* Fulfillment snapshot kartları — null alanlar render edilmez */}
          {order.customerSummary ? <CustomerCard customer={order.customerSummary} /> : null}
          {order.deliveryAddress ||
          order.deliveryFeeAmount > 0 ||
          order.deliveryDistanceKm !== null ? (
            <DeliveryCard
              address={order.deliveryAddress}
              distanceKm={order.deliveryDistanceKm}
              feeAmount={order.deliveryFeeAmount}
              currency={order.currency}
            />
          ) : null}
          {order.paymentMethodSnapshot || order.serviceTypeSnapshot ? (
            <PaymentServiceCard
              paymentMethod={order.paymentMethodSnapshot}
              serviceType={order.serviceTypeSnapshot}
            />
          ) : null}
          {order.courierNotes ? <CourierNotesCard note={order.courierNotes} /> : null}

          {/* Timeline */}
          {order.timeline.length > 0 && (
            <div className="rounded-[16px] border border-[#ece2d2] bg-white p-5">
              <h2 className="mb-3 text-[13px] font-bold text-[#1c1917]">Durum Geçmişi</h2>
              <div className="space-y-2">
                {order.timeline.map((event) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#f97316]" />
                    <div className="min-w-0">
                      <span className="text-[12px] font-semibold text-[#1c1917]">
                        {event.fromStatus ? `${getOrderStatusLabel(event.fromStatus)} → ` : ''}
                        {getOrderStatusLabel(event.toStatus)}
                      </span>
                      {event.note && (
                        <p className="text-[11px] text-[#a8a29e]">{event.note}</p>
                      )}
                      <p className="text-[11px] text-[#a8a29e]">{formatTime(event.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </TenantDashboardShell>
  );
}

// ── Fulfillment snapshot kartları ────────────────────────────────────────

function RejectionBanner({ reason }: { reason: string }) {
  return (
    <div className="rounded-[16px] border border-red-300 bg-red-50 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
          <svg viewBox="0 0 20 20" className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M10 6v4M10 14h.01" />
            <circle cx="10" cy="10" r="8" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-red-700">
            Sipariş reddedildi
          </p>
          <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-6 text-red-800">{reason}</p>
        </div>
      </div>
    </div>
  );
}

function CustomerCard({ customer }: { customer: TenantOrderCustomerSummary }) {
  return (
    <div className="rounded-[16px] border border-[#ece2d2] bg-white p-5">
      <h2 className="mb-3 text-[13px] font-bold text-[#1c1917]">Müşteri</h2>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="Ad Soyad" value={customer.fullName || '—'} />
        <Field
          label="Telefon"
          value={customer.phone ?? 'Belirtilmedi'}
          mono={Boolean(customer.phone)}
        />
        <Field label="E-posta" value={customer.email} mono className="sm:col-span-2" />
      </div>
    </div>
  );
}

function DeliveryCard({
  address,
  distanceKm,
  feeAmount,
  currency,
}: {
  address: TenantOrderDeliveryAddress | null;
  distanceKm: number | null;
  feeAmount: number;
  currency: string;
}) {
  const lines = address
    ? [
        address.addressLine1,
        address.addressLine2,
        [address.postalCode, address.city].filter(Boolean).join(' '),
        address.country,
      ].filter((part): part is string => Boolean(part?.trim()))
    : [];

  return (
    <div className="rounded-[16px] border border-[#ece2d2] bg-white p-5">
      <h2 className="mb-3 text-[13px] font-bold text-[#1c1917]">Teslimat</h2>
      {lines.length > 0 ? (
        <address className="not-italic text-[13px] leading-6 text-[#1c1917]">
          {lines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </address>
      ) : (
        <p className="text-[12.5px] italic text-[#a8a29e]">Teslimat adresi snapshot'ı yok.</p>
      )}
      <div className="mt-3 grid gap-2.5 border-t border-[#f1e8d6] pt-3 sm:grid-cols-2">
        <Field
          label="Mesafe"
          value={distanceKm !== null ? `${distanceKm.toFixed(1)} km` : 'Belirtilmedi'}
        />
        <Field
          label="Teslimat Ücreti"
          value={feeAmount > 0 ? `${feeAmount.toFixed(2)} ${currency}` : 'Ücretsiz / yok'}
        />
      </div>
    </div>
  );
}

function PaymentServiceCard({
  paymentMethod,
  serviceType,
}: {
  paymentMethod: string | null;
  serviceType: string | null;
}) {
  return (
    <div className="rounded-[16px] border border-[#ece2d2] bg-white p-5">
      <h2 className="mb-3 text-[13px] font-bold text-[#1c1917]">Ödeme & Servis</h2>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field
          label="Ödeme Yöntemi"
          value={paymentMethod ? getOrderPaymentMethodLabel(paymentMethod) : 'Belirtilmedi'}
        />
        <Field
          label="Servis Tipi"
          value={serviceType ? getOrderServiceTypeLabel(serviceType) : 'Belirtilmedi'}
        />
      </div>
    </div>
  );
}

function CourierNotesCard({ note }: { note: string }) {
  return (
    <div className="rounded-[16px] border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 5h12M4 10h12M4 15h7" />
          </svg>
        </span>
        <div className="min-w-0">
          <h2 className="text-[13px] font-bold text-amber-900">Kurye Notu</h2>
          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-6 text-amber-900/90">{note}</p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#a8a29e]">
        {label}
      </div>
      <div className={`mt-0.5 text-[13px] text-[#1c1917] ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

