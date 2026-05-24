import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * Thin wrapper around the Stripe SDK.
 *
 * The client is created lazily so the API still boots without Stripe
 * credentials. Any payment action attempted while unconfigured fails fast
 * with a 503 instead of a confusing low-level error.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private client: Stripe | null = null;

  constructor(private readonly configService: ConfigService) {}

  private get secretKey(): string {
    return this.configService.get<string>('stripe.secretKey') ?? '';
  }

  get webhookSecret(): string {
    return this.configService.get<string>('stripe.webhookSecret') ?? '';
  }

  get webAppBaseUrl(): string {
    return (
      this.configService.get<string>('stripe.webAppBaseUrl') ??
      'http://localhost:3000'
    );
  }

  /** True when a secret key is present — payment actions can be attempted. */
  isConfigured(): boolean {
    return this.secretKey.length > 0;
  }

  /** Returns the Stripe client, or throws 503 when not configured. */
  getClient(): Stripe {
    if (!this.secretKey) {
      throw new ServiceUnavailableException(
        'Payments are not available: Stripe is not configured.',
      );
    }
    if (!this.client) {
      this.client = new Stripe(this.secretKey);
      this.logger.log('Stripe client initialized.');
    }
    return this.client;
  }

  /**
   * Verify a webhook payload signature and return the parsed event.
   * Throws on a missing secret or an invalid signature — the caller maps
   * those to a 4xx so a forged or misconfigured webhook is rejected.
   */
  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    if (!this.webhookSecret) {
      throw new ServiceUnavailableException(
        'Stripe webhook secret is not configured.',
      );
    }
    return this.getClient().webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );
  }
}
