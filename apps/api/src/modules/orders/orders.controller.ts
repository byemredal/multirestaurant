import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import {
  CheckoutReadinessResponseDto,
  CustomerOrderEnvelopeResponseDto,
  CustomerOrderListResponseDto,
  OrderValidationResponseDto,
} from './dto/customer-order-response.dto';
import { CancelCustomerOrderDto } from './dto/cancel-customer-order.dto';
import { CreateCustomerOrderDto } from './dto/create-customer-order.dto';
import { ListCustomerOrdersDto } from './dto/list-customer-orders.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@AuthTypes('customer')
@ApiTags('customer-orders')
@ApiBearerAuth('bearer')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create an order from the authenticated customer active cart.' })
  @ApiOkResponse({
    type: CustomerOrderEnvelopeResponseDto,
    description: 'Creates an order snapshot from the current cart after revalidation.',
  })
  @ApiConflictResponse({
    description: 'Cart validation failed because the current cart became stale or invalid.',
  })
  @ApiUnauthorizedResponse({ description: 'Customer bearer token is missing or invalid.' })
  createOrder(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateCustomerOrderDto,
  ) {
    return this.ordersService.createFromActiveCart(request.user.id, dto);
  }

  @Post('checkout-readiness')
  @ApiOperation({ summary: 'Evaluate whether the authenticated customer cart is ready for checkout.' })
  @ApiOkResponse({
    type: CheckoutReadinessResponseDto,
    description: 'Returns structured checkout readiness, totals, and any blocking reasons.',
  })
  @ApiUnauthorizedResponse({ description: 'Customer bearer token is missing or invalid.' })
  checkoutReadiness(@Req() request: AuthenticatedRequest): Promise<any> {
    return this.ordersService.getCheckoutReadiness(request.user.id);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate the authenticated customer active cart before order creation.' })
  @ApiOkResponse({
    type: OrderValidationResponseDto,
    description: 'Returns the current cart validation result used before order creation.',
  })
  @ApiUnauthorizedResponse({ description: 'Customer bearer token is missing or invalid.' })
  validateOrder(@Req() request: AuthenticatedRequest): Promise<any> {
    return this.ordersService.validateActiveCart(request.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List customer orders for the authenticated customer.' })
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: ['active', 'history', 'all'],
    description:
      'Optional order scope. Defaults to active when no explicit status filter is provided.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'pending_payment',
      'payment_failed',
      'pending_confirmation',
      'confirmed',
      'preparing',
      'ready',
      'completed',
      'rejected',
      'cancelled',
    ],
    description: 'Optional exact status filter. Overrides the default scope behavior.',
  })
  @ApiQuery({
    name: 'createdFrom',
    required: false,
    description: 'Optional inclusive order creation lower bound in ISO-8601 format.',
  })
  @ApiQuery({
    name: 'createdTo',
    required: false,
    description: 'Optional inclusive order creation upper bound in ISO-8601 format.',
  })
  @ApiOkResponse({
    type: CustomerOrderListResponseDto,
    description:
      'Returns customer-visible orders with active/history-aware filtering and tracking metadata.',
  })
  @ApiUnauthorizedResponse({ description: 'Customer bearer token is missing or invalid.' })
  listOrders(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListCustomerOrdersDto,
  ) {
    return this.ordersService.listForCustomer(request.user.id, query);
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Get a customer-visible order detail.' })
  @ApiParam({ name: 'orderId', description: 'Order identifier.' })
  @ApiOkResponse({ description: 'Returns the selected customer order detail and status snapshot.' })
  @ApiUnauthorizedResponse({ description: 'Customer bearer token is missing or invalid.' })
  getOrder(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    return this.ordersService.getOrder(request.user.id, orderId);
  }

  @Patch(':orderId/cancel')
  @ApiOperation({ summary: 'Cancel a customer-owned order when it is still customer-cancellable.' })
  @ApiParam({ name: 'orderId', description: 'Order identifier.' })
  @ApiOkResponse({
    type: CustomerOrderEnvelopeResponseDto,
    description: 'Cancels the selected customer-owned order and returns the updated order detail.',
  })
  @ApiConflictResponse({
    description: 'Order is not currently in a customer-cancellable state.',
  })
  @ApiNotFoundResponse({ description: 'Order could not be found for this customer.' })
  @ApiUnauthorizedResponse({ description: 'Customer bearer token is missing or invalid.' })
  cancelOrder(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: CancelCustomerOrderDto,
  ) {
    return this.ordersService.cancelOrder(request.user.id, orderId, dto);
  }
}
