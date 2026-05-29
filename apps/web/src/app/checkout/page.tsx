'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import HomeHeader from '@/components/shell/HomeHeader';
import { useCart, type CartServiceType } from '@/lib/cart/cart-context';
import { readAuthSession } from '@/lib/storage/auth-session';
import { apiClient } from '@/lib/api/api-client';
import { apiBaseUrl } from '@/lib/config';
import { createStripeCheckoutSession } from '@/lib/payments/payment-client';
import {
  createOrderLegalAcceptance,
  fetchActiveLegalDocuments,
  pickOrderAcceptanceVersionIds,
  type LegalDocumentBundle,
} from '@/lib/legal/legal-consent-client';

const BASE_URL = apiBaseUrl;

type BlockingIssue = {
  code: string;
  message: string;
  canRetry: boolean;
};

type ReadinessCommerce = {
  orderingPolicy: {
    minOrderAmount: number;
    acceptsDelivery: boolean;
    acceptsPickup: boolean;
    currencyCode: string;
  };
  deliveryFeeTiers: Array<{
    minDistanceKm: number;
    maxDistanceKm: number;
    feeAmount: number;
    isActive: boolean;
  }>;
  serviceType: CartServiceType;
  deliveryDistanceKm: number | null;
  deliveryFeeAmount: number;
};

type ReadinessResult = {
  isReady: boolean;
  canCheckout: boolean;
  reasons: string[];
  blockingIssues: BlockingIssue[];
  subtotalAmount: number | null;
  totalAmount: number | null;
  currency: string | null;
  existingPendingPaymentOrderId: string | null;
  commerce?: ReadinessCommerce | null;
};

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function PageHeader() {
  return (
    <>
      {/* Global web header — brand/cart/auth stay consistent on checkout. */}
      <HomeHeader />
      {/* Secondary bar: the checkout title + back link live below the brand. */}
      <div className="border-b border-[#e4e4e7] bg-white">
        <div className="mx-auto flex max-w-[860px] items-center gap-4 px-5 py-4">
          <Link
            href="/"
            aria-label="Ana sayfaya dön"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f4f5] text-[#71717a] transition hover:bg-[#e4e4e7]"
          >
            <BackIcon />
          </Link>
          <h1 className="text-[18px] font-bold text-[#18181b]">Ödeme</h1>
        </div>
      </div>
    </>
  );
}

export default function CheckoutPage() {
  const {
    cart,
    subtotal,
    clearCart,
    isAuthenticated,
    authStatus,
    hydrated,
    setServiceType,
    setDeliveryDistance,
  } = useCart();
  const router = useRouter();
  const currency = cart.currency || 'CHF';

  // Dev guard: surfaces a header(authenticated)/checkout(anonymous) divergence.
  if (
    process.env.NODE_ENV !== 'production' &&
    typeof window !== 'undefined' &&
    authStatus === 'anonymous' &&
    readAuthSession()
  ) {
    // eslint-disable-next-line no-console
    console.warn('[auth mismatch] Stored session exists but checkout is anonymous');
  }

  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [distanceInput, setDistanceInput] = useState<string>('');
  const [legalDocuments, setLegalDocuments] = useState<LegalDocumentBundle[]>([]);
  const [legalLoading, setLegalLoading] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);

  // Fetch active legal documents once on mount. These are platform-level and
  // do not change with cart preferences. UI shows acceptance checkbox only
  // when both required documents (distance-sales contract + pre-information
  // form) have a current version.
  useEffect(() => {
    let cancelled = false;
    setLegalLoading(true);
    fetchActiveLegalDocuments('customer', 'tr')
      .then((docs) => {
        if (!cancelled) setLegalDocuments(docs);
      })
      .catch(() => {
        if (!cancelled) setLegalDocuments([]);
      })
      .finally(() => {
        if (!cancelled) setLegalLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Refetch readiness whenever the cart preferences change.
  useEffect(() => {
    if (!isAuthenticated || cart.items.length === 0) return;

    const session = readAuthSession();
    if (!session) return;

    setReadinessLoading(true);
    setReadinessError(null);

    apiClient({
      method: 'POST',
      url: `${BASE_URL}/orders/checkout-readiness`,
      token: session.accessToken,
    })
      .then((res) => {
        if (res.ok) {
          const result = res.data as ReadinessResult;
          setReadiness(result);
          if (result.commerce?.deliveryDistanceKm != null) {
            setDistanceInput(String(result.commerce.deliveryDistanceKm));
          }
        } else {
          setReadinessError('Sepet durumu kontrol edilemedi.');
        }
      })
      .catch(() => setReadinessError('Bağlantı hatası. Lütfen tekrar deneyin.'))
      .finally(() => setReadinessLoading(false));
  }, [
    isAuthenticated,
    cart.items.length,
    cart.serviceType,
    cart.deliveryDistanceKm,
  ]);

  const handlePlaceOrder = async () => {
    const session = readAuthSession();
    if (!session) return;

    const acceptanceVersionIds = pickOrderAcceptanceVersionIds(legalDocuments);
    if (!acceptanceVersionIds) {
      setSubmitError(
        'Yasal belgeler henüz yapılandırılmamış. Lütfen yöneticiyle iletişime geçin.',
      );
      return;
    }
    if (!legalAccepted) {
      setSubmitError('Sipariş vermek için yasal belgeleri kabul etmelisiniz.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    // 1. Create the order — snapshotted from the active cart. Service type,
    //    delivery distance and payment method are resolved server-side from
    //    the synced cart, so no order body is needed here.
    const res = await apiClient({
      method: 'POST',
      url: `${BASE_URL}/orders`,
      token: session.accessToken,
      body: {},
    });

    if (!res.ok) {
      const raw = res.data as { error?: { message?: string }; message?: string } | null;
      const msg =
        (typeof raw?.error?.message === 'string' && raw.error.message) ||
        (typeof raw?.message === 'string' && raw.message) ||
        'Sipariş oluşturulamadı. Lütfen tekrar deneyin.';
      setSubmitError(msg);
      setSubmitting(false);
      return;
    }

    const data = res.data as { order: { id: string } };
    const orderId = data.order.id;

    // 2. Record OrderLegalAcceptance. Required before the order can move past
    //    payment into PENDING_CONFIRMATION (J-Law 12).
    try {
      await createOrderLegalAcceptance({
        token: session.accessToken,
        orderId,
        distanceSalesContractVersionId:
          acceptanceVersionIds.distanceSalesContractVersionId,
        preInformationFormVersionId:
          acceptanceVersionIds.preInformationFormVersionId,
      });
    } catch {
      setSubmitError(
        'Sipariş oluşturuldu ancak yasal onay kaydedilemedi. Lütfen sipariş sayfasından tekrar deneyin.',
      );
      setSubmitting(false);
      router.push(`/orders/${orderId}`);
      return;
    }

    // 3. The cart is now snapshotted into the order — clear it.
    clearCart();

    // 4. Open a Stripe Checkout session and redirect to the hosted page.
    const payment = await createStripeCheckoutSession(session.accessToken, orderId);
    if (payment.ok) {
      window.location.href = payment.url;
      return;
    }

    // Payment could not be started. The order still exists in pending_payment;
    // the order page offers a retry. Send the customer there with the reason.
    router.push(`/orders/${orderId}?payment=error`);
  };

  // ── Auth still resolving: never flash the login wall before we know. ─────────
  if (!hydrated || authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#f8f8f8]">
        <PageHeader />
        <main className="mx-auto max-w-[720px] px-5 py-8">
          <div
            role="status"
            aria-live="polite"
            className="rounded-[20px] border border-[#e5e7eb] bg-white p-8 text-center"
          >
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[#084799] border-t-transparent" />
            <p className="mt-3 text-[14px] text-[#6b7280]">Oturumunuz kontrol ediliyor…</p>
          </div>
        </main>
      </div>
    );
  }

  // ── Guest view ───────────────────────────────────────────────────────────────
  if (authStatus === 'anonymous') {
    return (
      <div className="min-h-screen bg-[#f8f8f8]">
        <PageHeader />
        <main className="mx-auto max-w-[720px] px-5 py-8">
          <div className="rounded-[20px] border border-[#fbbf24]/30 bg-[#fffbeb] p-8 text-center">
            <p className="text-[17px] font-semibold text-[#92400e]">
              Sipariş vermek için giriş yapmalısınız
            </p>
            <p className="mt-2 text-[14px] text-[#b45309]">
              Misafir olarak sepet oluşturabilirsiniz, ancak sipariş için hesap gerekmektedir.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link
                href="/login?returnTo=/checkout"
                className="rounded-[12px] bg-[#084799] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#063d85]"
              >
                Giriş Yap
              </Link>
              <Link
                href="/signup?returnTo=/checkout"
                className="rounded-[12px] border border-[#084799] px-5 py-2.5 text-[14px] font-semibold text-[#084799] transition hover:bg-[#eef4fb]"
              >
                Kayıt Ol
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Empty cart ───────────────────────────────────────────────────────────────
  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-[#f8f8f8]">
        <PageHeader />
        <main className="mx-auto max-w-[720px] px-5 py-8">
          <div className="rounded-[20px] bg-white p-10 text-center shadow-sm">
            <p className="text-[18px] font-semibold text-[#18181b]">Sepetiniz boş</p>
            <p className="mt-2 text-[14px] text-[#71717a]">
              Önce bir restoran menüsünden ürün ekleyin.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 rounded-[12px] bg-[#084799] px-6 py-3 text-[14px] font-semibold text-white transition hover:bg-[#063d85]"
            >
              Restoranları Keşfet
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const orderingPolicy = readiness?.commerce?.orderingPolicy ?? null;
  const minOrderAmount = orderingPolicy?.minOrderAmount ?? 0;
  const minOrderViolation = orderingPolicy && subtotal < orderingPolicy.minOrderAmount;
  const deliveryFee = readiness?.commerce?.deliveryFeeAmount ?? 0;
  const computedTotal =
    readiness?.totalAmount ??
    (cart.serviceType === 'delivery' ? subtotal + deliveryFee : subtotal);

  const legalVersionIds = pickOrderAcceptanceVersionIds(legalDocuments);
  const legalReady = legalVersionIds !== null;
  const distanceSalesDoc = legalDocuments.find(
    (doc) => doc.typeCode === 'distance_sales_contract' && doc.currentVersion,
  );
  const preInformationDoc = legalDocuments.find(
    (doc) => doc.typeCode === 'pre_information_form' && doc.currentVersion,
  );

  const canSubmit =
    !submitting &&
    !readinessLoading &&
    !legalLoading &&
    legalReady &&
    legalAccepted &&
    (readiness === null || readiness.canCheckout);

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <PageHeader />

      <main className="mx-auto max-w-[860px] px-5 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Left: order summary + commerce config */}
          <div className="space-y-4">
            {/* Service type tabs */}
            <div className="rounded-[20px] bg-white p-5 shadow-sm">
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa]">
                Sipariş türü
              </p>
              <div className="inline-flex w-full rounded-[12px] bg-[#f4f4f5] p-1 text-[13px] font-semibold">
                <button
                  onClick={() => setServiceType('delivery')}
                  disabled={orderingPolicy ? !orderingPolicy.acceptsDelivery : false}
                  className={`flex-1 rounded-[10px] px-3 py-2 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    cart.serviceType === 'delivery'
                      ? 'bg-white text-[#084799] shadow-sm'
                      : 'text-[#71717a] hover:text-[#18181b]'
                  }`}
                >
                  Teslimat
                </button>
                <button
                  onClick={() => setServiceType('pickup')}
                  disabled={orderingPolicy ? !orderingPolicy.acceptsPickup : false}
                  className={`flex-1 rounded-[10px] px-3 py-2 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    cart.serviceType === 'pickup'
                      ? 'bg-white text-[#084799] shadow-sm'
                      : 'text-[#71717a] hover:text-[#18181b]'
                  }`}
                >
                  Gel Al
                </button>
              </div>

              {cart.serviceType === 'delivery' ? (
                <div className="mt-4 space-y-2">
                  <label className="block text-[12px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa]">
                    Teslimat mesafesi (km)
                  </label>
                  <input
                    value={distanceInput}
                    inputMode="decimal"
                    placeholder="ör. 3.5"
                    onChange={(event) => setDistanceInput(event.target.value)}
                    onBlur={() => {
                      const parsed = Number(distanceInput);
                      setDeliveryDistance(
                        Number.isFinite(parsed) && parsed >= 0 ? parsed : null,
                      );
                    }}
                    className="w-full rounded-[10px] border border-[#e4e4e7] bg-white px-3 py-2 text-[14px] outline-none focus:border-[#084799]"
                  />
                  {readiness?.commerce?.deliveryFeeTiers && readiness.commerce.deliveryFeeTiers.length > 0 ? (
                    <p className="text-[12px] text-[#71717a]">
                      Mevcut dilimler:{' '}
                      {readiness.commerce.deliveryFeeTiers
                        .filter((t) => t.isActive)
                        .map((t) => `${t.minDistanceKm}-${t.maxDistanceKm}km: ${t.feeAmount} ${currency}`)
                        .join(' · ')}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Order summary */}
            <div className="rounded-[20px] bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-[16px] font-bold text-[#18181b]">Sipariş Özeti</h2>
              {cart.storeName && (
                <p className="mb-4 text-[14px] font-medium text-[#71717a]">
                  {cart.storeName}
                </p>
              )}
              <div className="space-y-3">
                {cart.items.map((item) => (
                  <div key={item.menuItemId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#084799] text-[12px] font-bold text-white">
                        {item.quantity}
                      </span>
                      <span className="text-[14px] text-[#18181b]">{item.name}</span>
                    </div>
                    <span className="text-[14px] font-semibold text-[#18181b]">
                      {(item.price * item.quantity).toFixed(2)} {currency}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2 border-t border-[#f4f4f5] pt-4 text-[14px]">
                <div className="flex items-center justify-between text-[#71717a]">
                  <span>Ara toplam</span>
                  <span>
                    {subtotal.toFixed(2)} {currency}
                  </span>
                </div>
                {cart.serviceType === 'delivery' ? (
                  <div className="flex items-center justify-between text-[#71717a]">
                    <span>Teslimat ücreti</span>
                    <span>
                      {deliveryFee.toFixed(2)} {currency}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[15px] font-bold text-[#18181b]">Toplam</span>
                  <span className="text-[18px] font-bold text-[#084799]">
                    {computedTotal.toFixed(2)} {currency}
                  </span>
                </div>
              </div>
            </div>

            {/* Secure payment — Stripe hosted checkout */}
            <div className="rounded-[20px] bg-white p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef4fb] text-[#084799]">
                  <LockIcon />
                </div>
                <div>
                  <h2 className="text-[16px] font-bold text-[#18181b]">Güvenli Ödeme</h2>
                  <p className="mt-1 text-[13px] leading-6 text-[#71717a]">
                    Ödemenizi Stripe&apos;ın güvenli ödeme sayfasında tamamlayacaksınız.
                    Kart, TWINT, Apple Pay ve Google Pay desteklenir. Kart bilgileriniz
                    bu siteyle paylaşılmaz.
                  </p>
                </div>
              </div>
            </div>

            {/* Legal acceptance (distance-sales contract + pre-information form) */}
            <div className="rounded-[20px] bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-[16px] font-bold text-[#18181b]">
                Yasal Onay
              </h2>
              {legalLoading ? (
                <p className="text-[13px] text-[#71717a]">
                  Yasal belgeler yükleniyor…
                </p>
              ) : !legalReady ? (
                <div className="rounded-[12px] bg-amber-50 px-4 py-3 text-[13px] text-amber-700">
                  Yasal belgeler henüz yapılandırılmamış. Mesafeli satış
                  sözleşmesi ve ön bilgilendirme formu admin tarafından
                  yayınlanana kadar sipariş veremezsiniz.
                </div>
              ) : (
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={legalAccepted}
                    onChange={(event) => setLegalAccepted(event.target.checked)}
                    className="mt-1 h-4 w-4 flex-shrink-0"
                  />
                  <span className="text-[13px] leading-6 text-[#3f3f46]">
                    {distanceSalesDoc?.currentVersion?.title ?? 'Mesafeli satış sözleşmesi'}
                    {' ve '}
                    {preInformationDoc?.currentVersion?.title ?? 'ön bilgilendirme formu'}
                    {'’nu okudum ve kabul ediyorum. '}
                    {distanceSalesDoc?.currentVersion?.versionLabel ? (
                      <span className="text-[#a1a1aa]">
                        (sürüm {distanceSalesDoc.currentVersion.versionLabel})
                      </span>
                    ) : null}
                  </span>
                </label>
              )}
            </div>

            {/* Blocking issues / min order warning */}
            {minOrderViolation ? (
              <div className="rounded-[16px] border border-amber-200 bg-amber-50 p-4">
                <p className="text-[14px] font-semibold text-amber-800">
                  Minimum sepet tutarı karşılanmadı
                </p>
                <p className="mt-1 text-[13px] text-amber-700">
                  Bu restoran için minimum sipariş tutarı {minOrderAmount.toFixed(2)} {currency}.
                  Lütfen sepete ürün ekleyin.
                </p>
              </div>
            ) : null}

            {readiness && readiness.blockingIssues.length > 0 && (
              <div className="rounded-[16px] border border-red-200 bg-red-50 p-4">
                <p className="text-[14px] font-semibold text-red-700">
                  Sepette sorun tespit edildi
                </p>
                <ul className="mt-2 space-y-1">
                  {readiness.blockingIssues.map((issue, i) => (
                    <li key={i} className="text-[13px] text-red-600">
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {readinessError && (
              <div className="rounded-[16px] border border-amber-200 bg-amber-50 p-4">
                <p className="text-[13px] text-amber-700">{readinessError}</p>
              </div>
            )}
          </div>

          {/* Right: CTA */}
          <div className="space-y-4">
            <div className="sticky top-4 rounded-[20px] bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center justify-between text-[14px] text-[#71717a]">
                <span>Ara toplam</span>
                <span className="font-semibold">
                  {subtotal.toFixed(2)} {currency}
                </span>
              </div>
              {cart.serviceType === 'delivery' ? (
                <div className="mb-3 flex items-center justify-between text-[14px] text-[#71717a]">
                  <span>Teslimat ücreti</span>
                  <span className="font-semibold">
                    {deliveryFee.toFixed(2)} {currency}
                  </span>
                </div>
              ) : null}
              <div className="mb-5 flex items-center justify-between border-t border-[#f4f4f5] pt-3">
                <span className="text-[15px] font-bold text-[#18181b]">Toplam</span>
                <span className="text-[18px] font-bold text-[#084799]">
                  {computedTotal.toFixed(2)} {currency}
                </span>
              </div>

              {readiness?.existingPendingPaymentOrderId && (
                <div className="mb-4 rounded-[12px] border border-amber-200 bg-amber-50 p-3">
                  <p className="text-[13px] text-amber-700">
                    Bekleyen bir siparişiniz zaten var.
                  </p>
                  <Link
                    href={`/orders/${readiness.existingPendingPaymentOrderId}`}
                    className="mt-1 inline-block text-[13px] font-semibold text-[#084799] hover:underline"
                  >
                    Siparişi görüntüle →
                  </Link>
                </div>
              )}

              {submitError && (
                <div className="mb-4 rounded-[12px] bg-red-50 px-4 py-3 text-[13px] text-red-600">
                  {submitError}
                </div>
              )}

              <button
                onClick={handlePlaceOrder}
                disabled={!canSubmit}
                className="w-full rounded-[14px] bg-[#084799] py-4 text-[15px] font-semibold text-white transition hover:bg-[#063d85] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#084799] focus-visible:ring-offset-2"
              >
                {submitting
                  ? 'Ödeme sayfasına yönlendiriliyor…'
                  : readinessLoading
                    ? 'Kontrol ediliyor…'
                    : 'Ödemeye Geç'}
              </button>

              <p className="mt-3 text-center text-[12px] text-[#a1a1aa]">
                Devam ettiğinizde Stripe güvenli ödeme sayfasına yönlendirilirsiniz.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
