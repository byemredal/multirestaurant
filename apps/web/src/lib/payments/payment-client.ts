import { apiClient } from '@/lib/api/api-client';
import { apiBaseUrl } from '@/lib/config';

export type PaymentSessionResult =
  | { ok: true; url: string; reused: boolean }
  | { ok: false; status: number; message: string };

/**
 * Create (or reuse) a Stripe Checkout session for a pending-payment order.
 * The returned URL is the Stripe-hosted checkout page to redirect to.
 */
export async function createStripeCheckoutSession(
  token: string,
  orderId: string,
): Promise<PaymentSessionResult> {
  try {
    const res = await apiClient({
      method: 'POST',
      url: `${apiBaseUrl}/orders/${orderId}/payment/session`,
      token,
    });

    if (res.ok) {
      const data = res.data as { url: string; reused: boolean };
      return { ok: true, url: data.url, reused: Boolean(data.reused) };
    }

    const raw = res.data as
      | { error?: { message?: string }; message?: string }
      | null;
    const message =
      (typeof raw?.error?.message === 'string' && raw.error.message) ||
      (typeof raw?.message === 'string' && raw.message) ||
      'Ödeme başlatılamadı. Lütfen tekrar deneyin.';
    return { ok: false, status: res.status, message };
  } catch {
    return {
      ok: false,
      status: 0,
      message: 'Bağlantı hatası. Lütfen tekrar deneyin.',
    };
  }
}
