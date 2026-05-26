import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { assertStoreAccess } from '../../common/security/store-scope';
import { DatabaseService } from '../../database/database.service';
import { DeliveryCoverageSyncService } from '../discovery/delivery-coverage-sync.service';
import {
  DayOfWeek,
  Store,
  StoreDeliveryZone,
  StoreOnboardingStatus,
  StoreOpeningHour,
  StoreStatus,
} from './entities/store.entity';
import { CreateStoreDto } from './dto/create-store.dto';
import { ListPublicStoresDto } from './dto/list-public-stores.dto';
import {
  DeliveryZoneInputDto,
  OpeningHourInputDto,
} from './dto/store-operations.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

@Injectable()
export class StoresService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly coverageSync: DeliveryCoverageSyncService,
  ) {}

  async create(ownerTenantId: string, dto: CreateStoreDto) {
    const slug = await this.buildUniqueSlug(dto.name, dto.slug);
    const now = new Date();
    const store: Store = {
      id: randomUUID(),
      ownerTenantId,
      name: dto.name,
      slug,
      category: dto.category,
      description: dto.description?.trim() || null,
      imageUrl: dto.imageUrl?.trim() || null,
      status: StoreStatus.DRAFT,
      onboardingStatus: StoreOnboardingStatus.PROFILE_PENDING,
      isActive: true,
      addressLine1: dto.addressLine1?.trim() || null,
      addressLine2: dto.addressLine2?.trim() || null,
      city: dto.city?.trim() || null,
      postalCode: dto.postalCode?.trim() || null,
      country: dto.country?.trim() || null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      phoneNumber: dto.phoneNumber?.trim() || null,
      openingHours: this.buildOpeningHours(dto.openingHours),
      deliveryZones: this.buildDeliveryZones(dto.deliveryZones),
      createdAt: now,
      updatedAt: now,
    };

    await this.databaseService.transaction(async () => {
      await this.databaseService
        .prepare(
          `INSERT INTO "Store" (
            "id", "ownerTenantId", "name", "slug", "category", "description", "imageUrl",
            "status", "onboardingStatus", "isActive",
            "addressLine1", "addressLine2", "city", "postalCode", "country",
            "latitude", "longitude", "phoneNumber",
            "createdAt", "updatedAt"
          ) VALUES (
            $id, $ownerTenantId, $name, $slug, $category, $description, $imageUrl,
            $status, $onboardingStatus, $isActive,
            $addressLine1, $addressLine2, $city, $postalCode, $country,
            $latitude, $longitude, $phoneNumber,
            $createdAt, $updatedAt
          )`,
        )
        .run({
          $id: store.id,
          $ownerTenantId: store.ownerTenantId,
          $name: store.name,
          $slug: store.slug,
          $category: store.category,
          $description: store.description,
          $imageUrl: store.imageUrl,
          $status: store.status,
          $onboardingStatus: store.onboardingStatus,
          $isActive: store.isActive,
          $addressLine1: store.addressLine1,
          $addressLine2: store.addressLine2,
          $city: store.city,
          $postalCode: store.postalCode,
          $country: store.country,
          $latitude: store.latitude,
          $longitude: store.longitude,
          $phoneNumber: store.phoneNumber,
          $createdAt: store.createdAt.toISOString(),
          $updatedAt: store.updatedAt.toISOString(),
        });

      await this.insertOpeningHours(store.id, store.openingHours, now);
      await this.insertDeliveryZones(store.id, store.deliveryZones, now);
      // Dual-write: mirror legacy zones into the normalized coverage model
      // inside the same transaction so the two never drift.
      await this.coverageSync.syncFromLegacyZones(
        store.id,
        store.deliveryZones,
        store.country,
        now,
      );
    });

    return {
      store,
    };
  }

  async listForTenant(ownerTenantId: string) {
    const stores = (await this.databaseService
      .prepare(
        `SELECT * FROM "Store"
         WHERE "ownerTenantId" = $ownerTenantId
         ORDER BY "createdAt" DESC`,
      )
      .all({ $ownerTenantId: ownerTenantId })) as unknown as StoreRow[];

    const storeIds = stores.map((store) => store.id);
    const [openingHours, deliveryZones] = await Promise.all([
      this.fetchOpeningHoursForStoreIds(storeIds),
      this.fetchDeliveryZonesForStoreIds(storeIds),
    ]);

    return stores.map((store) =>
      this.mapStore(
        store,
        openingHours[store.id] ?? [],
        deliveryZones[store.id] ?? [],
      ),
    );
  }

  /**
   * Read-only platform-wide store list for admin operational oversight.
   * No ownership filter — admins see every store. Includes the owning
   * tenant's company name and a live menu-item count.
   */
  async listForAdmin(status?: StoreStatus) {
    const clauses: string[] = ['1 = 1'];
    const params: Record<string, string> = {};
    if (status) {
      clauses.push(`r."status" = $status`);
      params.$status = status;
    }

    const rows = (await this.databaseService
      .prepare(
        `SELECT r."id", r."name", r."slug", r."category", r."status",
                r."isActive", r."onboardingStatus", r."city", r."country",
                r."imageUrl", r."createdAt",
                t."companyName" AS "ownerCompanyName",
                COUNT(DISTINCT mi."id") AS "menuItemCount"
         FROM "Store" r
         LEFT JOIN "TenantAccount" t ON t."id" = r."ownerTenantId"
         LEFT JOIN "MenuItem" mi ON mi."storeId" = r."id"
         WHERE ${clauses.join(' AND ')}
         GROUP BY r."id", t."companyName"
         ORDER BY r."createdAt" DESC`,
      )
      .all(params)) as unknown as Array<{
      id: string;
      name: string;
      slug: string;
      category: string;
      status: string;
      isActive: boolean | number;
      onboardingStatus: string;
      city: string | null;
      country: string | null;
      imageUrl: string | null;
      createdAt: string;
      ownerCompanyName: string | null;
      menuItemCount: number | string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      category: row.category,
      status: row.status,
      isActive: Boolean(row.isActive),
      onboardingStatus: row.onboardingStatus,
      city: row.city,
      country: row.country,
      imageUrl: row.imageUrl,
      createdAt: row.createdAt,
      ownerCompanyName: row.ownerCompanyName,
      menuItemCount: Number(row.menuItemCount ?? 0),
    }));
  }

  async getOwnedStore(storeId: string, ownerTenantId: string) {
    const store = await this.findOwnedStore(storeId, ownerTenantId);
    if (!store) {
      throw new NotFoundException('Store could not be found for this tenant.');
    }

    return store;
  }

  async update(
    storeId: string,
    ownerTenantId: string,
    dto: UpdateStoreDto,
  ) {
    const store = await this.findOwnedStore(storeId, ownerTenantId);
    if (!store) {
      throw new NotFoundException('Store could not be found for this tenant.');
    }
    // The controller is currently @AuthTypes('tenant'), so findOwnedStore
    // already enforces tenant ownership via its WHERE clause. The explicit
    // assertStoreAccess call below makes the security contract visible at
    // the service-layer seam and is ready for the next slice that opens
    // store-scoped writes to staff identities — see common/security/store-scope.
    assertStoreAccess({
      user: { id: ownerTenantId, email: '', type: 'tenant' },
      ownerTenantId: store.ownerTenantId,
      storeId,
    });

    const nextSlug =
      dto.slug && dto.slug !== store.slug
        ? await this.ensureUniqueSlug(dto.slug, storeId)
        : dto.name && !dto.slug && dto.name !== store.name
          ? await this.ensureUniqueSlug(
              dto.name
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .replace(/-{2,}/g, '-')
                .slice(0, 60) || 'store',
              storeId,
            )
          : store.slug;

    const updated = {
      name: dto.name?.trim() || store.name,
      slug: nextSlug,
      category: dto.category?.trim() || store.category,
      description:
        dto.description === undefined
          ? store.description
          : dto.description.trim() || null,
      imageUrl:
        dto.imageUrl === undefined ? store.imageUrl : dto.imageUrl.trim() || null,
      status: dto.status ?? store.status,
      onboardingStatus: dto.onboardingStatus ?? store.onboardingStatus,
      isActive: dto.isActive ?? store.isActive,
      addressLine1: dto.addressLine1?.trim() || store.addressLine1,
      addressLine2:
        dto.addressLine2 === undefined
          ? store.addressLine2
          : dto.addressLine2.trim() || null,
      city: dto.city?.trim() || store.city,
      postalCode: dto.postalCode?.trim() || store.postalCode,
      country: dto.country?.trim() || store.country,
      latitude: dto.latitude ?? store.latitude,
      longitude: dto.longitude ?? store.longitude,
      phoneNumber: dto.phoneNumber?.trim() || store.phoneNumber,
      updatedAt: new Date(),
    };

    await this.databaseService.transaction(async () => {
      await this.databaseService
        .prepare(
          `UPDATE "Store"
           SET "name" = $name,
               "slug" = $slug,
               "category" = $category,
               "description" = $description,
               "imageUrl" = $imageUrl,
               "status" = $status,
               "onboardingStatus" = $onboardingStatus,
               "isActive" = $isActive,
               "addressLine1" = $addressLine1,
               "addressLine2" = $addressLine2,
               "city" = $city,
               "postalCode" = $postalCode,
               "country" = $country,
               "latitude" = $latitude,
               "longitude" = $longitude,
               "phoneNumber" = $phoneNumber,
               "updatedAt" = $updatedAt
           WHERE "id" = $id`,
        )
        .run({
          $id: storeId,
          $name: updated.name,
          $slug: updated.slug,
          $category: updated.category,
          $description: updated.description,
          $imageUrl: updated.imageUrl,
          $status: updated.status,
          $onboardingStatus: updated.onboardingStatus,
          $isActive: updated.isActive,
          $addressLine1: updated.addressLine1,
          $addressLine2: updated.addressLine2,
          $city: updated.city,
          $postalCode: updated.postalCode,
          $country: updated.country,
          $latitude: updated.latitude,
          $longitude: updated.longitude,
          $phoneNumber: updated.phoneNumber,
          $updatedAt: updated.updatedAt.toISOString(),
        });

      if (dto.openingHours) {
        await this.databaseService
          .prepare(`DELETE FROM "StoreOpeningHour" WHERE "storeId" = $storeId`)
          .run({ $storeId: storeId });
        await this.insertOpeningHours(
          storeId,
          this.buildOpeningHours(dto.openingHours),
          updated.updatedAt,
        );
      }

      // Re-sync the normalized coverage model when the legacy zones change,
      // or when the store country (which drives the normalized countryCode)
      // changes. Both writes share this transaction — no partial state.
      let zonesForSync: StoreDeliveryZone[] | null = null;

      if (dto.deliveryZones) {
        await this.databaseService
          .prepare(`DELETE FROM "StoreDeliveryZone" WHERE "storeId" = $storeId`)
          .run({ $storeId: storeId });
        const builtZones = this.buildDeliveryZones(dto.deliveryZones);
        await this.insertDeliveryZones(storeId, builtZones, updated.updatedAt);
        zonesForSync = builtZones;
      } else if (updated.country !== store.country) {
        zonesForSync = await this.fetchDeliveryZones(storeId);
      }

      if (zonesForSync !== null) {
        await this.coverageSync.syncFromLegacyZones(
          storeId,
          zonesForSync,
          updated.country,
          updated.updatedAt,
        );
      }
    });

    return {
      store: await this.getOwnedStore(storeId, ownerTenantId),
    };
  }

  async listPublic(query: ListPublicStoresDto = {}) {
    const normalizedPostalCode = query.postalCode?.trim() || null;
    const discoveryMode = query.mode === 'collection' ? 'collection' : 'delivery';
    const normalizedShopType = query.shopType?.trim().toLowerCase() || null;
    const normalizedCategories = (query.categories ?? [])
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const categoryCount = normalizedCategories.length;
    const freeDeliveryOnly = Boolean(query.freeDelivery);
    const newOnly = Boolean(query.isNew);
    const openNowOnly = Boolean(query.openNow);
    const maxMinimumOrder = query.maxMinimumOrder ?? null;
    const now = new Date();
    const currentTime = now.toISOString().slice(11, 16);
    const dayOfWeek = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ][now.getUTCDay()];
    const orderBySql =
      query.sort === 'delivery_fee'
        ? `"deliveryFee" ASC NULLS LAST, "estimatedDeliveryMinutes" ASC NULLS LAST, r."createdAt" DESC`
        : query.sort === 'eta'
          ? `"estimatedDeliveryMinutes" ASC NULLS LAST, "deliveryFee" ASC NULLS LAST, r."createdAt" DESC`
          : query.sort === 'minimum_order'
            ? `"minimumOrderAmount" ASC NULLS LAST, "deliveryFee" ASC NULLS LAST, r."createdAt" DESC`
            : query.sort === 'newest'
              ? `r."createdAt" DESC`
              : `"deliveryFee" ASC NULLS LAST, r."createdAt" DESC`;
    const stores = (await this.databaseService
      .prepare(
        `SELECT r.*,
                COUNT(DISTINCT dz."id") AS "deliveryZoneCount",
                COUNT(DISTINCT roh."id") AS "openHourCount",
                MIN(dz."deliveryFee") AS "deliveryFee",
                MIN(dz."minimumOrderAmount") AS "minimumOrderAmount",
                MIN(dz."estimatedDeliveryMinutes") AS "estimatedDeliveryMinutes"
         FROM "Store" r
         LEFT JOIN "StoreDeliveryZone" dz
           ON dz."storeId" = r."id"
          AND (
            $postalCode::text IS NULL
            OR EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(dz."postalCodes"::jsonb) AS postal_code(value)
              WHERE postal_code.value = $postalCode::text
            )
          )
         LEFT JOIN "StoreOpeningHour" roh
           ON roh."storeId" = r."id"
          AND roh."dayOfWeek" = $dayOfWeek
          AND roh."isClosed" = FALSE
          AND roh."openTime" <= $currentTime
          AND roh."closeTime" > $currentTime
         WHERE r."status" = $status
           AND r."isActive" = TRUE
           AND (
             $shopType::text IS NULL
             OR LOWER(r."category") = $shopType::text
           )
           AND (
             $categoryCount = 0
             OR EXISTS (
               SELECT 1
               FROM "MenuCategory" mc
               WHERE mc."storeId" = r."id"
                 AND mc."isActive" = TRUE
                 AND LOWER(mc."name") = ANY($categories::text[])
             )
           )
           AND (
             $isNew = FALSE
             OR r."createdAt" >= NOW() - INTERVAL '30 days'
           )
           AND (
             $postalCode::text IS NULL
             OR $mode = 'delivery'
             OR r."postalCode" = $postalCode::text
           )
         GROUP BY r."id"
         HAVING (
             $postalCode::text IS NULL
             OR $mode <> 'delivery'
             OR COUNT(DISTINCT dz."id") > 0
           )
           AND (
             $freeDelivery = FALSE
             OR COALESCE(MIN(dz."deliveryFee"), 0) = 0
           )
           AND (
             $maxMinimumOrder::numeric IS NULL
             OR COALESCE(MIN(dz."minimumOrderAmount"), 0) <= $maxMinimumOrder::numeric
           )
           AND (
             $openNow = FALSE
             OR COUNT(DISTINCT roh."id") > 0
           )
         ORDER BY ${orderBySql}`,
      )
      .all({
        $status: StoreStatus.ACTIVE,
        $postalCode: normalizedPostalCode,
        $mode: discoveryMode,
        $shopType: normalizedShopType,
        $categories: normalizedCategories,
        $categoryCount: categoryCount,
        $freeDelivery: freeDeliveryOnly,
        $isNew: newOnly,
        $openNow: openNowOnly,
        $maxMinimumOrder: maxMinimumOrder,
        $dayOfWeek: dayOfWeek,
        $currentTime: currentTime,
      })) as unknown as StoreListRow[];

    const storeIds = stores.map((store) => store.id);
    const [cuisinesByStore, reviewSummaryByStore] = await Promise.all([
      this.fetchCuisinesForStoreIds(storeIds),
      this.fetchReviewSummariesForStoreIds(storeIds),
    ]);

    return {
      stores: stores.map((store) => ({
        ...this.mapPublicStore(store, normalizedPostalCode),
        cuisines: cuisinesByStore[store.id] ?? [],
        reviewSummary: reviewSummaryByStore[store.id] ?? {
          averageRating: null,
          totalReviews: 0,
        },
      })),
    };
  }

  async findPublicStore(storeId: string) {
    const store = (await this.databaseService
      .prepare(
        `SELECT r.*,
                COUNT(DISTINCT dz."id") AS "deliveryZoneCount",
                MIN(dz."deliveryFee") AS "deliveryFee",
                MIN(dz."minimumOrderAmount") AS "minimumOrderAmount",
                MIN(dz."estimatedDeliveryMinutes") AS "estimatedDeliveryMinutes"
         FROM "Store" r
         LEFT JOIN "StoreDeliveryZone" dz ON dz."storeId" = r."id"
         WHERE r."id" = $id AND r."status" = $status AND r."isActive" = TRUE
         GROUP BY r."id"
         LIMIT 1`,
      )
      .get({
        $id: storeId,
        $status: StoreStatus.ACTIVE,
      })) as StoreListRow | undefined;

    if (!store) {
      return null;
    }

    const [cuisinesByStore, reviewSummaryByStore] = await Promise.all([
      this.fetchCuisinesForStoreIds([store.id]),
      this.fetchReviewSummariesForStoreIds([store.id]),
    ]);

    return {
      store: {
        ...this.mapPublicStore(store, null),
        cuisines: cuisinesByStore[store.id] ?? [],
        reviewSummary: reviewSummaryByStore[store.id] ?? {
          averageRating: null,
          totalReviews: 0,
        },
      },
    };
  }

  private async fetchCuisinesForStoreIds(storeIds: string[]) {
    if (storeIds.length === 0) return {} as Record<string, Array<{
      id: string;
      slug: string;
      name: string;
      emoji: string | null;
      isPrimary: boolean;
    }>>;
    const rows = (await this.databaseService
      .prepare(
        `SELECT rc."storeId" AS "storeId", c."id", c."slug", c."name",
                c."emoji", rc."isPrimary"
         FROM "StoreCuisine" rc
         INNER JOIN "Cuisine" c ON c."id" = rc."cuisineId"
         WHERE rc."storeId" = ANY($storeIds::uuid[])
           AND c."isActive" = TRUE
         ORDER BY rc."isPrimary" DESC, c."sortOrder" ASC, c."name" ASC`,
      )
      .all({ $storeIds: storeIds })) as Array<{
      storeId: string;
      id: string;
      slug: string;
      name: string;
      emoji: string | null;
      isPrimary: boolean;
    }>;

    const result: Record<string, Array<{
      id: string;
      slug: string;
      name: string;
      emoji: string | null;
      isPrimary: boolean;
    }>> = {};
    for (const row of rows) {
      const list = (result[row.storeId] = result[row.storeId] ?? []);
      list.push({
        id: row.id,
        slug: row.slug,
        name: row.name,
        emoji: row.emoji,
        isPrimary: Boolean(row.isPrimary),
      });
    }
    return result;
  }

  private async fetchReviewSummariesForStoreIds(storeIds: string[]) {
    if (storeIds.length === 0) return {} as Record<string, {
      averageRating: number | null;
      totalReviews: number;
    }>;
    const rows = (await this.databaseService
      .prepare(
        `SELECT "storeId",
                ROUND(AVG("rating")::numeric, 2) AS "averageRating",
                COUNT(*)::int AS "totalReviews"
         FROM "StoreReview"
         WHERE "storeId" = ANY($storeIds::uuid[]) AND "status" = 'visible'
         GROUP BY "storeId"`,
      )
      .all({ $storeIds: storeIds })) as Array<{
      storeId: string;
      averageRating: string | number | null;
      totalReviews: number;
    }>;
    const result: Record<string, { averageRating: number | null; totalReviews: number }> = {};
    for (const row of rows) {
      result[row.storeId] = {
        averageRating: row.averageRating === null ? null : Number(row.averageRating),
        totalReviews: Number(row.totalReviews ?? 0),
      };
    }
    return result;
  }

  async getDiscoveryMetadata(query: ListPublicStoresDto = {}) {
    const discovery = await this.listPublic(query);
    const storeIds = discovery.stores.map((store) => store.id);

    if (storeIds.length === 0) {
      return {
        shopTypes: [],
        categories: [],
        filters: {
          freeDeliveryCount: 0,
          collectionCount: 0,
          newCount: 0,
        },
      };
    }

    const shopTypes = (await this.databaseService
      .prepare(
        `SELECT LOWER(r."category") AS "id",
                r."category" AS "label",
                COUNT(*)::int AS "count"
         FROM "Store" r
         WHERE r."id" = ANY($storeIds::uuid[])
         GROUP BY LOWER(r."category"), r."category"
         ORDER BY "count" DESC, "label" ASC`,
      )
      .all({
        $storeIds: storeIds,
      })) as Array<{ id: string; label: string; count: number }>;

    const categories = (await this.databaseService
      .prepare(
        `SELECT LOWER(mc."name") AS "id",
                mc."name" AS "label",
                COUNT(DISTINCT mc."storeId")::int AS "count"
         FROM "MenuCategory" mc
         WHERE mc."storeId" = ANY($storeIds::uuid[])
           AND mc."isActive" = TRUE
         GROUP BY LOWER(mc."name"), mc."name"
         ORDER BY "count" DESC, "label" ASC
         LIMIT 12`,
      )
      .all({
        $storeIds: storeIds,
      })) as Array<{ id: string; label: string; count: number }>;

    return {
      shopTypes,
      categories,
      filters: {
        freeDeliveryCount: discovery.stores.filter(
          (store) =>
            store.deliveryFee === null ||
            store.deliveryFee === undefined ||
            store.deliveryFee === 0,
        ).length,
        collectionCount: discovery.stores.filter(
          (store) => store.supportsCollection,
        ).length,
        newCount: discovery.stores.filter((store) => {
          const createdAt = store.createdAt;
          return (
            createdAt instanceof Date &&
            createdAt.getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000
          );
        }).length,
      },
    };
  }

  /**
   * Lightweight `{id, name, slug, status, isActive}` projection for a set of
   * stores a staff session is currently scoped to. Used by the staff
   * workspace to translate store UUIDs into operator-readable names.
   *
   * The caller MUST pass the live `staffStoreScope` (i.e. the value from
   * `request.user.staffStoreScope` populated by AccessTokenGuard). This
   * method does not consult StaffMembership itself — it just hydrates the
   * already-validated scope.
   */
  async listForStaffScope(staffStoreScope: readonly string[]) {
    if (staffStoreScope.length === 0) {
      return [];
    }

    const rows = (await this.databaseService
      .prepare(
        `SELECT "id", "name", "slug", "status", "isActive"
         FROM "Store"
         WHERE "id" = ANY($storeIds::uuid[])
         ORDER BY "name" ASC`,
      )
      .all({ $storeIds: [...staffStoreScope] })) as unknown as Array<{
      id: string;
      name: string;
      slug: string;
      status: string;
      isActive: boolean | number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      isActive: Boolean(row.isActive),
    }));
  }

  async findOwnedStore(storeId: string, ownerTenantId: string) {
    const store = (await this.databaseService
      .prepare(
        `SELECT * FROM "Store"
         WHERE "id" = $id AND "ownerTenantId" = $ownerTenantId`,
      )
      .get({
        $id: storeId,
        $ownerTenantId: ownerTenantId,
      })) as StoreRow | undefined;

    if (!store) {
      return null;
    }

    const [openingHours, deliveryZones] = await Promise.all([
      this.fetchOpeningHours(storeId),
      this.fetchDeliveryZones(storeId),
    ]);

    return this.mapStore(store, openingHours, deliveryZones);
  }

  /**
   * Lightweight orderability check. A store is orderable when it is
   * published (`status = active`) and operationally switched on (`isActive`).
   */
  async getOrderabilitySnapshot(storeId: string) {
    const store = (await this.databaseService
      .prepare(`SELECT * FROM "Store" WHERE "id" = $id LIMIT 1`)
      .get({ $id: storeId })) as StoreRow | undefined;

    if (!store) {
      return null;
    }

    return this.mapStore(store);
  }

  async assertStoreOrderable(storeId: string) {
    const store = await this.getOrderabilitySnapshot(storeId);
    if (!store) {
      throw new NotFoundException('Store could not be found.');
    }

    if (store.status !== StoreStatus.ACTIVE || !store.isActive) {
      throw new ConflictException('Store is not accepting orders right now.');
    }

    return store;
  }

  private buildOpeningHours(
    items: OpeningHourInputDto[] | undefined,
  ): StoreOpeningHour[] {
    return (items ?? []).map((item) => ({
      id: randomUUID(),
      dayOfWeek: item.dayOfWeek,
      openTime: item.openTime,
      closeTime: item.closeTime,
      isClosed: item.isClosed ?? false,
    }));
  }

  private buildDeliveryZones(
    items: DeliveryZoneInputDto[] | undefined,
  ): StoreDeliveryZone[] {
    return (items ?? []).map((item) => ({
      id: randomUUID(),
      name: item.name,
      postalCodes: item.postalCodes,
      radiusKm: item.radiusKm ?? null,
      minimumOrderAmount: item.minimumOrderAmount ?? null,
      deliveryFee: item.deliveryFee ?? null,
      estimatedDeliveryMinutes: item.estimatedDeliveryMinutes ?? null,
    }));
  }

  private async insertOpeningHours(
    storeId: string,
    openingHours: StoreOpeningHour[],
    now: Date,
  ) {
    if (openingHours.length === 0) return;
    const statement = this.databaseService.prepare(
      `INSERT INTO "StoreOpeningHour" (
        "id", "storeId", "dayOfWeek", "openTime", "closeTime",
        "isClosed", "createdAt", "updatedAt"
      ) VALUES (
        $id, $storeId, $dayOfWeek, $openTime, $closeTime,
        $isClosed, $createdAt, $updatedAt
      )`,
    );
    for (const item of openingHours) {
      await statement.run({
        $id: item.id,
        $storeId: storeId,
        $dayOfWeek: item.dayOfWeek,
        $openTime: item.openTime,
        $closeTime: item.closeTime,
        $isClosed: item.isClosed,
        $createdAt: now.toISOString(),
        $updatedAt: now.toISOString(),
      });
    }
  }

  private async insertDeliveryZones(
    storeId: string,
    deliveryZones: StoreDeliveryZone[],
    now: Date,
  ) {
    if (deliveryZones.length === 0) return;
    const statement = this.databaseService.prepare(
      `INSERT INTO "StoreDeliveryZone" (
        "id", "storeId", "name", "postalCodes", "radiusKm",
        "minimumOrderAmount", "deliveryFee", "estimatedDeliveryMinutes",
        "createdAt", "updatedAt"
      ) VALUES (
        $id, $storeId, $name, $postalCodes, $radiusKm,
        $minimumOrderAmount, $deliveryFee, $estimatedDeliveryMinutes,
        $createdAt, $updatedAt
      )`,
    );
    for (const item of deliveryZones) {
      await statement.run({
        $id: item.id,
        $storeId: storeId,
        $name: item.name,
        $postalCodes: JSON.stringify(item.postalCodes),
        $radiusKm: item.radiusKm,
        $minimumOrderAmount: item.minimumOrderAmount,
        $deliveryFee: item.deliveryFee,
        $estimatedDeliveryMinutes: item.estimatedDeliveryMinutes,
        $createdAt: now.toISOString(),
        $updatedAt: now.toISOString(),
      });
    }
  }

  private async fetchOpeningHours(storeId: string) {
    const map = await this.fetchOpeningHoursForStoreIds([storeId]);
    return map[storeId] ?? [];
  }

  private async fetchDeliveryZones(storeId: string) {
    const map = await this.fetchDeliveryZonesForStoreIds([storeId]);
    return map[storeId] ?? [];
  }

  private async fetchOpeningHoursForStoreIds(
    storeIds: string[],
  ): Promise<Record<string, StoreOpeningHour[]>> {
    if (storeIds.length === 0) return {};
    const rows = (await this.databaseService
      .prepare(
        `SELECT * FROM "StoreOpeningHour"
         WHERE "storeId" = ANY($storeIds::uuid[])
         ORDER BY "dayOfWeek" ASC`,
      )
      .all({ $storeIds: storeIds })) as unknown as StoreOpeningHourRow[];

    const result: Record<string, StoreOpeningHour[]> = {};
    for (const row of rows) {
      const list = (result[row.storeId] = result[row.storeId] ?? []);
      list.push(this.mapOpeningHour(row));
    }
    return result;
  }

  private async fetchDeliveryZonesForStoreIds(
    storeIds: string[],
  ): Promise<Record<string, StoreDeliveryZone[]>> {
    if (storeIds.length === 0) return {};
    const rows = (await this.databaseService
      .prepare(
        `SELECT * FROM "StoreDeliveryZone"
         WHERE "storeId" = ANY($storeIds::uuid[])
         ORDER BY "createdAt" ASC`,
      )
      .all({ $storeIds: storeIds })) as unknown as StoreDeliveryZoneRow[];

    const result: Record<string, StoreDeliveryZone[]> = {};
    for (const row of rows) {
      const list = (result[row.storeId] = result[row.storeId] ?? []);
      list.push(this.mapDeliveryZone(row));
    }
    return result;
  }

  private async buildUniqueSlug(name: string, requestedSlug?: string) {
    const normalized = (requestedSlug ?? name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
      .slice(0, 60);

    const baseSlug = normalized || 'store';
    let candidate = baseSlug;
    let suffix = 1;

    while (
      await this.databaseService
        .prepare(`SELECT "id" FROM "Store" WHERE "slug" = $slug LIMIT 1`)
        .get({ $slug: candidate })
    ) {
      candidate = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  private async ensureUniqueSlug(slug: string, excludeStoreId: string) {
    const existing = await this.databaseService
      .prepare(
        `SELECT "id"
         FROM "Store"
         WHERE "slug" = $slug
           AND "id" <> $excludeStoreId
         LIMIT 1`,
      )
      .get({
        $slug: slug,
        $excludeStoreId: excludeStoreId,
      });

    if (existing) {
      throw new ConflictException('Store slug is already in use.');
    }

    return slug;
  }

  private mapStore(
    store: StoreRow,
    openingHours: StoreOpeningHour[] = [],
    deliveryZones: StoreDeliveryZone[] = [],
  ): Store {
    return {
      id: store.id,
      ownerTenantId: store.ownerTenantId,
      name: store.name,
      slug: store.slug,
      category: store.category,
      description: store.description,
      imageUrl: store.imageUrl,
      status: store.status as StoreStatus,
      onboardingStatus: store.onboardingStatus as StoreOnboardingStatus,
      isActive: Boolean(store.isActive),
      addressLine1: store.addressLine1,
      addressLine2: store.addressLine2,
      city: store.city,
      postalCode: store.postalCode,
      country: store.country,
      latitude: store.latitude,
      longitude: store.longitude,
      phoneNumber: store.phoneNumber,
      openingHours,
      deliveryZones,
      createdAt: new Date(store.createdAt),
      updatedAt: new Date(store.updatedAt),
    };
  }

  private mapOpeningHour(item: StoreOpeningHourRow): StoreOpeningHour {
    return {
      id: item.id,
      dayOfWeek: item.dayOfWeek as DayOfWeek,
      openTime: item.openTime,
      closeTime: item.closeTime,
      isClosed: Boolean(item.isClosed),
    };
  }

  private mapDeliveryZone(item: StoreDeliveryZoneRow): StoreDeliveryZone {
    return {
      id: item.id,
      name: item.name,
      postalCodes: this.parsePostalCodes(item.postalCodes),
      radiusKm: item.radiusKm,
      minimumOrderAmount: item.minimumOrderAmount,
      deliveryFee: item.deliveryFee,
      estimatedDeliveryMinutes: item.estimatedDeliveryMinutes,
    };
  }

  private parsePostalCodes(value: string): string[] {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }

  private mapPublicStore(
    store: StoreListRow,
    normalizedPostalCode: string | null,
  ) {
    const supportsDelivery = Number(store.deliveryZoneCount ?? 0) > 0;
    const supportsCollection =
      Boolean(store.postalCode) &&
      (normalizedPostalCode === null ||
        store.postalCode === normalizedPostalCode);

    return {
      ...this.mapStore(store),
      supportsDelivery,
      supportsCollection,
      deliveryFee:
        store.deliveryFee === null || store.deliveryFee === undefined
          ? null
          : Number(store.deliveryFee),
      minimumOrderAmount:
        store.minimumOrderAmount === null ||
        store.minimumOrderAmount === undefined
          ? null
          : Number(store.minimumOrderAmount),
      estimatedDeliveryMinutes:
        store.estimatedDeliveryMinutes === null ||
        store.estimatedDeliveryMinutes === undefined
          ? null
          : Number(store.estimatedDeliveryMinutes),
      currency: 'EUR',
    };
  }
}

interface StoreRow {
  id: string;
  ownerTenantId: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  imageUrl: string | null;
  status: string;
  onboardingStatus: string;
  isActive: boolean | number;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  phoneNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoreListRow extends StoreRow {
  deliveryZoneCount?: number;
  openHourCount?: number;
  deliveryFee?: number | null;
  minimumOrderAmount?: number | null;
  estimatedDeliveryMinutes?: number | null;
}

interface StoreOpeningHourRow {
  id: string;
  storeId: string;
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean | number;
}

interface StoreDeliveryZoneRow {
  id: string;
  storeId: string;
  name: string;
  postalCodes: string;
  radiusKm: number | null;
  minimumOrderAmount: number | null;
  deliveryFee: number | null;
  estimatedDeliveryMinutes: number | null;
}
