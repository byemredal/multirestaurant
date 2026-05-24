/** Lifecycle of a payment, mirrored from authoritative Stripe events. */
export type PaymentStatus =
  | 'requires_payment'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'expired';

/** A single payment attempt bound 1:1 to an Order. */
export interface Payment {
  id: string;
  orderId: string;
  provider: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  /** Id/type of the last Stripe event applied — supports traceability. */
  lastEventId: string | null;
  lastEventType: string | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}
