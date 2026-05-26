import { Module } from '@nestjs/common';
import { LegalConsentModule } from '../legal-consent/legal-consent.module';
import { OrdersModule } from '../orders/orders.module';
import { SetupModule } from '../setup/setup.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsStore } from './payments.store';
import { StripeService } from './stripe.service';
import { StripeWebhookController } from './stripe-webhook.controller';

@Module({
  imports: [OrdersModule, LegalConsentModule, SetupModule],
  controllers: [PaymentsController, StripeWebhookController],
  providers: [PaymentsService, StripeService, PaymentsStore],
})
export class PaymentsModule {}
