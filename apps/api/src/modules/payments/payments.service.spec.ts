import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import Stripe from 'stripe';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';

/**
 * Webhook-lifecycle validation. Real Stripe signature crypto is exercised via
 * `generateTestHeaderString` / `constructEvent` — no Stripe account or network
 * is needed, only a locally-shared webhook secret.
 */
describe('PaymentsService — Stripe webhook lifecycle', () => {
  const WEBHOOK_SECRET = 'whsec_test_lieferzonen_validation_secret';
  const stripe = new Stripe('sk_test_dummy');

  function buildEvent(type: string, object: Record<string, unknown>, id?: string) {
    return {
      id: id ?? `evt_${Math.random().toString(36).slice(2, 12)}`,
      object: 'event',
      type,
      api_version: '2024-01-01',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: { object },
    };
  }

  function signedDelivery(event: object) {
    const payload = JSON.stringify(event);
    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });
    return { rawBody: Buffer.from(payload, 'utf8'), header };
  }

  function createService(
    overrides: {
      beginDecision?: 'process' | 'duplicate';
      existingPayment?: { status: string } | null;
    } = {},
  ) {
    const configService = {
      get: (key: string) =>
        key === 'stripe.secretKey'
          ? 'sk_test_dummy'
          : key === 'stripe.webhookSecret'
            ? WEBHOOK_SECRET
            : key === 'stripe.webAppBaseUrl'
              ? 'http://localhost:3000'
              : undefined,
    };
    const stripeService = new StripeService(configService as any);

    const paymentsStore = {
      beginWebhookEvent: jest
        .fn()
        .mockResolvedValue(overrides.beginDecision ?? 'process'),
      completeWebhookEvent: jest.fn().mockResolvedValue(undefined),
      findByOrderId: jest
        .fn()
        .mockResolvedValue(overrides.existingPayment ?? { status: 'requires_payment' }),
      applyWebhookResult: jest.fn().mockResolvedValue(undefined),
      upsertForCheckout: jest.fn().mockResolvedValue(undefined),
    };
    const ordersService = {
      applyPaymentOutcome: jest
        .fn()
        .mockResolvedValue({ changed: true, status: 'pending_confirmation' }),
    };
    const legalConsentService = {
      ensureAcceptanceForConfirmation: jest.fn().mockResolvedValue(undefined),
    };

    const installationProfileService = {
      findActiveCountryPolicy: jest.fn().mockResolvedValue(null),
    };

    const service = new PaymentsService(
      stripeService,
      paymentsStore as any,
      ordersService as any,
      legalConsentService as any,
      installationProfileService as any,
    );

    return { service, paymentsStore, ordersService };
  }

  it('processes a paid checkout.session.completed event as a succeeded outcome', async () => {
    const { service, paymentsStore, ordersService } = createService();
    const event = buildEvent('checkout.session.completed', {
      id: 'cs_test_1',
      object: 'checkout.session',
      payment_status: 'paid',
      payment_intent: 'pi_test_1',
      metadata: { orderId: 'order-1' },
      client_reference_id: 'order-1',
    });
    const { rawBody, header } = signedDelivery(event);

    const result = await service.handleWebhookEvent(rawBody, header);

    expect(result).toEqual({ received: true, handled: true });
    expect(ordersService.applyPaymentOutcome).toHaveBeenCalledWith(
      'order-1',
      'succeeded',
      expect.any(String),
    );
    expect(paymentsStore.applyWebhookResult).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', status: 'succeeded' }),
    );
    expect(paymentsStore.completeWebhookEvent).toHaveBeenCalledWith(
      event.id,
      'processed',
      'order-1',
      expect.any(String),
    );
  });

  it('rejects a delivery with an invalid signature and never records it', async () => {
    const { service, paymentsStore } = createService();
    const event = buildEvent('checkout.session.completed', {
      payment_status: 'paid',
      metadata: { orderId: 'order-1' },
    });
    const { rawBody } = signedDelivery(event);

    await expect(
      service.handleWebhookEvent(rawBody, 't=1,v1=forged_signature'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(paymentsStore.beginWebhookEvent).not.toHaveBeenCalled();
  });

  it('skips a duplicate event without touching the order', async () => {
    const { service, ordersService } = createService({
      beginDecision: 'duplicate',
    });
    const event = buildEvent('checkout.session.completed', {
      payment_status: 'paid',
      metadata: { orderId: 'order-1' },
      payment_intent: 'pi_test_1',
    });
    const { rawBody, header } = signedDelivery(event);

    const result = await service.handleWebhookEvent(rawBody, header);

    expect(result).toEqual({ received: true, duplicate: true });
    expect(ordersService.applyPaymentOutcome).not.toHaveBeenCalled();
  });

  it('maps payment_intent.payment_failed to a failed outcome', async () => {
    const { service, ordersService } = createService();
    const event = buildEvent('payment_intent.payment_failed', {
      id: 'pi_test_2',
      object: 'payment_intent',
      metadata: { orderId: 'order-2' },
      last_payment_error: { message: 'Your card was declined.' },
    });
    const { rawBody, header } = signedDelivery(event);

    await service.handleWebhookEvent(rawBody, header);

    expect(ordersService.applyPaymentOutcome).toHaveBeenCalledWith(
      'order-2',
      'failed',
      expect.any(String),
    );
  });

  it('maps an unpaid checkout.session.completed to a processing outcome', async () => {
    const { service, ordersService } = createService();
    const event = buildEvent('checkout.session.completed', {
      object: 'checkout.session',
      payment_status: 'unpaid',
      payment_intent: 'pi_test_3',
      metadata: { orderId: 'order-3' },
    });
    const { rawBody, header } = signedDelivery(event);

    await service.handleWebhookEvent(rawBody, header);

    expect(ordersService.applyPaymentOutcome).toHaveBeenCalledWith(
      'order-3',
      'processing',
      expect.any(String),
    );
  });

  it('maps checkout.session.expired to an expired outcome', async () => {
    const { service, ordersService } = createService();
    const event = buildEvent('checkout.session.expired', {
      object: 'checkout.session',
      payment_status: 'unpaid',
      metadata: { orderId: 'order-4' },
    });
    const { rawBody, header } = signedDelivery(event);

    await service.handleWebhookEvent(rawBody, header);

    expect(ordersService.applyPaymentOutcome).toHaveBeenCalledWith(
      'order-4',
      'expired',
      expect.any(String),
    );
  });

  it('records an unhandled event type as ignored', async () => {
    const { service, ordersService, paymentsStore } = createService();
    const event = buildEvent('charge.refunded', { id: 'ch_1' });
    const { rawBody, header } = signedDelivery(event);

    const result = await service.handleWebhookEvent(rawBody, header);

    expect(result).toEqual({ received: true, handled: false });
    expect(ordersService.applyPaymentOutcome).not.toHaveBeenCalled();
    expect(paymentsStore.completeWebhookEvent).toHaveBeenCalledWith(
      event.id,
      'ignored',
      null,
      expect.any(String),
    );
  });

  it('does not downgrade an already-succeeded payment on a later failed event', async () => {
    const { service, paymentsStore } = createService({
      existingPayment: { status: 'succeeded' },
    });
    const event = buildEvent('payment_intent.payment_failed', {
      id: 'pi_test_5',
      object: 'payment_intent',
      metadata: { orderId: 'order-5' },
    });
    const { rawBody, header } = signedDelivery(event);

    await service.handleWebhookEvent(rawBody, header);

    // Payment row is not rewritten to a failed status.
    expect(paymentsStore.applyWebhookResult).not.toHaveBeenCalled();
  });
});

describe('PaymentsService — unconfigured Stripe', () => {
  it('refuses to create a checkout session when Stripe is not configured', async () => {
    const configService = { get: () => undefined };
    const stripeService = new StripeService(configService as any);
    const service = new PaymentsService(
      stripeService,
      {} as any,
      {} as any,
      {} as any,
      { findActiveCountryPolicy: jest.fn().mockResolvedValue(null) } as any,
    );

    await expect(
      service.createCheckoutSession('customer-1', 'order-1'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
