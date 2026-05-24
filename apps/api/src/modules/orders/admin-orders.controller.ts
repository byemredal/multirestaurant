import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { ListAdminOrdersDto } from './dto/list-admin-orders.dto';
import { OrdersService } from './orders.service';

/**
 * Read-only platform-wide order visibility for the admin console.
 * Intentionally has no mutation endpoints — operational order actions
 * stay with the owning tenant.
 */
@Controller('admin/orders')
@AuthTypes('admin')
@ApiTags('admin-operations')
@ApiBearerAuth('bearer')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({
    summary: 'List every order across the platform (read-only admin oversight).',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'pending_payment',
      'payment_processing',
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
  @ApiQuery({ name: 'storeId', required: false, description: 'Optional store filter.' })
  @ApiQuery({ name: 'createdFrom', required: false })
  @ApiQuery({ name: 'createdTo', required: false })
  @ApiOkResponse({ description: 'Returns platform-wide orders, newest first.' })
  @ApiUnauthorizedResponse({ description: 'Admin bearer token is missing or invalid.' })
  listOrders(@Query() query: ListAdminOrdersDto) {
    return this.ordersService.listForAdmin(query);
  }
}
