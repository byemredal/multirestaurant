import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { StoresService } from '../stores/stores.service';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { CreateMenuOptionGroupDto } from './dto/create-menu-option-group.dto';
import { CreateMenuOptionItemDto } from './dto/create-menu-option-item.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { UpdateMenuOptionGroupDto } from './dto/update-menu-option-group.dto';
import { UpdateMenuOptionItemDto } from './dto/update-menu-option-item.dto';
import { MenuCategory } from './entities/menu-category.entity';
import { MenuItem, MenuItemAvailabilityType } from './entities/menu-item.entity';
import { MenuOptionGroup } from './entities/menu-option-group.entity';
import { MenuOptionItem } from './entities/menu-option-item.entity';

@Injectable()
export class MenuService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storesService: StoresService,
  ) {}

  async createCategory(
    storeId: string,
    ownerTenantId: string,
    dto: CreateMenuCategoryDto,
  ) {
    await this.ensureOwnedStore(storeId, ownerTenantId);

    const now = new Date();
    const category: MenuCategory = {
      id: randomUUID(),
      storeId,
      name: dto.name,
      description: dto.description?.trim() || null,
      imageUrl: dto.imageUrl?.trim() || null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    await this.databaseService
      .prepare(
        `INSERT INTO "MenuCategory" (
          "id", "storeId", "name", "description", "imageUrl", "sortOrder",
          "isActive", "createdAt", "updatedAt"
        ) VALUES (
          $id, $storeId, $name, $description, $imageUrl, $sortOrder,
          $isActive, $createdAt, $updatedAt
        )`,
      )
      .run({
        $id: category.id,
        $storeId: category.storeId,
        $name: category.name,
        $description: category.description,
        $imageUrl: category.imageUrl,
        $sortOrder: category.sortOrder,
        $isActive: category.isActive,
        $createdAt: category.createdAt.toISOString(),
        $updatedAt: category.updatedAt.toISOString(),
      });

    return { category };
  }

  async listCategories(storeId: string, ownerTenantId: string) {
    await this.ensureOwnedStore(storeId, ownerTenantId);

    const categories = (await this.databaseService
      .prepare(
        `SELECT *
         FROM "MenuCategory"
         WHERE "storeId" = $storeId
         ORDER BY "sortOrder" ASC, "createdAt" ASC`,
      )
      .all({ $storeId: storeId })) as unknown as MenuCategoryRow[];

    return categories.map((category) => this.mapCategory(category));
  }

  async updateCategory(
    storeId: string,
    categoryId: string,
    ownerTenantId: string,
    dto: UpdateMenuCategoryDto,
  ) {
    await this.ensureOwnedStore(storeId, ownerTenantId);
    const category = await this.findStoreCategoryOrThrow(storeId, categoryId);
    const updatedAt = new Date();

    await this.databaseService
      .prepare(
        `UPDATE "MenuCategory"
         SET "name" = $name,
             "description" = $description,
             "imageUrl" = $imageUrl,
             "sortOrder" = $sortOrder,
             "isActive" = $isActive,
             "updatedAt" = $updatedAt
         WHERE "id" = $id`,
      )
      .run({
        $id: categoryId,
        $name: dto.name?.trim() || category.name,
        $description:
          dto.description === undefined
            ? category.description
            : dto.description.trim() || null,
        $imageUrl:
          dto.imageUrl === undefined ? category.imageUrl : dto.imageUrl.trim() || null,
        $sortOrder: dto.sortOrder ?? category.sortOrder,
        $isActive: dto.isActive ?? category.isActive,
        $updatedAt: updatedAt.toISOString(),
      });

    return {
      category: await this.findStoreCategoryOrThrow(storeId, categoryId),
    };
  }

  async createItem(storeId: string, ownerTenantId: string, dto: CreateMenuItemDto) {
    await this.ensureOwnedStore(storeId, ownerTenantId);

    if (dto.categoryId) {
      await this.findStoreCategoryOrThrow(storeId, dto.categoryId);
    }

    const now = new Date();
    const item: MenuItem = {
      id: randomUUID(),
      storeId,
      categoryId: dto.categoryId ?? null,
      name: dto.name,
      description: dto.description?.trim() || null,
      imageUrl: dto.imageUrl?.trim() || null,
      basePrice: dto.basePrice,
      currencyId: dto.currencyId,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
      availabilityType:
        dto.availabilityType ?? MenuItemAvailabilityType.ALWAYS,
      createdAt: now,
      updatedAt: now,
    };

    await this.databaseService
      .prepare(
        `INSERT INTO "MenuItem" (
          "id", "storeId", "categoryId", "name", "description", "imageUrl",
          "basePrice", "currencyId", "sortOrder", "isActive", "availabilityType",
          "createdAt", "updatedAt"
        ) VALUES (
          $id, $storeId, $categoryId, $name, $description, $imageUrl,
          $basePrice, $currencyId, $sortOrder, $isActive, $availabilityType,
          $createdAt, $updatedAt
        )`,
      )
      .run({
        $id: item.id,
        $storeId: item.storeId,
        $categoryId: item.categoryId,
        $name: item.name,
        $description: item.description,
        $imageUrl: item.imageUrl,
        $basePrice: item.basePrice,
        $currencyId: item.currencyId,
        $sortOrder: item.sortOrder,
        $isActive: item.isActive,
        $availabilityType: item.availabilityType,
        $createdAt: item.createdAt.toISOString(),
        $updatedAt: item.updatedAt.toISOString(),
      });

    return { item: await this.findStoreMenuItemOrThrow(storeId, item.id) };
  }

  async updateItem(
    storeId: string,
    itemId: string,
    ownerTenantId: string,
    dto: UpdateMenuItemDto,
  ) {
    await this.ensureOwnedStore(storeId, ownerTenantId);
    const item = await this.findStoreMenuItemOrThrow(storeId, itemId);

    if (dto.categoryId) {
      await this.findStoreCategoryOrThrow(storeId, dto.categoryId);
    }

    const updatedAt = new Date();
    await this.databaseService
      .prepare(
        `UPDATE "MenuItem"
         SET "categoryId" = $categoryId,
             "name" = $name,
             "description" = $description,
             "imageUrl" = $imageUrl,
             "basePrice" = $basePrice,
             "currencyId" = $currencyId,
             "sortOrder" = $sortOrder,
             "isActive" = $isActive,
             "availabilityType" = $availabilityType,
             "updatedAt" = $updatedAt
         WHERE "id" = $id`,
      )
      .run({
        $id: itemId,
        $categoryId:
          dto.categoryId === undefined ? item.categoryId : dto.categoryId || null,
        $name: dto.name?.trim() || item.name,
        $description:
          dto.description === undefined
            ? item.description
            : dto.description.trim() || null,
        $imageUrl:
          dto.imageUrl === undefined ? item.imageUrl : dto.imageUrl.trim() || null,
        $basePrice: dto.basePrice ?? item.basePrice,
        $currencyId: dto.currencyId ?? item.currencyId,
        $sortOrder: dto.sortOrder ?? item.sortOrder,
        $isActive: dto.isActive ?? item.isActive,
        $availabilityType: dto.availabilityType ?? item.availabilityType,
        $updatedAt: updatedAt.toISOString(),
      });

    return {
      item: await this.buildTenantItemDetail(
        await this.findStoreMenuItemOrThrow(storeId, itemId),
      ),
    };
  }

  async listItems(storeId: string, ownerTenantId: string) {
    await this.ensureOwnedStore(storeId, ownerTenantId);

    const items = (await this.databaseService
      .prepare(
        `SELECT mi.*, mc."name" AS "categoryName",
                c."code" AS "currencyCode", c."symbol" AS "currencySymbol"
         FROM "MenuItem" mi
         LEFT JOIN "MenuCategory" mc ON mc."id" = mi."categoryId"
         INNER JOIN "Currency" c ON c."id" = mi."currencyId"
         WHERE mi."storeId" = $storeId
         ORDER BY mi."sortOrder" ASC, mi."createdAt" DESC`,
      )
      .all({ $storeId: storeId })) as unknown as MenuItemListRow[];

    return items.map((item) => ({
      ...this.mapItem(item),
      categoryName: item.categoryName ?? null,
    }));
  }

  async getItem(storeId: string, itemId: string, ownerTenantId: string) {
    await this.ensureOwnedStore(storeId, ownerTenantId);
    const item = await this.findStoreMenuItemOrThrow(storeId, itemId);

    return {
      item: await this.buildTenantItemDetail(item),
    };
  }

  async listPublicCategories(storeId: string) {
    await this.ensureStorePublicOrThrow(storeId);

    const categories = (await this.databaseService
      .prepare(
        `SELECT *
         FROM "MenuCategory"
         WHERE "storeId" = $storeId AND "isActive" = TRUE
         ORDER BY "sortOrder" ASC, "createdAt" ASC`,
      )
      .all({ $storeId: storeId })) as unknown as MenuCategoryRow[];

    const popularCount = await this.databaseService
      .prepare(
        `SELECT COUNT(DISTINCT oi."menuItemId") AS "popularCount"
         FROM "OrderItem" oi
         INNER JOIN "Order" o ON o."id" = oi."orderId"
         INNER JOIN "MenuItem" mi ON mi."id" = oi."menuItemId"
         WHERE o."storeId" = $storeId
           AND o."status" IN ('completed', 'ready', 'preparing', 'confirmed')
           AND o."createdAt" >= NOW() - INTERVAL '90 days'
           AND mi."isActive" = TRUE`,
      )
      .get<{ popularCount: number }>({ $storeId: storeId });

    const popularItemCount = Number(popularCount?.popularCount ?? 0);
    const synthesizedCategories = popularItemCount >= 3
      ? [
          {
            id: this.popularCategoryId,
            storeId,
            name: 'Popüler',
            description: 'En çok sipariş edilen ürünler',
            imageUrl: null,
            sortOrder: -1,
            isActive: true,
            isVirtual: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          ...categories.map((category) => ({
            ...this.mapCategory(category),
            isVirtual: false as const,
          })),
        ]
      : categories.map((category) => ({
          ...this.mapCategory(category),
          isVirtual: false as const,
        }));

    return {
      categories: synthesizedCategories,
    };
  }

  /**
   * Synthetic category ID for the "Popüler" rail.
   * Surfaced in listPublicCategories and resolved by listPopularPublicItems.
   */
  readonly popularCategoryId = 'popular';

  async listPopularPublicItems(storeId: string, limit = 8) {
    await this.ensureStorePublicOrThrow(storeId);

    const safeLimit = Math.min(Math.max(limit, 1), 24);

    const rows = (await this.databaseService
      .prepare(
        `SELECT mi.*, mc."name" AS "categoryName",
                c."code" AS "currencyCode", c."symbol" AS "currencySymbol",
                SUM(oi."quantity")::int AS "orderedQuantity",
                COUNT(DISTINCT o."id")::int AS "orderCount"
         FROM "OrderItem" oi
         INNER JOIN "Order" o ON o."id" = oi."orderId"
         INNER JOIN "MenuItem" mi ON mi."id" = oi."menuItemId"
         INNER JOIN "Currency" c ON c."id" = mi."currencyId"
         LEFT JOIN "MenuCategory" mc
           ON mc."id" = mi."categoryId"
          AND mc."isActive" = TRUE
         WHERE o."storeId" = $storeId
           AND o."status" IN ('completed', 'ready', 'preparing', 'confirmed')
           AND o."createdAt" >= NOW() - INTERVAL '90 days'
           AND mi."isActive" = TRUE
           AND mi."availabilityType" IN ('always', 'inherit_store_status')
           AND (mi."categoryId" IS NULL OR mc."id" IS NOT NULL)
         GROUP BY mi."id", mc."name", c."code", c."symbol"
         ORDER BY "orderedQuantity" DESC NULLS LAST, "orderCount" DESC
         LIMIT $limit`,
      )
      .all({ $storeId: storeId, $limit: safeLimit })) as unknown as Array<
      MenuItemListRow & { orderedQuantity: number; orderCount: number }
    >;

    return {
      items: rows.map((row) => ({
        ...this.mapItem(row),
        categoryName: row.categoryName ?? null,
        orderedQuantity: Number(row.orderedQuantity ?? 0),
        orderCount: Number(row.orderCount ?? 0),
      })),
    };
  }

  async reorderCategories(
    storeId: string,
    ownerTenantId: string,
    orderedCategoryIds: string[],
  ) {
    await this.ensureOwnedStore(storeId, ownerTenantId);

    if (orderedCategoryIds.length === 0) {
      return { categories: await this.listCategories(storeId, ownerTenantId) };
    }

    const existing = (await this.databaseService
      .prepare(
        `SELECT "id" FROM "MenuCategory"
         WHERE "storeId" = $storeId AND "id" = ANY($ids::uuid[])`,
      )
      .all({
        $storeId: storeId,
        $ids: orderedCategoryIds,
      })) as Array<{ id: string }>;

    if (existing.length !== orderedCategoryIds.length) {
      throw new NotFoundException(
        'One or more categories could not be found for this store.',
      );
    }

    const updatedAt = new Date().toISOString();
    await this.databaseService.transaction(async () => {
      for (let index = 0; index < orderedCategoryIds.length; index += 1) {
        await this.databaseService
          .prepare(
            `UPDATE "MenuCategory"
             SET "sortOrder" = $sortOrder, "updatedAt" = $updatedAt
             WHERE "id" = $id AND "storeId" = $storeId`,
          )
          .run({
            $id: orderedCategoryIds[index],
            $storeId: storeId,
            $sortOrder: index,
            $updatedAt: updatedAt,
          });
      }
    });

    return {
      categories: await this.listCategories(storeId, ownerTenantId),
    };
  }

  async listPublicItems(storeId: string) {
    await this.ensureStorePublicOrThrow(storeId);

    const items = (await this.databaseService
      .prepare(
        `SELECT mi.*, mc."name" AS "categoryName",
                c."code" AS "currencyCode", c."symbol" AS "currencySymbol"
         FROM "MenuItem" mi
         INNER JOIN "Currency" c ON c."id" = mi."currencyId"
         LEFT JOIN "MenuCategory" mc
           ON mc."id" = mi."categoryId"
          AND mc."isActive" = TRUE
         WHERE mi."storeId" = $storeId
           AND mi."isActive" = TRUE
           AND mi."availabilityType" IN ('always', 'inherit_store_status')
           AND (mi."categoryId" IS NULL OR mc."id" IS NOT NULL)
         ORDER BY mi."sortOrder" ASC, mi."createdAt" DESC`,
      )
      .all({ $storeId: storeId })) as unknown as MenuItemListRow[];

    return {
      items: items.map((item) => ({
        ...this.mapItem(item),
        categoryName: item.categoryName ?? null,
      })),
    };
  }

  async getPublicItem(storeId: string, itemId: string) {
    await this.ensureStorePublicOrThrow(storeId);

    const item = (await this.databaseService
      .prepare(
        `SELECT mi.*,
                c."code" AS "currencyCode", c."symbol" AS "currencySymbol"
         FROM "MenuItem" mi
         INNER JOIN "Currency" c ON c."id" = mi."currencyId"
         LEFT JOIN "MenuCategory" mc
           ON mc."id" = mi."categoryId"
          AND mc."isActive" = TRUE
         WHERE mi."id" = $id
           AND mi."storeId" = $storeId
           AND mi."isActive" = TRUE
           AND mi."availabilityType" IN ('always', 'inherit_store_status')
           AND (mi."categoryId" IS NULL OR mc."id" IS NOT NULL)`,
      )
      .get({
        $id: itemId,
        $storeId: storeId,
      })) as MenuItemRow | undefined;

    if (!item) {
      throw new NotFoundException('Menu item could not be found for this store.');
    }

    const optionGroups = (await this.databaseService
      .prepare(
        `SELECT *
         FROM "MenuOptionGroup"
         WHERE "menuItemId" = $menuItemId AND "isActive" = TRUE
         ORDER BY "sortOrder" ASC, "createdAt" ASC`,
      )
      .all({ $menuItemId: itemId })) as unknown as MenuOptionGroupRow[];

    return {
      item: {
        ...this.mapItem(item),
        optionGroups: await Promise.all(
          optionGroups.map(async (group) => ({
            ...this.mapOptionGroup(group),
            options: (
              (await this.databaseService
                .prepare(
                  `SELECT *
                   FROM "MenuOptionItem"
                   WHERE "optionGroupId" = $optionGroupId AND "isActive" = TRUE
                   ORDER BY "sortOrder" ASC, "createdAt" ASC`,
                )
                .all({ $optionGroupId: group.id })) as unknown as MenuOptionItemRow[]
            ).map((option) => this.mapOptionItem(option)),
          })),
        ),
      },
    };
  }

  private async buildTenantItemDetail(item: MenuItemWithCurrency) {
    const optionGroups = (await this.databaseService
      .prepare(
        `SELECT *
         FROM "MenuOptionGroup"
         WHERE "menuItemId" = $menuItemId
         ORDER BY "sortOrder" ASC, "createdAt" ASC`,
      )
      .all({ $menuItemId: item.id })) as unknown as MenuOptionGroupRow[];

    return {
      ...item,
      optionGroups: await Promise.all(
        optionGroups.map(async (group) => ({
          ...this.mapOptionGroup(group),
          options: (
            (await this.databaseService
              .prepare(
                `SELECT *
                 FROM "MenuOptionItem"
                 WHERE "optionGroupId" = $optionGroupId
                 ORDER BY "sortOrder" ASC, "createdAt" ASC`,
              )
              .all({ $optionGroupId: group.id })) as unknown as MenuOptionItemRow[]
          ).map((option) => this.mapOptionItem(option)),
        })),
      ),
    };
  }

  async createOptionGroup(
    storeId: string,
    itemId: string,
    ownerTenantId: string,
    dto: CreateMenuOptionGroupDto,
  ) {
    await this.ensureOwnedStore(storeId, ownerTenantId);
    await this.findStoreMenuItemOrThrow(storeId, itemId);

    const minSelections = dto.minSelections ?? 0;
    const maxSelections = dto.maxSelections ?? Math.max(1, minSelections || 1);

    if (minSelections > maxSelections) {
      throw new ForbiddenException('Minimum selections cannot be greater than maximum selections.');
    }

    const now = new Date();
    const optionGroup: MenuOptionGroup = {
      id: randomUUID(),
      menuItemId: itemId,
      name: dto.name,
      description: dto.description?.trim() || null,
      minSelections,
      maxSelections,
      isRequired: dto.isRequired ?? minSelections > 0,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    await this.databaseService
      .prepare(
        `INSERT INTO "MenuOptionGroup" (
          "id", "menuItemId", "name", "description", "minSelections",
          "maxSelections", "isRequired", "sortOrder", "isActive",
          "createdAt", "updatedAt"
        ) VALUES (
          $id, $menuItemId, $name, $description, $minSelections,
          $maxSelections, $isRequired, $sortOrder, $isActive,
          $createdAt, $updatedAt
        )`,
      )
      .run({
        $id: optionGroup.id,
        $menuItemId: optionGroup.menuItemId,
        $name: optionGroup.name,
        $description: optionGroup.description,
        $minSelections: optionGroup.minSelections,
        $maxSelections: optionGroup.maxSelections,
        $isRequired: optionGroup.isRequired,
        $sortOrder: optionGroup.sortOrder,
        $isActive: optionGroup.isActive,
        $createdAt: optionGroup.createdAt.toISOString(),
        $updatedAt: optionGroup.updatedAt.toISOString(),
      });

    return { optionGroup };
  }

  async listOptionGroups(
    storeId: string,
    itemId: string,
    ownerTenantId: string,
  ) {
    await this.ensureOwnedStore(storeId, ownerTenantId);
    await this.findStoreMenuItemOrThrow(storeId, itemId);

    const groups = (await this.databaseService
      .prepare(
        `SELECT *
         FROM "MenuOptionGroup"
         WHERE "menuItemId" = $menuItemId
         ORDER BY "sortOrder" ASC, "createdAt" ASC`,
      )
      .all({ $menuItemId: itemId })) as unknown as MenuOptionGroupRow[];

    return groups.map((group) => this.mapOptionGroup(group));
  }

  async updateOptionGroup(
    storeId: string,
    itemId: string,
    groupId: string,
    ownerTenantId: string,
    dto: UpdateMenuOptionGroupDto,
  ) {
    await this.ensureOwnedStore(storeId, ownerTenantId);
    await this.findStoreMenuItemOrThrow(storeId, itemId);
    const group = await this.findOptionGroupOrThrow(itemId, groupId);

    const minSelections = dto.minSelections ?? group.minSelections;
    const maxSelections = dto.maxSelections ?? group.maxSelections;

    if (minSelections > maxSelections) {
      throw new ForbiddenException('Minimum selections cannot be greater than maximum selections.');
    }

    const updatedAt = new Date();
    await this.databaseService
      .prepare(
        `UPDATE "MenuOptionGroup"
         SET "name" = $name,
             "description" = $description,
             "minSelections" = $minSelections,
             "maxSelections" = $maxSelections,
             "isRequired" = $isRequired,
             "sortOrder" = $sortOrder,
             "isActive" = $isActive,
             "updatedAt" = $updatedAt
         WHERE "id" = $id`,
      )
      .run({
        $id: groupId,
        $name: dto.name?.trim() || group.name,
        $description:
          dto.description === undefined
            ? group.description
            : dto.description.trim() || null,
        $minSelections: minSelections,
        $maxSelections: maxSelections,
        $isRequired: dto.isRequired ?? group.isRequired,
        $sortOrder: dto.sortOrder ?? group.sortOrder,
        $isActive: dto.isActive ?? group.isActive,
        $updatedAt: updatedAt.toISOString(),
      });

    return {
      optionGroup: await this.findOptionGroupOrThrow(itemId, groupId),
    };
  }

  async createOptionItem(
    storeId: string,
    itemId: string,
    groupId: string,
    ownerTenantId: string,
    dto: CreateMenuOptionItemDto,
  ) {
    await this.ensureOwnedStore(storeId, ownerTenantId);
    await this.findStoreMenuItemOrThrow(storeId, itemId);
    await this.findOptionGroupOrThrow(itemId, groupId);

    const now = new Date();
    const optionItem: MenuOptionItem = {
      id: randomUUID(),
      optionGroupId: groupId,
      name: dto.name,
      priceDelta: dto.priceDelta ?? 0,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    await this.databaseService
      .prepare(
        `INSERT INTO "MenuOptionItem" (
          "id", "optionGroupId", "name", "priceDelta", "sortOrder",
          "isActive", "createdAt", "updatedAt"
        ) VALUES (
          $id, $optionGroupId, $name, $priceDelta, $sortOrder,
          $isActive, $createdAt, $updatedAt
        )`,
      )
      .run({
        $id: optionItem.id,
        $optionGroupId: optionItem.optionGroupId,
        $name: optionItem.name,
        $priceDelta: optionItem.priceDelta,
        $sortOrder: optionItem.sortOrder,
        $isActive: optionItem.isActive,
        $createdAt: optionItem.createdAt.toISOString(),
        $updatedAt: optionItem.updatedAt.toISOString(),
      });

    return { option: optionItem };
  }

  async listOptionItems(
    storeId: string,
    itemId: string,
    groupId: string,
    ownerTenantId: string,
  ) {
    await this.ensureOwnedStore(storeId, ownerTenantId);
    await this.findStoreMenuItemOrThrow(storeId, itemId);
    await this.findOptionGroupOrThrow(itemId, groupId);

    const options = (await this.databaseService
      .prepare(
        `SELECT *
         FROM "MenuOptionItem"
         WHERE "optionGroupId" = $optionGroupId
         ORDER BY "sortOrder" ASC, "createdAt" ASC`,
      )
      .all({ $optionGroupId: groupId })) as unknown as MenuOptionItemRow[];

    return options.map((option) => this.mapOptionItem(option));
  }

  async updateOptionItem(
    storeId: string,
    itemId: string,
    groupId: string,
    optionId: string,
    ownerTenantId: string,
    dto: UpdateMenuOptionItemDto,
  ) {
    await this.ensureOwnedStore(storeId, ownerTenantId);
    await this.findStoreMenuItemOrThrow(storeId, itemId);
    await this.findOptionGroupOrThrow(itemId, groupId);
    const option = await this.findOptionItemOrThrow(groupId, optionId);
    const updatedAt = new Date();

    await this.databaseService
      .prepare(
        `UPDATE "MenuOptionItem"
         SET "name" = $name,
             "priceDelta" = $priceDelta,
             "sortOrder" = $sortOrder,
             "isActive" = $isActive,
             "updatedAt" = $updatedAt
         WHERE "id" = $id`,
      )
      .run({
        $id: optionId,
        $name: dto.name?.trim() || option.name,
        $priceDelta: dto.priceDelta ?? option.priceDelta,
        $sortOrder: dto.sortOrder ?? option.sortOrder,
        $isActive: dto.isActive ?? option.isActive,
        $updatedAt: updatedAt.toISOString(),
      });

    return {
      option: await this.findOptionItemOrThrow(groupId, optionId),
    };
  }

  private async ensureOwnedStore(storeId: string, ownerTenantId: string) {
    const store = await this.storesService.findOwnedStore(
      storeId,
      ownerTenantId,
    );

    if (!store) {
      throw new ForbiddenException('You can only manage menus for your own stores.');
    }

    return store;
  }

  private async ensureStorePublicOrThrow(storeId: string) {
    const store = await this.storesService.findPublicStore(storeId);
    if (!store) {
      throw new NotFoundException('Store could not be found.');
    }

    return store;
  }

  private async findStoreCategoryOrThrow(storeId: string, categoryId: string) {
    const category = (await this.databaseService
      .prepare(
        `SELECT * FROM "MenuCategory"
         WHERE "id" = $id AND "storeId" = $storeId`,
      )
      .get({
        $id: categoryId,
        $storeId: storeId,
      })) as MenuCategoryRow | undefined;

    if (!category) {
      throw new NotFoundException('Menu category could not be found for this store.');
    }

    return this.mapCategory(category);
  }

  private async findStoreMenuItemOrThrow(storeId: string, itemId: string) {
    const item = (await this.databaseService
      .prepare(
        `SELECT mi.*,
                c."code" AS "currencyCode", c."symbol" AS "currencySymbol"
         FROM "MenuItem" mi
         INNER JOIN "Currency" c ON c."id" = mi."currencyId"
         WHERE mi."id" = $id AND mi."storeId" = $storeId`,
      )
      .get({
        $id: itemId,
        $storeId: storeId,
      })) as MenuItemRow | undefined;

    if (!item) {
      throw new NotFoundException('Menu item could not be found for this store.');
    }

    return this.mapItem(item);
  }

  private async findOptionGroupOrThrow(itemId: string, groupId: string) {
    const group = (await this.databaseService
      .prepare(
        `SELECT *
         FROM "MenuOptionGroup"
         WHERE "id" = $id AND "menuItemId" = $menuItemId`,
      )
      .get({
        $id: groupId,
        $menuItemId: itemId,
      })) as MenuOptionGroupRow | undefined;

    if (!group) {
      throw new NotFoundException('Menu option group could not be found for this item.');
    }

    return this.mapOptionGroup(group);
  }

  private async findOptionItemOrThrow(groupId: string, optionId: string) {
    const option = (await this.databaseService
      .prepare(
        `SELECT *
         FROM "MenuOptionItem"
         WHERE "id" = $id AND "optionGroupId" = $optionGroupId`,
      )
      .get({
        $id: optionId,
        $optionGroupId: groupId,
      })) as MenuOptionItemRow | undefined;

    if (!option) {
      throw new NotFoundException('Menu option item could not be found for this group.');
    }

    return this.mapOptionItem(option);
  }

  private mapCategory(row: MenuCategoryRow): MenuCategory {
    return {
      id: row.id,
      storeId: row.storeId,
      name: row.name,
      description: row.description,
      imageUrl: row.imageUrl,
      sortOrder: row.sortOrder,
      isActive: Boolean(row.isActive),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapItem(row: MenuItemRow): MenuItemWithCurrency {
    return {
      id: row.id,
      storeId: row.storeId,
      categoryId: row.categoryId,
      name: row.name,
      description: row.description,
      imageUrl: row.imageUrl,
      basePrice: row.basePrice,
      currencyId: row.currencyId,
      currencyCode: row.currencyCode,
      currencySymbol: row.currencySymbol,
      sortOrder: row.sortOrder,
      isActive: Boolean(row.isActive),
      availabilityType: row.availabilityType as MenuItemAvailabilityType,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapOptionGroup(row: MenuOptionGroupRow): MenuOptionGroup {
    return {
      id: row.id,
      menuItemId: row.menuItemId,
      name: row.name,
      description: row.description,
      minSelections: row.minSelections,
      maxSelections: row.maxSelections,
      isRequired: Boolean(row.isRequired),
      sortOrder: row.sortOrder,
      isActive: Boolean(row.isActive),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapOptionItem(row: MenuOptionItemRow): MenuOptionItem {
    return {
      id: row.id,
      optionGroupId: row.optionGroupId,
      name: row.name,
      priceDelta: row.priceDelta,
      sortOrder: row.sortOrder,
      isActive: Boolean(row.isActive),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}

interface MenuCategoryRow {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

interface MenuItemRow {
  id: string;
  storeId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: number;
  currencyId: string;
  currencyCode: string;
  currencySymbol: string;
  sortOrder: number;
  isActive: number;
  availabilityType: string;
  createdAt: string;
  updatedAt: string;
}

type MenuItemWithCurrency = MenuItem & {
  currencyCode: string;
  currencySymbol: string;
};

interface MenuItemListRow extends MenuItemRow {
  categoryName: string | null;
}

interface MenuOptionGroupRow {
  id: string;
  menuItemId: string;
  name: string;
  description: string | null;
  minSelections: number;
  maxSelections: number;
  isRequired: number;
  sortOrder: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

interface MenuOptionItemRow {
  id: string;
  optionGroupId: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}
