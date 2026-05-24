import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req } from '@nestjs/common';
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
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { CreateMenuOptionGroupDto } from './dto/create-menu-option-group.dto';
import { CreateMenuOptionItemDto } from './dto/create-menu-option-item.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { UpdateMenuOptionGroupDto } from './dto/update-menu-option-group.dto';
import { UpdateMenuOptionItemDto } from './dto/update-menu-option-item.dto';
import {
  PublicMenuCategoriesResponseDto,
  PublicMenuItemResponseDto,
  PublicMenuItemsResponseDto,
} from './dto/public-menu-response.dto';
import { MenuService } from './menu.service';

@Controller('stores/:storeId/menu')
@AuthTypes('tenant')
@ApiTags('tenant-menu')
@ApiBearerAuth('bearer')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Post('categories')
  @ApiOperation({ summary: 'Create a menu category for a tenant-owned store.' })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  @ApiBody({ type: CreateMenuCategoryDto })
  @ApiCreatedResponse({ description: 'Creates a menu category.' })
  @ApiUnauthorizedResponse({ description: 'Tenant bearer token is missing or invalid.' })
  createCategory(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateMenuCategoryDto,
  ) {
    return this.menuService.createCategory(storeId, request.user.id, dto);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List menu categories for a tenant-owned store.' })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  @ApiOkResponse({ description: 'Returns menu categories visible in the tenant menu workspace.' })
  @ApiUnauthorizedResponse({ description: 'Tenant bearer token is missing or invalid.' })
  listCategories(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.menuService.listCategories(storeId, request.user.id);
  }

  @Patch('categories/:categoryId')
  @ApiOperation({ summary: 'Update a menu category for a tenant-owned store.' })
  @ApiOkResponse({ description: 'Returns the updated menu category.' })
  updateCategory(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Param('categoryId', new ParseUUIDPipe({ version: '4' })) categoryId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateMenuCategoryDto,
  ) {
    return this.menuService.updateCategory(
      storeId,
      categoryId,
      request.user.id,
      dto,
    );
  }

  @Put('categories/reorder')
  @ApiOperation({ summary: 'Reorder menu categories by submitting an explicit ID order.' })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        orderedCategoryIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
        },
      },
      required: ['orderedCategoryIds'],
    },
  })
  @ApiOkResponse({ description: 'Returns the categories in their new sort order.' })
  reorderCategories(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: { orderedCategoryIds: string[] },
  ) {
    return this.menuService.reorderCategories(
      storeId,
      request.user.id,
      body.orderedCategoryIds ?? [],
    );
  }

  @Post('items')
  @ApiOperation({ summary: 'Create a menu item for a tenant-owned store.' })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  @ApiBody({ type: CreateMenuItemDto })
  @ApiCreatedResponse({ description: 'Creates a menu item.' })
  @ApiUnauthorizedResponse({ description: 'Tenant bearer token is missing or invalid.' })
  createItem(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateMenuItemDto,
  ) {
    return this.menuService.createItem(storeId, request.user.id, dto);
  }

  @Get('items')
  @ApiOperation({ summary: 'List menu items for a tenant-owned store.' })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  @ApiOkResponse({ description: 'Returns menu items visible in the tenant menu workspace.' })
  @ApiUnauthorizedResponse({ description: 'Tenant bearer token is missing or invalid.' })
  listItems(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.menuService.listItems(storeId, request.user.id);
  }

  @Patch('items/:itemId')
  @ApiOperation({ summary: 'Update a menu item for a tenant-owned store.' })
  @ApiOkResponse({ description: 'Returns the updated menu item with its option-group structure.' })
  updateItem(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menuService.updateItem(storeId, itemId, request.user.id, dto);
  }

  @Get('items/:itemId')
  @ApiOperation({ summary: 'Get a tenant menu item detail.' })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  @ApiParam({ name: 'itemId', description: 'Menu item identifier.' })
  @ApiOkResponse({ description: 'Returns a menu item with its option-group structure.' })
  @ApiUnauthorizedResponse({ description: 'Tenant bearer token is missing or invalid.' })
  getItem(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.menuService.getItem(storeId, itemId, request.user.id);
  }

  @Post('items/:itemId/option-groups')
  @ApiOperation({ summary: 'Create an option group for a menu item.' })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  @ApiParam({ name: 'itemId', description: 'Menu item identifier.' })
  @ApiBody({ type: CreateMenuOptionGroupDto })
  @ApiCreatedResponse({ description: 'Creates a menu option group.' })
  @ApiUnauthorizedResponse({ description: 'Tenant bearer token is missing or invalid.' })
  createOptionGroup(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateMenuOptionGroupDto,
  ) {
    return this.menuService.createOptionGroup(
      storeId,
      itemId,
      request.user.id,
      dto,
    );
  }

  @Get('items/:itemId/option-groups')
  @ApiOperation({ summary: 'List option groups for a menu item.' })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  @ApiParam({ name: 'itemId', description: 'Menu item identifier.' })
  @ApiOkResponse({ description: 'Returns menu option groups for the selected item.' })
  @ApiUnauthorizedResponse({ description: 'Tenant bearer token is missing or invalid.' })
  listOptionGroups(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.menuService.listOptionGroups(storeId, itemId, request.user.id);
  }

  @Patch('items/:itemId/option-groups/:groupId')
  @ApiOperation({ summary: 'Update an option group for a menu item.' })
  @ApiOkResponse({ description: 'Returns the updated option group.' })
  updateOptionGroup(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Param('groupId', new ParseUUIDPipe({ version: '4' })) groupId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateMenuOptionGroupDto,
  ) {
    return this.menuService.updateOptionGroup(
      storeId,
      itemId,
      groupId,
      request.user.id,
      dto,
    );
  }

  @Post('items/:itemId/option-groups/:groupId/options')
  @ApiOperation({ summary: 'Create an option item inside an option group.' })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  @ApiParam({ name: 'itemId', description: 'Menu item identifier.' })
  @ApiParam({ name: 'groupId', description: 'Option group identifier.' })
  @ApiBody({ type: CreateMenuOptionItemDto })
  @ApiCreatedResponse({ description: 'Creates a menu option item.' })
  @ApiUnauthorizedResponse({ description: 'Tenant bearer token is missing or invalid.' })
  createOptionItem(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Param('groupId', new ParseUUIDPipe({ version: '4' })) groupId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateMenuOptionItemDto,
  ) {
    return this.menuService.createOptionItem(
      storeId,
      itemId,
      groupId,
      request.user.id,
      dto,
    );
  }

  @Get('items/:itemId/option-groups/:groupId/options')
  @ApiOperation({ summary: 'List option items for an option group.' })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  @ApiParam({ name: 'itemId', description: 'Menu item identifier.' })
  @ApiParam({ name: 'groupId', description: 'Option group identifier.' })
  @ApiOkResponse({ description: 'Returns menu option items for the selected option group.' })
  @ApiUnauthorizedResponse({ description: 'Tenant bearer token is missing or invalid.' })
  listOptionItems(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Param('groupId', new ParseUUIDPipe({ version: '4' })) groupId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.menuService.listOptionItems(
      storeId,
      itemId,
      groupId,
      request.user.id,
    );
  }

  @Patch('items/:itemId/option-groups/:groupId/options/:optionId')
  @ApiOperation({ summary: 'Update an option item inside an option group.' })
  @ApiOkResponse({ description: 'Returns the updated option item.' })
  updateOptionItem(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Param('groupId', new ParseUUIDPipe({ version: '4' })) groupId: string,
    @Param('optionId', new ParseUUIDPipe({ version: '4' })) optionId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateMenuOptionItemDto,
  ) {
    return this.menuService.updateOptionItem(
      storeId,
      itemId,
      groupId,
      optionId,
      request.user.id,
      dto,
    );
  }
}

@Controller('public/stores/:storeId/menu')
@Public()
@ApiTags('public-menu')
export class PublicMenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('categories')
  @ApiOperation({ summary: 'List public menu categories for a store.' })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  @ApiOkResponse({
    type: PublicMenuCategoriesResponseDto,
    description: 'Returns active menu categories visible to customers.',
  })
  listCategories(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
  ) {
    return this.menuService.listPublicCategories(storeId);
  }

  @Get('items')
  @ApiOperation({ summary: 'List public menu items for a store.' })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  @ApiOkResponse({
    type: PublicMenuItemsResponseDto,
    description: 'Returns active menu items visible to customers.',
  })
  listItems(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
  ) {
    return this.menuService.listPublicItems(storeId);
  }

  @Get('popular')
  @ApiOperation({
    summary:
      'List dynamically-computed most-ordered menu items for a store (Popüler rail).',
  })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  @ApiOkResponse({ description: 'Returns the top-ordered active menu items.' })
  listPopular(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number(limit) : undefined;
    const safe = Number.isFinite(parsed) && parsed && parsed > 0 ? parsed : undefined;
    return this.menuService.listPopularPublicItems(storeId, safe ?? 8);
  }

  @Get('items/:itemId')
  @ApiOperation({ summary: 'Get a public menu item detail.' })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  @ApiParam({ name: 'itemId', description: 'Menu item identifier.' })
  @ApiOkResponse({
    type: PublicMenuItemResponseDto,
    description: 'Returns a public menu item with active option-group structure.',
  })
  getItem(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
  ) {
    return this.menuService.getPublicItem(storeId, itemId);
  }
}
