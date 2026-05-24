import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { Payment, PaymentStatus } from './entities/payment.entity';

interface PaymentRow {
  id: string;
  orderId: string;
  provider: string;
  status: string;
  amount: string | number;
  currency: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  lastEventId: string | null;
  lastEventType: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Persistence for the Payment record and the Stripe webhook-event ledger.
 *
 * The webhook ledger is the basis of idempotent processing: an event id is
 * inserted on first sight, and only an event already marked `processed` is
 * treated as a duplicate — a `received`/`failed` event is reprocessed so
 * Stripe retries of a transient failure still succeed.
 */
@Injectable()
export class PaymentsStore {
  constructor(private readonly databaseService: DatabaseService) {}

  async findByOrderId(orderId: string): Promise<Payment | null> {
    const row = (await this.databaseService
      .prepare(`SELECT * FROM "Payment" WHERE "orderId" = $orderId LIMIT 1`)
      .get({ $orderId: orderId })) as PaymentRow | undefined;
    return row ? this.mapPayment(row) : null;
  }

  /** Create the payment row on first checkout, or refresh it on retry. */
  async upsertForCheckout(input: {
    orderId: string;
    amount: number;
    currency: string;
    stripeCheckoutSessionId: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    await this.databaseService
      .prepare(
        `INSERT INTO "Payment" (
          "id", "orderId", "provider", "status", "amount", "currency",
          "stripeCheckoutSessionId", "createdAt", "updatedAt"
        ) VALUES (
          $id, $orderId, 'stripe', 'requires_payment', $amount, $currency,
          $sessionId, $now, $now
        )
        ON CONFLICT ("orderId") DO UPDATE SET
          "status" = 'requires_payment',
          "amount" = EXCLUDED."amount",
          "currency" = EXCLUDED."currency",
          "stripeCheckoutSessionId" = EXCLUDED."stripeCheckoutSessionId",
          "updatedAt" = EXCLUDED."updatedAt"`,
      )
      .run({
        $id: randomUUID(),
        $orderId: input.orderId,
        $amount: input.amount,
        $currency: input.currency,
        $sessionId: input.stripeCheckoutSessionId,
        $now: now,
      });
  }

  /** Apply an authoritative payment status from a processed webhook event. */
  async applyWebhookResult(input: {
    orderId: string;
    status: PaymentStatus;
    stripePaymentIntentId: string | null;
    lastEventId: string;
    lastEventType: string;
    failureReason: string | null;
  }): Promise<void> {
    await this.databaseService
      .prepare(
        `UPDATE "Payment" SET
          "status" = $status,
          "stripePaymentIntentId" =
            COALESCE($paymentIntentId, "stripePaymentIntentId"),
          "lastEventId" = $lastEventId,
          "lastEventType" = $lastEventType,
          "failureReason" = $failureReason,
          "updatedAt" = $updatedAt
         WHERE "orderId" = $orderId`,
      )
      .run({
        $orderId: input.orderId,
        $status: input.status,
        $paymentIntentId: input.stripePaymentIntentId,
        $lastEventId: input.lastEventId,
        $lastEventType: input.lastEventType,
        $failureReason: input.failureReason,
        $updatedAt: new Date().toISOString(),
      });
  }

  /**
   * Register a webhook event. Returns `process` when the event must be
   * handled and `duplicate` when it was already processed successfully.
   */
  async beginWebhookEvent(
    eventId: string,
    type: string,
  ): Promise<'process' | 'duplicate'> {
    await this.databaseService
      .prepare(
        `INSERT INTO "StripeWebhookEvent" ("id", "type", "status", "receivedAt")
         VALUES ($id, $type, 'received', $receivedAt)
         ON CONFLICT ("id") DO NOTHING`,
      )
      .run({
        $id: eventId,
        $type: type,
        $receivedAt: new Date().toISOString(),
      });

    const row = (await this.databaseService
      .prepare(
        `SELECT "status" FROM "StripeWebhookEvent" WHERE "id" = $id LIMIT 1`,
      )
      .get({ $id: eventId })) as { status: string } | undefined;

    return row?.status === 'processed' ? 'duplicate' : 'process';
  }

  async completeWebhookEvent(
    eventId: string,
    status: 'processed' | 'ignored' | 'failed',
    orderId: string | null,
    note: string | null,
  ): Promise<void> {
    await this.databaseService
      .prepare(
        `UPDATE "StripeWebhookEvent" SET
          "status" = $status,
          "orderId" = $orderId,
          "note" = $note,
          "processedAt" = $processedAt
         WHERE "id" = $id`,
      )
      .run({
        $id: eventId,
        $status: status,
        $orderId: orderId,
        $note: note,
        $processedAt: new Date().toISOString(),
      });
  }

  private mapPayment(row: PaymentRow): Payment {
    return {
      id: row.id,
      orderId: row.orderId,
      provider: row.provider,
      status: row.status as PaymentStatus,
      amount: Number(row.amount),
      currency: row.currency,
      stripeCheckoutSessionId: row.stripeCheckoutSessionId,
      stripePaymentIntentId: row.stripePaymentIntentId,
      lastEventId: row.lastEventId,
      lastEventType: row.lastEventType,
      failureReason: row.failureReason,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}
