import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { Public } from '../../common/security/decorators/public.decorator';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { CuisinesService } from './cuisines.service';
import { ReplaceStoreCuisinesDto } from './dto/replace-store-cuisines.dto';

@Controller('public/cuisines')
@Public()
@ApiTags('public-cuisines')
export class PublicCuisinesController {
  constructor(private readonly cuisinesService: CuisinesService) {}

  @Get()
  @ApiOperation({ summary: 'List active cuisines used across the platform.' })
  @ApiOkResponse({ description: 'Returns the system-level cuisine catalog.' })
  async list() {
    return { cuisines: await this.cuisinesService.listActive() };
  }
}

@Controller('public/stores/:storeId/cuisines')
@Public()
@ApiTags('public-store-cuisines')
export class PublicStoreCuisinesController {
  constructor(private readonly cuisinesService: CuisinesService) {}

  @Get()
  @ApiOperation({ summary: 'List cuisines assigned to a public store.' })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  async list(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
  ) {
    return {
      cuisines: await this.cuisinesService.listForStorePublic(storeId),
    };
  }
}

@Controller('tenant/stores/:storeId/cuisines')
@AuthTypes('tenant')
@ApiTags('tenant-store-cuisines')
@ApiBearerAuth('bearer')
export class TenantStoreCuisinesController {
  constructor(private readonly cuisinesService: CuisinesService) {}

  @Get()
  @ApiOperation({ summary: 'List cuisines assigned to an owned store.' })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  @ApiOkResponse({ description: 'Returns cuisines tied to the tenant-owned store.' })
  @ApiUnauthorizedResponse({ description: 'Tenant bearer token is missing or invalid.' })
  async list(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      cuisines: await this.cuisinesService.listForStoreTenant(
        storeId,
        request.user.id,
      ),
    };
  }

  @Put()
  @ApiOperation({ summary: 'Replace cuisines associated with an owned store.' })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  @ApiBody({ type: ReplaceStoreCuisinesDto })
  @ApiOkResponse({ description: 'Returns the new cuisine list after replacement.' })
  async replace(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: ReplaceStoreCuisinesDto,
  ) {
    return this.cuisinesService.replaceStoreCuisines(
      storeId,
      request.user.id,
      dto,
    );
  }
}
