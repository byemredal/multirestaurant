import { isAuthExpiredError, webAuthedFetch } from '@/lib/api/authed-fetch';

export type PaymentSessionResult =
  | { ok: true; url: string; reused: boolean }
  | { ok: false; status: number; message: string };

/**
 * Create (or reuse) a Stripe Checkout session for a pending-payment order.
 * The returned URL is the Stripe-hosted checkout page to redirect to.
 */
export async function createStripeCheckoutSession(
  _token: string,
  orderId: string,
): Promise<PaymentSessionResult> {
  try {
    const response = await webAuthedFetch(`/orders/${orderId}/payment/session`, {
      method: 'POST',
    });

    const data = await response.json().catch(() => null);
    if (response.ok) {
      const payload = data as { url: string; reused: boolean };
      return { ok: true, url: payload.url, reused: Boolean(payload.reused) };
    }

    const raw = data as
      | { error?: { message?: string }; message?: string }
      | null;
    const message =
      (typeof raw?.error?.message === 'string' && raw.error.message) ||
      (typeof raw?.message === 'string' && raw.message) ||
      'Ödeme başlatılamadı. Lütfen tekrar deneyin.';
    return { ok: false, status: response.status, message };
  } catch (error) {
    if (isAuthExpiredError(error)) {
      throw error;
    }
    return {
      ok: false,
      status: 0,
      message: 'Bağlantı hatası. Lütfen tekrar deneyin.',
    };
  }
}
