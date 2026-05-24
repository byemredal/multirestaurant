import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { ListTenantOrdersDto } from './dto/list-tenant-orders.dto';
import { UpdateTenantOrderStatusDto } from './dto/update-tenant-order-status.dto';
import { OrdersService } from './orders.service';

@Controller('tenant/orders')
@AuthTypes('tenant')
@ApiTags('tenant-orders')
@ApiBearerAuth('bearer')
export class TenantOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List orders visible to the authenticated tenant.' })
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: ['operational', 'history'],
    description:
      'Defaults to operational. "history" returns closed orders. Ignored when status is set.',
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
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'Optional owned store filter.',
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
  @ApiOkResponse({ description: 'Returns tenant-visible orders for owned stores.' })
  @ApiUnauthorizedResponse({ description: 'Tenant bearer token is missing or invalid.' })
  listOrders(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListTenantOrdersDto,
  ) {
    return this.ordersService.listForTenant(request.user.id, query);
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Get a tenant-visible order detail.' })
  @ApiParam({ name: 'orderId', description: 'Order identifier.' })
  @ApiOkResponse({ description: 'Returns a tenant order detail for an owned store order.' })
  @ApiUnauthorizedResponse({ description: 'Tenant bearer token is missing or invalid.' })
  getOrder(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    return this.ordersService.getOrderForTenant(request.user.id, orderId);
  }

  @Patch(':orderId/status')
  @ApiOperation({ summary: 'Update an owned order status from the tenant side.' })
  @ApiParam({ name: 'orderId', description: 'Order identifier.' })
  @ApiBody({ type: UpdateTenantOrderStatusDto })
  @ApiOkResponse({
    description: 'Tenant order status updates are validated against the backend transition matrix.',
  })
  @ApiUnauthorizedResponse({ description: 'Tenant bearer token is missing or invalid.' })
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: UpdateTenantOrderStatusDto,
  ) {
    return this.ordersService.updateStatusForTenant(request.user.id, orderId, dto);
  }
}
