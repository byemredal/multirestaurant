-- Migration 0019: Stripe payment integration.
--
-- Adds the payment record bound to an Order and a webhook-event ledger used
-- for idempotent, duplicate-safe webhook processing. The webhook is the
-- authoritative source of payment confirmation — these tables let the API
-- reconcile Stripe events against orders without trusting frontend redirects.

-- One payment per order. Carries the Stripe Checkout Session / PaymentIntent
-- linkage and the last applied event for stale-event protection.
CREATE TABLE IF NOT EXISTS "Payment" (
  "id" UUID NOT NULL PRIMARY KEY,
  "orderId" UUID NOT NULL UNIQUE,
  "provider" TEXT NOT NULL DEFAULT 'stripe',
  -- requires_payment | processing | succeeded | failed | expired
  "status" TEXT NOT NULL DEFAULT 'requires_payment',
  "amount" NUMERIC(12, 2) NOT NULL,
  "currency" TEXT NOT NULL,
  "stripeCheckoutSessionId" TEXT,
  "stripePaymentIntentId" TEXT,
  "lastEventId" TEXT,
  "lastEventType" TEXT,
  "failureReason" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "Payment_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Payment_stripeCheckoutSessionId_idx"
  ON "Payment" ("stripeCheckoutSessionId");

CREATE INDEX IF NOT EXISTS "Payment_stripePaymentIntentId_idx"
  ON "Payment" ("stripePaymentIntentId");

-- Webhook-event ledger. The Stripe event id is the primary key, so an
-- INSERT ... ON CONFLICT DO NOTHING that affects zero rows means the event
-- was already received — the basis of duplicate-webhook protection.
CREATE TABLE IF NOT EXISTS "StripeWebhookEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL,
  -- received | processed | ignored | failed
  "status" TEXT NOT NULL DEFAULT 'received',
  "orderId" UUID,
  "note" TEXT,
  "receivedAt" TIMESTAMPTZ NOT NULL,
  "processedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "StripeWebhookEvent_receivedAt_idx"
  ON "StripeWebhookEvent" ("receivedAt");
