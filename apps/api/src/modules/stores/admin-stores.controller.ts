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
import { ListAdminStoresDto } from './dto/list-admin-stores.dto';
import { StoresService } from './stores.service';

/**
 * Read-only platform-wide store visibility for the admin console.
 * Store mutations stay with the owning tenant; this surface is oversight only.
 */
@Controller('admin/stores')
@AuthTypes('admin')
@ApiTags('admin-operations')
@ApiBearerAuth('bearer')
export class AdminStoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  @ApiOperation({
    summary: 'List every store across the platform (read-only admin oversight).',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['draft', 'active', 'inactive'],
  })
  @ApiOkResponse({ description: 'Returns platform-wide stores, newest first.' })
  @ApiUnauthorizedResponse({ description: 'Admin bearer token is missing or invalid.' })
  listStores(@Query() query: ListAdminStoresDto) {
    return this.storesService.listForAdmin(query.status);
  }
}
