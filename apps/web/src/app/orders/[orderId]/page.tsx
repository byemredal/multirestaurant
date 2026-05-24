'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { readAuthSession } from '@/lib/storage/auth-session';
import { apiClient } from '@/lib/api/api-client';
import { apiBaseUrl } from '@/lib/config';
import { createStripeCheckoutSession } from '@/lib/payments/payment-client';

const BASE_URL = apiBaseUrl;

// How long to keep polling for the payment webhook to land (3s × 20 = ~60s).
const MAX_PAYMENT_POLLS = 20;
const PAYMENT_POLL_INTERVAL_MS = 3000;

type OrderItem = {
  id: string;
  itemNameSnapshot: string;
  unitBasePriceSnapshot: number;
  currencySnapshot: string;
  quantity: number;
  lineTotal: number;
};

type Order = {
  id: string;
  storeName: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  items: OrderItem[];
  canCustomerCancel: boolean;
  cancellationReason?: string;
  rejectionReason?: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Ödeme Bekleniyor',
  payment_processing: 'Ödeme İşleniyor',
  payment_failed: 'Ödeme Başarısız',
  pending_confirmation: 'Onay Bekleniyor',
  confirmed: 'Onaylandı',
  preparing: 'Hazırlanıyor',
  ready: 'Hazır',
  completed: 'Tamamlandı',
  rejected: 'Reddedildi',
  cancelled: 'İptal Edildi',
};

const STATUS_COLORS: Record<string, string> = {
  pending_payment: 'bg-amber-50 text-amber-700 border-amber-200',
  payment_processing: 'bg-blue-50 text-blue-700 border-blue-200',
  payment_failed: 'bg-red-50 text-red-700 border-red-200',
  pending_confirmation: 'bg-blue-50 text-blue-700 border-blue-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  preparing: 'bg-blue-50 text-blue-700 border-blue-200',
  ready: 'bg-green-50 text-green-700 border-green-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-zinc-50 text-zinc-500 border-zinc-200',
};

const STATUS_MESSAGES: Record<string, string> = {
  pending_payment: 'Siparişiniz oluşturuldu. Ödemenizin tamamlanması bekleniyor.',
  payment_processing:
    'Ödemeniz doğrulanıyor. Bu işlem birkaç saniye sürebilir; sayfa otomatik güncellenir.',
  payment_failed:
    'Ödeme başarısız oldu veya süresi doldu. Tekrar deneyebilir ya da yeni bir sipariş oluşturabilirsiniz.',
  pending_confirmation: 'Ödemeniz alındı. Restoran onayı bekleniyor.',
  confirmed: 'Siparişiniz onaylandı. Hazırlanmaya başlanıyor.',
  preparing: 'Siparişiniz hazırlanıyor.',
  ready: 'Siparişiniz hazır!',
  completed: 'Siparişiniz tamamlandı. Afiyet olsun!',
  rejected: 'Maalesef siparişiniz reddedildi.',
  cancelled: 'Bu sipariş iptal edildi.',
};

const STATUS_BANNER_COLORS: Record<string, string> = {
  pending_payment: 'border-amber-200 bg-amber-50 text-amber-700',
  payment_processing: 'border-blue-200 bg-blue-50 text-blue-700',
  payment_failed: 'border-red-200 bg-red-50 text-red-700',
  pending_confirmation: 'border-blue-200 bg-blue-50 text-blue-700',
  confirmed: 'border-green-200 bg-green-50 text-green-700',
  preparing: 'border-blue-200 bg-blue-50 text-blue-700',
  ready: 'border-green-200 bg-green-50 text-green-700',
  completed: 'border-green-200 bg-green-50 text-green-700',
  rejected: 'border-red-200 bg-red-50 text-red-700',
  cancelled: 'border-zinc-200 bg-zinc-50 text-zinc-500',
};

// Operational steps shown in the timeline
const TIMELINE_STEPS = ['Ödeme', 'Onay', 'Hazırlık', 'Hazır', 'Tamamlandı'];

function getProgress(status: string): {
  completedUpTo: number;
  activeStep: number;
  isFailed: boolean;
} {
  switch (status) {
    case 'pending_payment':
    case 'payment_processing':
      return { completedUpTo: 0, activeStep: 0, isFailed: false };
    case 'payment_failed':
      return { completedUpTo: 0, activeStep: 0, isFailed: true };
    case 'pending_confirmation':
      return { completedUpTo: 1, activeStep: 1, isFailed: false };
    case 'confirmed':
    case 'preparing':
      return { completedUpTo: 2, activeStep: 2, isFailed: false };
    case 'ready':
      return { completedUpTo: 3, activeStep: 3, isFailed: false };
    case 'completed':
      return { completedUpTo: 5, activeStep: 4, isFailed: false };
    case 'rejected':
    case 'cancelled':
      return { completedUpTo: 1, activeStep: 1, isFailed: true };
    default:
      return { completedUpTo: 0, activeStep: 0, isFailed: false };
  }
}

function StatusTimeline({ status }: { status: string }) {
  const { completedUpTo, activeStep, isFailed } = getProgress(status);

  return (
    <div className="mt-5 border-t border-[#f4f4f5] pt-5">
      <div className="flex items-start">
        {TIMELINE_STEPS.map((label, i) => {
          const isPast = completedUpTo > i;
          const isActive = !isPast && activeStep === i;
          const isFail = isActive && isFailed;

          return (
            <div key={label} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {/* Left connector */}
                <div
                  className={`h-[2px] flex-1 ${
                    i === 0
                      ? 'invisible'
                      : completedUpTo >= i
                        ? 'bg-[#084799]'
                        : 'bg-[#e4e4e7]'
                  }`}
                />
                {/* Step circle */}
                <div
                  className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                    isPast
                      ? 'border-[#084799] bg-[#084799]'
                      : isFail
                        ? 'border-red-500 bg-red-500'
                        : isActive
                          ? 'border-[#084799] bg-white'
                          : 'border-[#e4e4e7] bg-white'
                  }`}
                >
                  {isPast && (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3 w-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {isActive && !isFail && (
                    <span className="h-2 w-2 rounded-full bg-[#084799]" />
                  )}
                  {isFail && (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3 w-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                    >
                      <path d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                {/* Right connector */}
                <div
                  className={`h-[2px] flex-1 ${
                    i === TIMELINE_STEPS.length - 1
                      ? 'invisible'
                      : completedUpTo > i
                        ? 'bg-[#084799]'
                        : 'bg-[#e4e4e7]'
                  }`}
                />
              </div>
              <p
                className={`mt-1.5 text-center text-[10px] font-medium leading-tight ${
                  isPast
                    ? 'text-[#084799]'
                    : isFail
                      ? 'font-bold text-red-500'
                      : isActive
                        ? 'font-bold text-[#084799]'
                        : 'text-[#a1a1aa]'
                }`}
              >
                {label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;

  // Read the ?payment= return marker on the client only — avoids needing a
  // Suspense boundary around useSearchParams during the build.
  const [paymentReturn, setPaymentReturn] = useState<string | null>(null);
  useEffect(() => {
    setPaymentReturn(new URLSearchParams(window.location.search).get('payment'));
  }, []);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [payInFlight, setPayInFlight] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const pollCountRef = useRef(0);

  const fetchOrder = useCallback(
    (token: string) =>
      apiClient({
        method: 'GET',
        url: `${BASE_URL}/orders/${orderId}`,
        token,
      }),
    [orderId],
  );

  useEffect(() => {
    const session = readAuthSession();
    if (!session) {
      setError('Bu sayfayı görüntülemek için giriş yapmalısınız.');
      setLoading(false);
      return;
    }

    fetchOrder(session.accessToken)
      .then((res) => {
        if (res.ok) {
          const data = res.data as { order: Order };
          setOrder(data.order);
        } else if (res.status === 404) {
          setError('Sipariş bulunamadı.');
        } else {
          setError('Sipariş yüklenemedi. Lütfen tekrar deneyin.');
        }
      })
      .catch(() => setError('Bağlantı hatası.'))
      .finally(() => setLoading(false));
  }, [orderId, fetchOrder]);

  const refreshOrder = useCallback(async () => {
    const session = readAuthSession();
    if (!session) return;
    setRefreshing(true);
    try {
      const res = await fetchOrder(session.accessToken);
      if (res.ok) setOrder((res.data as { order: Order }).order);
    } finally {
      setRefreshing(false);
    }
  }, [fetchOrder]);

  // While payment is settling, the confirming webhook may land a moment after
  // the redirect back. Poll for the order to leave the payment stage. Capped
  // so the page never polls forever.
  useEffect(() => {
    if (!order) return;
    const status = order.status;
    if (status !== 'pending_payment' && status !== 'payment_processing') {
      pollCountRef.current = 0;
      return;
    }
    if (pollCountRef.current >= MAX_PAYMENT_POLLS) return;

    const timer = setTimeout(() => {
      pollCountRef.current += 1;
      void refreshOrder();
    }, PAYMENT_POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [order, refreshOrder]);

  async function handlePay() {
    const session = readAuthSession();
    if (!session || !order) return;

    setPayInFlight(true);
    setPayError(null);

    const result = await createStripeCheckoutSession(session.accessToken, order.id);
    if (result.ok) {
      window.location.href = result.url;
      return;
    }

    // setPayError(result.message);
    setPayError('Ödeme sayfasına yönlendirilirken bir hata oluştu. Lütfen tekrar deneyin.');
    setPayInFlight(false);
    // The order may have moved on (e.g. already paid in another tab).
    void refreshOrder();
  }

  const statusLabel = order ? (STATUS_LABELS[order.status] ?? order.status) : '';
  const statusColor = order
    ? (STATUS_COLORS[order.status] ?? 'bg-zinc-50 text-zinc-500 border-zinc-200')
    : '';
  const statusMessage = order ? STATUS_MESSAGES[order.status] : null;
  const bannerColor = order
    ? (STATUS_BANNER_COLORS[order.status] ??
      'border-zinc-200 bg-zinc-50 text-zinc-500')
    : '';
  const shortId = order ? `#${order.id.slice(0, 8).toUpperCase()}` : '';

  const isAwaitingPayment = order?.status === 'pending_payment';
  const isPaymentProcessing = order?.status === 'payment_processing';
  const isPaymentFailed = order?.status === 'payment_failed';
  const canStartPayment = isAwaitingPayment || isPaymentFailed;

  // Contextual banner for the redirect back from Stripe.
  let paymentReturnBanner: { tone: string; text: string } | null = null;
  if (order) {
    if (paymentReturn === 'success' && (isAwaitingPayment || isPaymentProcessing)) {
      paymentReturnBanner = {
        tone: 'border-blue-200 bg-blue-50 text-blue-700',
        text: 'Ödemeniz alındı, doğrulanıyor. Sayfa otomatik güncellenir…',
      };
    } else if (paymentReturn === 'cancelled' && isAwaitingPayment) {
      paymentReturnBanner = {
        tone: 'border-amber-200 bg-amber-50 text-amber-700',
        text: 'Ödeme tamamlanmadı. Hazır olduğunuzda ödemeyi tekrar başlatabilirsiniz.',
      };
    } else if (paymentReturn === 'error' && canStartPayment) {
      paymentReturnBanner = {
        tone: 'border-red-200 bg-red-50 text-red-700',
        text: 'Ödeme başlatılamadı. Lütfen aşağıdan tekrar deneyin.',
      };
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <header className="border-b border-[#e4e4e7] bg-white">
        <div className="mx-auto flex max-w-[720px] items-center gap-4 px-5 py-4">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f4f5] text-[#71717a] transition hover:bg-[#e4e4e7]"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </Link>
          <h1 className="text-[18px] font-bold text-[#18181b]">Siparişim</h1>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-5 py-8">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#084799] border-t-transparent" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-[20px] bg-white p-10 text-center shadow-sm">
            <p className="text-[16px] font-semibold text-[#18181b]">{error}</p>
            <Link
              href="/"
              className="mt-6 inline-flex rounded-[12px] bg-[#084799] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#063d85]"
            >
              Ana Sayfaya Dön
            </Link>
          </div>
        )}

        {!loading && order && (
          <div className="space-y-4">
            {/* Status card */}
            <div className="rounded-[20px] bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[12px] text-[#71717a]">Sipariş No</p>
                  <p className="mt-0.5 font-mono text-[14px] font-semibold text-[#18181b]">
                    {shortId}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-3 py-1 text-[12px] font-semibold ${statusColor}`}
                >
                  {statusLabel}
                </span>
              </div>

              {/* Redirect-back banner from Stripe */}
              {paymentReturnBanner && (
                <div
                  className={`mt-4 flex items-center gap-2 rounded-[12px] border p-3 ${paymentReturnBanner.tone}`}
                >
                  {paymentReturn === 'success' && (
                    <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  )}
                  <p className="text-[13px]">{paymentReturnBanner.text}</p>
                </div>
              )}

              {/* Status message banner */}
              {statusMessage && (
                <div
                  className={`mt-4 rounded-[12px] border p-3 ${bannerColor}`}
                >
                  <p className="text-[13px]">{statusMessage}</p>
                  {order.status === 'rejected' && order.rejectionReason && (
                    <p className="mt-1 text-[12px] opacity-75">
                      Sebep: {order.rejectionReason}
                    </p>
                  )}
                  {order.status === 'cancelled' && order.cancellationReason && (
                    <p className="mt-1 text-[12px] opacity-75">
                      Sebep: {order.cancellationReason}
                    </p>
                  )}
                </div>
              )}

              {/* Status timeline */}
              <StatusTimeline status={order.status} />

              <div className="mt-4 flex items-center justify-between border-t border-[#f4f4f5] pt-4">
                <p className="text-[14px] font-semibold text-[#18181b]">
                  {order.storeName}
                </p>
                <button
                  onClick={() => void refreshOrder()}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 rounded-[10px] bg-[#f4f4f5] px-3 py-1.5 text-[12px] font-semibold text-[#71717a] transition hover:bg-[#e4e4e7] disabled:opacity-50"
                >
                  {refreshing && (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#71717a] border-t-transparent" />
                  )}
                  Durumu Yenile
                </button>
              </div>
            </div>

            {/* Payment action — start or retry the Stripe checkout */}
            {canStartPayment && (
              <div className="rounded-[20px] bg-white p-6 shadow-sm">
                <h2 className="text-[15px] font-bold text-[#18181b]">
                  {isAwaitingPayment ? 'Ödemeyi Tamamla' : 'Ödemeyi Yeniden Dene'}
                </h2>
                <p className="mt-1 text-[13px] text-[#71717a]">
                  {isAwaitingPayment
                    ? 'Siparişinizi kesinleştirmek için güvenli ödeme adımını tamamlayın.'
                    : 'Ödeme tamamlanamadı. Stripe güvenli ödeme sayfasında tekrar deneyebilirsiniz.'}
                </p>

                {payError && (
                  <div className="mt-3 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-[13px] text-red-600">{payError}</p>
                  </div>
                )}

                <button
                  onClick={() => void handlePay()}
                  disabled={payInFlight}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-[12px] bg-[#084799] px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-[#063d85] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {payInFlight && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  {payInFlight
                    ? 'Ödeme sayfasına yönlendiriliyor…'
                    : isAwaitingPayment
                      ? 'Güvenli Ödemeye Geç'
                      : 'Yeniden Öde'}
                </button>
              </div>
            )}

            {/* Items */}
            <div className="rounded-[20px] bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-[15px] font-bold text-[#18181b]">
                Ürünler
              </h2>
              <div className="space-y-3">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#084799] text-[12px] font-bold text-white">
                        {item.quantity}
                      </span>
                      <span className="text-[14px] text-[#18181b]">
                        {item.itemNameSnapshot}
                      </span>
                    </div>
                    <span className="text-[14px] font-semibold text-[#18181b]">
                      {item.lineTotal.toFixed(2)} {item.currencySnapshot}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-[#f4f4f5] pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-bold text-[#18181b]">
                    Toplam
                  </span>
                  <span className="text-[18px] font-bold text-[#084799]">
                    {order.totalAmount.toFixed(2)} {order.currency}
                  </span>
                </div>
              </div>
            </div>

            <Link
              href="/"
              className="flex w-full items-center justify-center rounded-[14px] bg-[#f4f4f5] py-3.5 text-[14px] font-semibold text-[#18181b] transition hover:bg-[#e4e4e7]"
            >
              Ana Sayfaya Dön
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
