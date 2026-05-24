/**
 * Stripe payment configuration.
 *
 * Keys are intentionally optional at boot: the API must still start without
 * Stripe credentials (local dev, CI). PaymentsService degrades gracefully and
 * returns a clear 503 when a payment action is attempted while unconfigured.
 */
export const stripeConfig = () => ({
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
    // Base URL of the customer web app — used to build Stripe Checkout
    // success/cancel return URLs.
    webAppBaseUrl: process.env.WEB_APP_BASE_URL ?? 'http://localhost:3000',
  },
});
