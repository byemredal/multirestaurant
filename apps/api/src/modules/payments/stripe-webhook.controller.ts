import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../common/security/decorators/public.decorator';
import { PaymentsService } from './payments.service';

/**
 * Stripe webhook ingress.
 *
 * Public (no bearer auth) — authenticity is established by Stripe signature
 * verification against the raw request body, not by a session token. The raw
 * body buffer is available because `main.ts` boots Nest with `rawBody: true`.
 */
@Controller('payments')
export class StripeWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!request.rawBody) {
      throw new BadRequestException('Missing raw request body.');
    }
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header.');
    }
    return this.paymentsService.handleWebhookEvent(request.rawBody, signature);
  }
}
