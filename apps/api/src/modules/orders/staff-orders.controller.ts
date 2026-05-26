import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { ListStaffOrdersDto } from './dto/list-staff-orders.dto';
import { OrdersService } from './orders.service';

/**
 * Staff-scoped order list. The handler delegates store-scope enforcement
 * to `OrdersService.listForStaff`, which reads the live scope put on
 * `request.user.staffStoreScope` by AccessTokenGuard (derived server-side
 * from active StaffMembership rows). Client-supplied store IDs are
 * validated against that scope before any DB query runs.
 */
@Controller('staff/orders')
@AuthTypes('staff')
@ApiTags('staff-orders')
@ApiBearerAuth('bearer')
export class StaffOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({
    summary: 'List orders visible to the authenticated staff session.',
  })
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
    description: 'Optional store filter. Must be in the assigned staff scope.',
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
    description: 'Returns orders for stores assigned to this staff session.',
  })
  @ApiForbiddenResponse({
    description:
      'Staff session has no assigned stores, or the storeId filter is outside the assigned scope.',
  })
  @ApiUnauthorizedResponse({ description: 'Staff bearer token is missing or invalid.' })
  listOrders(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListStaffOrdersDto,
  ) {
    const scope = request.user.staffStoreScope ?? [];
    return this.ordersService.listForStaff(scope, query);
  }
}
