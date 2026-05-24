import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { Public } from '../../common/security/decorators/public.decorator';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import {
  PublicStoreListResponseDto,
  PublicStoreResponseDto,
} from './dto/public-store-response.dto';
import { ListPublicStoresDto } from './dto/list-public-stores.dto';
import { PublicDiscoveryMetadataResponseDto } from './dto/public-discovery-metadata.dto';
import { StoresService } from './stores.service';

@Controller('stores')
@AuthTypes('tenant')
@ApiTags('tenant-stores')
@ApiBearerAuth('bearer')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  @ApiOperation({ summary: 'Create a tenant-owned store.' })
  @ApiBody({ type: CreateStoreDto })
  @ApiCreatedResponse({ description: 'Creates a store owned by the authenticated tenant.' })
  @ApiUnauthorizedResponse({ description: 'Tenant bearer token is missing or invalid.' })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateStoreDto,
  ) {
    return this.storesService.create(request.user.id, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: 'List stores owned by the authenticated tenant.' })
  @ApiOkResponse({ description: 'Returns the tenant-owned store list used by the current frontend.' })
  @ApiUnauthorizedResponse({ description: 'Tenant bearer token is missing or invalid.' })
  listMine(@Req() request: AuthenticatedRequest) {
    return this.storesService.listForTenant(request.user.id);
  }

  @Get(':storeId')
  @ApiOperation({ summary: 'Get a tenant-owned store detail.' })
  @ApiOkResponse({ description: 'Returns the owned store detail for the tenant workspace.' })
  getOne(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.storesService.getOwnedStore(storeId, request.user.id);
  }

  @Patch(':storeId')
  @ApiOperation({ summary: 'Update a tenant-owned store.' })
  @ApiBody({ type: UpdateStoreDto })
  @ApiOkResponse({ description: 'Updates editable store fields for the authenticated tenant.' })
  update(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.storesService.update(storeId, request.user.id, dto);
  }
}

@Controller('public/stores')
@Public()
@ApiTags('public-stores')
export class PublicStoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  @ApiOperation({ summary: 'List publicly readable stores for customer discovery.' })
  @ApiOkResponse({
    type: PublicStoreListResponseDto,
    description:
      'Returns active stores visible to the current customer-facing discovery surface.',
  })
  list(@Query() query: ListPublicStoresDto) {
    return this.storesService.listPublic(query);
  }

  @Get('discovery-metadata')
  @ApiOperation({ summary: 'Get public discovery metadata for shop types, categories, and filters.' })
  @ApiOkResponse({
    type: PublicDiscoveryMetadataResponseDto,
    description: 'Returns metadata used by the public storefront filter rails.',
  })
  discoveryMetadata(@Query() query: ListPublicStoresDto) {
    return this.storesService.getDiscoveryMetadata(query);
  }

  @Get(':storeId')
  @ApiOperation({ summary: 'Get a public store detail.' })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  @ApiOkResponse({
    type: PublicStoreResponseDto,
    description: 'Returns the public store summary used by the customer menu page.',
  })
  async getOne(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
  ) {
    const store = await this.storesService.findPublicStore(storeId);

    if (!store) {
      throw new NotFoundException('Store could not be found.');
    }

    return store;
  }
}
