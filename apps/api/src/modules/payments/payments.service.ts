import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { LegalConsentService } from '../legal-consent/legal-consent.service';
import { OrderStatus } from '../orders/entities/order.entity';
import { OrdersService, PaymentOutcome } from '../orders/orders.service';
import { InstallationProfileService } from '../setup/installation-profile.service';
import { PaymentStatus } from './entities/payment.entity';
import { PaymentsStore } from './payments.store';
import { StripeService } from './stripe.service';

/** Stripe Checkout Sessions expire after 30 minutes — aligned with the
 *  order's own pending-payment window so the two never disagree. */
const CHECKOUT_SESSION_TTL_SECONDS = 30 * 60;

interface ProcessResult {
  handled: boolean;
  orderId: string | null;
  note: string;
}

/**
 * Payment orchestration:
 *  - creates Stripe Checkout Sessions for pending-payment orders,
 *  - consumes authoritative Stripe webhook events and reconciles them onto
 *    the Payment record and the order lifecycle.
 *
 * The webhook — never a frontend redirect — is the source of truth for
 * whether a payment succeeded.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly paymentsStore: PaymentsStore,
    private readonly ordersService: OrdersService,
    private readonly legalConsentService: LegalConsentService,
    private readonly installationProfileService: InstallationProfileService,
  ) {}

  /**
   * Resolve the currency for a Stripe Checkout session. We ALWAYS prefer
   * the order's frozen `currencySnapshot` so historical orders pay in their
   * original currency (TR install reopening a CH order would not flip the
   * receipt). When the snapshot is missing, fall back to the active
   * InstallationProfile's currency — replaces the previous hardcoded 'CHF'.
   */
  private async resolveCheckoutCurrency(orderCurrencySnapshot: string | null): Promise<string> {
    if (orderCurrencySnapshot && orderCurrencySnapshot.trim().length > 0) {
      return orderCurrencySnapshot;
    }
    const policy = await this.installationProfileService.findActiveCountryPolicy();
    if (policy) {
      return policy.currencyCode;
    }
    // Pre-setup payments must not happen — but keep a defensive belt for
    // tests / dev DBs that exercise this path without a profile row.
    return 'CHF';
  }

  /**
   * Create (or reuse) a Stripe Checkout Session for a customer-owned order
   * that is awaiting payment. Returns the hosted-checkout URL to redirect to.
   */
  async createCheckoutSession(
    customerAccountId: string,
    orderId: string,
  ): Promise<{ url: string; reused: boolean }> {
    if (!this.stripeService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Ödeme şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
      );
    }

    const { order, storeName } =
      await this.ordersService.getOrderForPaymentSession(
        customerAccountId,
        orderId,
      );

    // A fresh order awaits payment; a failed/expired one can be retried. Any
    // other status means payment already advanced — nothing to start.
    const payableStatuses: OrderStatus[] = [
      OrderStatus.PENDING_PAYMENT,
      OrderStatus.PAYMENT_FAILED,
    ];
    if (!payableStatuses.includes(order.status)) {
      throw new ConflictException({
        message: `Bu sipariş artık ödeme bekleyen durumda değil (durum: ${order.status}).`,
        orderStatus: order.status,
      });
    }

    // J-12 precondition: the distance-sales contract + pre-information form
    // must already be accepted before money is taken. Checkout records this
    // immediately after order creation, so this is an early, clean guard.
    await this.legalConsentService.ensureAcceptanceForConfirmation(orderId);

    // Refresh-safe: if an open session already exists, reuse its URL instead
    // of opening a second payment for the same order.
    const existing = await this.paymentsStore.findByOrderId(orderId);
    if (
      existing?.stripeCheckoutSessionId &&
      existing.status === 'requires_payment'
    ) {
      const reusedUrl = await this.tryReuseOpenSession(
        existing.stripeCheckoutSessionId,
      );
      if (reusedUrl) {
        return { url: reusedUrl, reused: true };
      }
    }

    const amountInMinorUnits = Math.round(order.totalAmount * 100);
    if (amountInMinorUnits < 1) {
      throw new BadRequestException('Order amount is not payable.');
    }

    const resolvedCurrency = await this.resolveCheckoutCurrency(order.currencySnapshot);
    const currency = resolvedCurrency.toLowerCase();
    const shortId = orderId.slice(0, 8).toUpperCase();
    const webBase = this.stripeService.webAppBaseUrl.replace(/\/+$/, '');

    const session = await this.stripeService.getClient().checkout.sessions.create({
      mode: 'payment',
      // payment_method_types omitted on purpose: Stripe "automatic payment
      // methods" then offers every method enabled in the dashboard — card,
      // Apple Pay, Google Pay and TWINT for a Swiss (CHF) account.
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amountInMinorUnits,
            product_data: {
              name: `${storeName} — Sipariş #${shortId}`,
            },
          },
        },
      ],
      client_reference_id: orderId,
      metadata: { orderId },
      payment_intent_data: { metadata: { orderId } },
      success_url: `${webBase}/orders/${orderId}?payment=success`,
      cancel_url: `${webBase}/orders/${orderId}?payment=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_SESSION_TTL_SECONDS,
    });

    if (!session.url) {
      throw new ServiceUnavailableException(
        'Stripe did not return a checkout URL.',
      );
    }

    await this.paymentsStore.upsertForCheckout({
      orderId,
      amount: order.totalAmount,
      currency: resolvedCurrency,
      stripeCheckoutSessionId: session.id,
    });

    this.logger.log(
      `Checkout session ${session.id} created for order ${orderId}.`,
    );
    return { url: session.url, reused: false };
  }

  /**
   * Verify and process a Stripe webhook delivery. Idempotent and
   * duplicate-safe; an invalid signature is rejected with a 4xx.
   */
  async handleWebhookEvent(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ received: true; duplicate?: boolean; handled?: boolean }> {
    let event: Stripe.Event;
    try {
      event = this.stripeService.constructEvent(rawBody, signature);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.warn(
        `Rejected webhook with invalid signature: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new BadRequestException(
        'Stripe webhook signature verification failed.',
      );
    }

    // Duplicate protection: a previously-processed event id is a no-op.
    const decision = await this.paymentsStore.beginWebhookEvent(
      event.id,
      event.type,
    );
    if (decision === 'duplicate') {
      this.logger.log(
        `Webhook ${event.id} (${event.type}) ignored — already processed.`,
      );
      return { received: true, duplicate: true };
    }

    try {
      const result = await this.processEvent(event);
      await this.paymentsStore.completeWebhookEvent(
        event.id,
        result.handled ? 'processed' : 'ignored',
        result.orderId,
        result.note,
      );
      this.logger.log(
        `Webhook ${event.id} (${event.type}) ${
          result.handled ? 'processed' : 'ignored'
        }${result.orderId ? ` for order ${result.orderId}` : ''}.`,
      );
      return { received: true, handled: result.handled };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Keep the event as `failed` so a Stripe retry reprocesses it.
      await this.paymentsStore.completeWebhookEvent(
        event.id,
        'failed',
        null,
        message,
      );
      this.logger.error(
        `Webhook ${event.id} (${event.type}) failed: ${message}`,
      );
      throw error;
    }
  }

  /** Dispatch a verified event to the matching payment-outcome handler. */
  private async processEvent(event: Stripe.Event): Promise<ProcessResult> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = this.extractSessionOrderId(session);
        if (!orderId) {
          return { handled: false, orderId: null, note: 'No orderId on session.' };
        }
        // payment_status === 'paid' means funds captured; otherwise an async
        // method (e.g. some TWINT/bank flows) is still settling.
        const outcome: PaymentOutcome =
          session.payment_status === 'paid' ? 'succeeded' : 'processing';
        return this.applyOutcome(orderId, outcome, event, {
          paymentIntentId: this.extractPaymentIntentId(session.payment_intent),
        });
      }

      case 'checkout.session.async_payment_succeeded':
      case 'payment_intent.succeeded': {
        const orderId = this.extractAnyOrderId(event);
        if (!orderId) {
          return { handled: false, orderId: null, note: 'No orderId on event.' };
        }
        return this.applyOutcome(orderId, 'succeeded', event, {
          paymentIntentId: this.extractEventPaymentIntentId(event),
        });
      }

      case 'checkout.session.async_payment_failed':
      case 'payment_intent.payment_failed': {
        const orderId = this.extractAnyOrderId(event);
        if (!orderId) {
          return { handled: false, orderId: null, note: 'No orderId on event.' };
        }
        return this.applyOutcome(orderId, 'failed', event, {
          paymentIntentId: this.extractEventPaymentIntentId(event),
          failureReason: this.extractFailureReason(event),
        });
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = this.extractSessionOrderId(session);
        if (!orderId) {
          return { handled: false, orderId: null, note: 'No orderId on session.' };
        }
        return this.applyOutcome(orderId, 'expired', event, {
          paymentIntentId: this.extractPaymentIntentId(session.payment_intent),
          failureReason: 'Checkout session expired before payment.',
        });
      }

      default:
        // Not a payment-lifecycle event we act on — recorded as `ignored`.
        return {
          handled: false,
          orderId: null,
          note: `Unhandled event type: ${event.type}`,
        };
    }
  }

  /**
   * Reconcile a payment outcome onto both the Payment record and the order.
   * Order transitions are idempotent and stale-safe (see OrdersService).
   */
  private async applyOutcome(
    orderId: string,
    outcome: PaymentOutcome,
    event: Stripe.Event,
    extra: { paymentIntentId?: string | null; failureReason?: string | null },
  ): Promise<ProcessResult> {
    const paymentStatus: PaymentStatus =
      outcome === 'succeeded'
        ? 'succeeded'
        : outcome === 'processing'
          ? 'processing'
          : outcome === 'expired'
            ? 'expired'
            : 'failed';

    const existing = await this.paymentsStore.findByOrderId(orderId);
    // Stale-event protection at the payment level: never downgrade a payment
    // that already succeeded back to processing/failed.
    const isDowngrade =
      existing?.status === 'succeeded' && paymentStatus !== 'succeeded';

    if (existing && !isDowngrade) {
      await this.paymentsStore.applyWebhookResult({
        orderId,
        status: paymentStatus,
        stripePaymentIntentId: extra.paymentIntentId ?? null,
        lastEventId: event.id,
        lastEventType: event.type,
        failureReason: extra.failureReason ?? null,
      });
    }

    const note = this.outcomeNote(outcome, event.type);
    const orderResult = await this.ordersService.applyPaymentOutcome(
      orderId,
      outcome,
      note,
    );

    return {
      handled: true,
      orderId,
      note: `${event.type} → payment:${paymentStatus}, order:${
        orderResult.status ?? 'unknown'
      }${orderResult.changed ? '' : ' (no-op)'}`,
    };
  }

  /** Retrieve a stored session and return its URL only if still open. */
  private async tryReuseOpenSession(
    sessionId: string,
  ): Promise<string | null> {
    try {
      const session =
        await this.stripeService.getClient().checkout.sessions.retrieve(
          sessionId,
        );
      if (session.status === 'open' && session.url) {
        return session.url;
      }
    } catch (error) {
      this.logger.warn(
        `Could not reuse checkout session ${sessionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return null;
  }

  private extractSessionOrderId(session: Stripe.Checkout.Session): string | null {
    return session.metadata?.orderId ?? session.client_reference_id ?? null;
  }

  private extractAnyOrderId(event: Stripe.Event): string | null {
    const object = event.data.object as
      | Stripe.Checkout.Session
      | Stripe.PaymentIntent;
    if (object.metadata && typeof object.metadata.orderId === 'string') {
      return object.metadata.orderId;
    }
    if (
      'client_reference_id' in object &&
      typeof object.client_reference_id === 'string'
    ) {
      return object.client_reference_id;
    }
    return null;
  }

  private extractPaymentIntentId(
    paymentIntent: string | Stripe.PaymentIntent | null | undefined,
  ): string | null {
    if (!paymentIntent) {
      return null;
    }
    return typeof paymentIntent === 'string'
      ? paymentIntent
      : paymentIntent.id;
  }

  private extractEventPaymentIntentId(event: Stripe.Event): string | null {
    if (event.type.startsWith('payment_intent.')) {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      return paymentIntent.id;
    }
    const session = event.data.object as Stripe.Checkout.Session;
    return this.extractPaymentIntentId(session.payment_intent);
  }

  private extractFailureReason(event: Stripe.Event): string | null {
    const object = event.data.object as Stripe.PaymentIntent;
    return (
      object.last_payment_error?.message ??
      'Ödeme tamamlanamadı.'
    );
  }

  private outcomeNote(outcome: PaymentOutcome, eventType: string): string {
    switch (outcome) {
      case 'succeeded':
        return `Ödeme onaylandı (Stripe: ${eventType}).`;
      case 'processing':
        return `Ödeme işleniyor (Stripe: ${eventType}).`;
      case 'expired':
        return `Ödeme oturumunun süresi doldu (Stripe: ${eventType}).`;
      case 'failed':
      default:
        return `Ödeme başarısız oldu (Stripe: ${eventType}).`;
    }
  }
}
