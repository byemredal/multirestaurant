import { Body, Controller, Post, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { RateLimit } from '../../common/security/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/security/guards/rate-limit.guard';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { CreateTestOrderDto } from './dto/create-test-order.dto';
import { OrdersService } from './orders.service';

/**
 * Operational tooling endpoint — tenant'ın realtime/dashboard/metrics
 * zincirini gerçek bir sipariş üzerinden test edebilmesi için.
 * Bu bir public customer feature değildir; sadece tenant auth'lu
 * çağrılır ve sahip olunan store'a yazar.
 */
@Controller('tenant/test-orders')
@AuthTypes('tenant')
@ApiTags('tenant-orders')
@ApiBearerAuth('bearer')
export class TenantTestOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: 'tenant-test-order', limit: 10, ttlMs: 60_000 })
  @ApiOperation({
    summary:
      'Tenant tarafından operasyonel test için gerçek sipariş yarat (lazy "test customer" üzerinden).',
  })
  @ApiBody({ type: CreateTestOrderDto })
  @ApiCreatedResponse({
    description: 'Gerçek Order kaydı yaratılır; realtime stream üzerinden tenant\'a düşer.',
  })
  @ApiUnauthorizedResponse({ description: 'Tenant bearer token eksik veya geçersiz.' })
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateTestOrderDto) {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('Test order tooling is disabled in production.');
    }
    return this.ordersService.createTestOrderForTenant(request.user.id, dto);
  }
}
