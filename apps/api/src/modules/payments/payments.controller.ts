import { Controller, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { PaymentSessionResponseDto } from './dto/payment-session-response.dto';
import { PaymentsService } from './payments.service';

@Controller('orders')
@AuthTypes('customer')
@ApiTags('customer-payments')
@ApiBearerAuth('bearer')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(':orderId/payment/session')
  @ApiOperation({
    summary:
      'Create (or reuse) a Stripe Checkout session for a customer-owned pending-payment order.',
  })
  @ApiParam({ name: 'orderId', description: 'Order identifier.' })
  @ApiOkResponse({
    type: PaymentSessionResponseDto,
    description: 'Returns the Stripe-hosted checkout URL to redirect to.',
  })
  @ApiConflictResponse({
    description: 'Order is no longer awaiting payment.',
  })
  @ApiServiceUnavailableResponse({
    description: 'Stripe is not configured on this environment.',
  })
  @ApiUnauthorizedResponse({
    description: 'Customer bearer token is missing or invalid.',
  })
  createSession(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    return this.paymentsService.createCheckoutSession(request.user.id, orderId);
  }
}
