import { randomBytes, randomUUID } from 'crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AddressNormalizationService } from './address-normalization.service';
import { CoverageService } from './coverage.service';
import { RankingService, RankingCandidate } from './ranking.service';
import { CreateSessionAddressDto, DiscoverRestaurantsDto } from './dto/discovery.dto';
import {
  AvailabilityReason,
  CoverageMatch,
  MatchContext,
  MatchStrategy,
  RankingBreakdown,
} from './entities/discovery.entity';

/** Session addresses live for 30 days, then a janitor sweep can drop them. */
const SESSION_TTL_DAYS = 30;
const DEFAULT_RESULT_LIMIT = 50;

export interface StoreCuisineLite {
  slug: string;
  name: string;
  emoji: string | null;
}

interface StoreRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  imageUrl: string | null;
  status: string;
  isActive: boolean;
  acceptingOrders: boolean;
  isPromoted: boolean;
  discoveryWeight: string | number;
  city: string | null;
  postalCode: string | null;
  averageRating: string | number | null;
  totalReviews: number | null;
  openNow: boolean;
  cuisines: StoreCuisineLite[];
}

/** A discovery facet bucket — category or cuisine, with its result count. */
export interface DiscoveryFacet {
  id: string;
  label: string;
  count: number;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly addressNormalization: AddressNormalizationService,
    private readonly coverageService: CoverageService,
    private readonly rankingService: RankingService,
  ) {}

  // ===========================================================================
  // Session addresses — anonymous flow
  // ===========================================================================

  async createSessionAddress(dto: CreateSessionAddressDto) {
    const address = this.addressNormalization.normalize(dto);
    const sessionToken = randomBytes(24).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 86_400_000);

    await this.databaseService
      .prepare(
        `INSERT INTO "SessionAddress" (
           "sessionToken", "countryCode", "canton", "city", "postalCode",
           "street", "houseNumber", "latitude", "longitude", "formattedAddress",
           "source", "createdAt", "lastSeenAt", "expiresAt"
         ) VALUES (
           $sessionToken, $countryCode, $canton, $city, $postalCode,
           $street, $houseNumber, $latitude, $longitude, $formattedAddress,
           $source, $createdAt, $lastSeenAt, $expiresAt
         )`,
      )
      .run({
        $sessionToken: sessionToken,
        $countryCode: address.countryCode,
        $canton: address.canton,
        $city: address.city,
        $postalCode: address.postalCode,
        $street: address.street,
        $houseNumber: address.houseNumber,
        $latitude: address.latitude,
        $longitude: address.longitude,
        $formattedAddress: address.formattedAddress,
        $source: dto.source ?? 'postal_code',
        $createdAt: now.toISOString(),
        $lastSeenAt: now.toISOString(),
        $expiresAt: expiresAt.toISOString(),
      });

    return {
      sessionToken,
      address: { ...address, source: dto.source ?? 'postal_code', expiresAt },
    };
  }

  async getSessionAddress(sessionToken: string) {
    const row = await this.findSessionAddress(sessionToken);
    if (!row) {
      throw new NotFoundException('Session address not found or expired.');
    }
    return { sessionToken, address: this.sessionRowToAddress(row) };
  }

  // ===========================================================================
  // Discovery — the matching → availability → ranking pipeline
  // ===========================================================================

  async discover(dto: DiscoverRestaurantsDto) {
    const startedAt = Date.now();
    const requestId = randomUUID();
    const { context, sessionToken } = await this.resolveContext(dto);

    const coverage = await this.coverageService.resolve(context);
    const storeIds = [...coverage.keys()];

    if (storeIds.length === 0) {
      await this.writeLog({
        requestId,
        sessionToken,
        context,
        strategies: this.coverageService.strategiesFor(context),
        candidateCount: 0,
        eligibleCount: 0,
        returnedCount: 0,
        unavailableCount: 0,
        durationMs: Date.now() - startedAt,
      });
      return this.emptyResult(context, requestId, startedAt);
    }

    const stores = await this.hydrateStores(storeIds);

    const composed = stores.map((store) =>
      this.composeRestaurant(store, coverage.get(store.id)!),
    );
    // Facets reflect the full coverage set, so applying a category/cuisine
    // filter never hides the other options the customer could pick.
    const facets = this.computeFacets(composed);

    const filtered = this.applyFilters(composed, dto);

    const ranked = this.rankingService.rank(
      filtered.map((entry) => entry.rankingCandidate),
    );
    const rankByStore = new Map(ranked.map((result) => [result.storeId, result]));

    let results = filtered.map((entry) => {
      const rank = rankByStore.get(entry.id)!;
      return {
        ...entry.payload,
        ranking: {
          position: rank.position,
          score: rank.score,
          breakdown: rank.breakdown,
        },
      };
    });

    results = this.applySort(results, dto.sort ?? 'best_match');
    const total = results.length;
    const offset = Math.max(0, dto.offset ?? 0);
    const limit = dto.limit ?? DEFAULT_RESULT_LIMIT;
    const limited = results.slice(offset, offset + limit);

    const unavailableCount = results.filter((r) => !r.availability.available).length;

    await this.writeLog({
      requestId,
      sessionToken,
      context,
      strategies: this.coverageService.strategiesFor(context),
      candidateCount: storeIds.length,
      eligibleCount: results.length,
      returnedCount: limited.length,
      unavailableCount,
      durationMs: Date.now() - startedAt,
    });

    return {
      context: {
        countryCode: context.countryCode,
        postalCode: context.postalCode,
        latitude: context.latitude,
        longitude: context.longitude,
        matchStrategies: this.coverageService.strategiesFor(context),
      },
      restaurants: limited,
      facets,
      meta: {
        requestId,
        candidateCount: storeIds.length,
        eligibleCount: total,
        returnedCount: limited.length,
        unavailableCount,
        total,
        offset,
        limit,
        rankingVersion: this.rankingService.version,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  // ===========================================================================
  // Context resolution
  // ===========================================================================

  private async resolveContext(
    dto: DiscoverRestaurantsDto,
  ): Promise<{ context: MatchContext; sessionToken: string | null }> {
    if (dto.sessionToken) {
      const row = await this.findSessionAddress(dto.sessionToken);
      if (!row) {
        throw new NotFoundException('Session address not found or expired.');
      }
      // Touch the session so an active visitor's address does not age out.
      await this.databaseService
        .prepare(
          `UPDATE "SessionAddress" SET "lastSeenAt" = $now WHERE "sessionToken" = $token`,
        )
        .run({ $now: new Date().toISOString(), $token: dto.sessionToken });

      return {
        sessionToken: dto.sessionToken,
        context: {
          countryCode: row.countryCode,
          postalCode: row.postalCode,
          latitude: row.latitude,
          longitude: row.longitude,
        },
      };
    }

    if (dto.postalCode || (dto.latitude !== undefined && dto.longitude !== undefined)) {
      const address = this.addressNormalization.normalize({
        countryCode: dto.countryCode,
        postalCode: dto.postalCode,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
      });
      return {
        sessionToken: null,
        context: {
          countryCode: address.countryCode,
          postalCode: address.postalCode,
          latitude: address.latitude,
          longitude: address.longitude,
        },
      };
    }

    throw new BadRequestException(
      'Provide a sessionToken, a postalCode, or latitude+longitude.',
    );
  }

  private async findSessionAddress(sessionToken: string) {
    const row = (await this.databaseService
      .prepare(
        `SELECT * FROM "SessionAddress"
         WHERE "sessionToken" = $token AND "expiresAt" > NOW()
         LIMIT 1`,
      )
      .get({ $token: sessionToken })) as SessionAddressRow | undefined;
    return row ?? null;
  }

  private sessionRowToAddress(row: SessionAddressRow) {
    return {
      countryCode: row.countryCode,
      canton: row.canton,
      city: row.city,
      postalCode: row.postalCode,
      street: row.street,
      houseNumber: row.houseNumber,
      latitude: row.latitude,
      longitude: row.longitude,
      formattedAddress: row.formattedAddress,
      source: row.source,
      expiresAt: row.expiresAt,
    };
  }

  // ===========================================================================
  // Store hydration + composition
  // ===========================================================================

  private async hydrateStores(storeIds: string[]): Promise<StoreRow[]> {
    const now = new Date();
    const dayOfWeek = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ][now.getUTCDay()];
    const currentTime = now.toISOString().slice(11, 16);

    const rows = (await this.databaseService
      .prepare(
        `SELECT s."id", s."name", s."slug", s."category", s."description",
                s."imageUrl", s."status", s."isActive", s."acceptingOrders",
                s."isPromoted", s."discoveryWeight", s."city", s."postalCode",
                rev."averageRating", rev."totalReviews",
                (oh."isOpen" IS NOT NULL) AS "openNow"
         FROM "Store" s
         LEFT JOIN LATERAL (
           SELECT ROUND(AVG(r."rating")::numeric, 2) AS "averageRating",
                  COUNT(*)::int AS "totalReviews"
           FROM "StoreReview" r
           WHERE r."storeId" = s."id" AND r."status" = 'visible'
         ) rev ON TRUE
         LEFT JOIN LATERAL (
           SELECT 1 AS "isOpen"
           FROM "StoreOpeningHour" oh
           WHERE oh."storeId" = s."id"
             AND oh."dayOfWeek" = $dayOfWeek
             AND oh."isClosed" = FALSE
             AND oh."openTime" <= $currentTime
             AND oh."closeTime" > $currentTime
           LIMIT 1
         ) oh ON TRUE
         WHERE s."id" = ANY($storeIds::uuid[])`,
      )
      .all({
        $storeIds: storeIds,
        $dayOfWeek: dayOfWeek,
        $currentTime: currentTime,
      })) as unknown as StoreRow[];

    const cuisinesByStore = await this.fetchCuisinesForStores(storeIds);
    return rows.map((row) => ({
      ...row,
      cuisines: cuisinesByStore[row.id] ?? [],
    }));
  }

  /** Cuisine tags per store, primary cuisine first. */
  private async fetchCuisinesForStores(
    storeIds: string[],
  ): Promise<Record<string, StoreCuisineLite[]>> {
    if (storeIds.length === 0) return {};
    const rows = (await this.databaseService
      .prepare(
        `SELECT sc."storeId" AS "storeId", c."slug", c."name", c."emoji"
         FROM "StoreCuisine" sc
         JOIN "Cuisine" c ON c."id" = sc."cuisineId"
         WHERE sc."storeId" = ANY($storeIds::uuid[]) AND c."isActive" = TRUE
         ORDER BY sc."isPrimary" DESC, c."sortOrder" ASC, c."name" ASC`,
      )
      .all({ $storeIds: storeIds })) as Array<{
      storeId: string;
      slug: string;
      name: string;
      emoji: string | null;
    }>;

    const result: Record<string, StoreCuisineLite[]> = {};
    for (const row of rows) {
      (result[row.storeId] ??= []).push({
        slug: row.slug,
        name: row.name,
        emoji: row.emoji,
      });
    }
    return result;
  }

  private composeRestaurant(store: StoreRow, coverage: CoverageMatch): ComposedEntry {
    const reasons = this.availabilityReasons(store);
    const available = reasons.length === 0;
    const averageRating = toNumber(store.averageRating);
    const totalReviews = Number(store.totalReviews ?? 0);

    const rankingCandidate: RankingCandidate = {
      storeId: store.id,
      distanceKm: coverage.distanceKm,
      estimatedDeliveryMinutes: coverage.estimatedDeliveryMinutes,
      averageRating,
      totalReviews,
      isPromoted: Boolean(store.isPromoted),
      discoveryWeight: toNumber(store.discoveryWeight) ?? 1,
      isAvailable: available,
    };

    return {
      id: store.id,
      rankingCandidate,
      payload: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        category: store.category,
        description: store.description,
        imageUrl: store.imageUrl,
        coverage: {
          matched: true,
          serviceAreaName: coverage.serviceAreaName,
          matchStrategy: coverage.matchStrategy,
          deliveryFee: coverage.deliveryFee,
          minimumOrderAmount: coverage.minimumOrderAmount,
          freeDeliveryThreshold: coverage.freeDeliveryThreshold,
          estimatedDeliveryMinutes: coverage.estimatedDeliveryMinutes,
          distanceKm:
            coverage.distanceKm === null
              ? null
              : Math.round(coverage.distanceKm * 100) / 100,
        },
        availability: {
          available,
          openNow: Boolean(store.openNow),
          reasons,
        },
        reviewSummary: { averageRating, totalReviews },
        cuisines: store.cuisines,
      },
    };
  }

  private availabilityReasons(store: StoreRow): AvailabilityReason[] {
    const reasons: AvailabilityReason[] = [];
    if (store.status !== 'active') reasons.push('store_unpublished');
    if (!store.isActive) reasons.push('store_inactive');
    if (!store.acceptingOrders) reasons.push('not_accepting_orders');
    if (!store.openNow) reasons.push('closed_now');
    return reasons;
  }

  // ===========================================================================
  // Filtering + sorting
  // ===========================================================================

  private applyFilters(
    entries: ComposedEntry[],
    dto: DiscoverRestaurantsDto,
  ): ComposedEntry[] {
    const category = dto.category?.trim().toLowerCase() || null;
    const cuisineSet = new Set((dto.cuisines ?? []).map((slug) => slug.toLowerCase()));

    return entries.filter((entry) => {
      const { coverage, availability, category: storeCategory, cuisines } =
        entry.payload;
      if (dto.openNow && !availability.openNow) return false;
      if (dto.freeDelivery && (coverage.deliveryFee ?? 0) > 0) return false;
      if (
        dto.maxMinimumOrder !== undefined &&
        (coverage.minimumOrderAmount ?? 0) > dto.maxMinimumOrder
      ) {
        return false;
      }
      if (category && storeCategory.toLowerCase() !== category) return false;
      if (
        cuisineSet.size > 0 &&
        !cuisines.some((cuisine) => cuisineSet.has(cuisine.slug.toLowerCase()))
      ) {
        return false;
      }
      return true;
    });
  }

  /** Category + cuisine facet buckets, computed from the full coverage set. */
  private computeFacets(entries: ComposedEntry[]): {
    categories: DiscoveryFacet[];
    cuisines: DiscoveryFacet[];
  } {
    const categories = new Map<string, DiscoveryFacet>();
    const cuisines = new Map<string, DiscoveryFacet>();

    for (const entry of entries) {
      const categoryKey = entry.payload.category.toLowerCase();
      const category = categories.get(categoryKey);
      if (category) category.count += 1;
      else
        categories.set(categoryKey, {
          id: categoryKey,
          label: entry.payload.category,
          count: 1,
        });

      for (const cuisine of entry.payload.cuisines) {
        const cuisineKey = cuisine.slug.toLowerCase();
        const bucket = cuisines.get(cuisineKey);
        if (bucket) bucket.count += 1;
        else
          cuisines.set(cuisineKey, {
            id: cuisineKey,
            label: cuisine.name,
            count: 1,
          });
      }
    }

    const byCount = (a: DiscoveryFacet, b: DiscoveryFacet) =>
      b.count - a.count || a.label.localeCompare(b.label);
    return {
      categories: [...categories.values()].sort(byCount),
      cuisines: [...cuisines.values()].sort(byCount),
    };
  }

  private applySort(
    results: RestaurantResult[],
    sort: 'best_match' | 'eta' | 'delivery_fee' | 'rating' | 'distance' | 'min_order',
  ): RestaurantResult[] {
    if (sort === 'best_match') {
      return [...results].sort((a, b) => a.ranking.position - b.ranking.position);
    }
    const FAR = Number.MAX_SAFE_INTEGER;
    const sorted = [...results].sort((a, b) => {
      if (sort === 'eta') {
        return (
          (a.coverage.estimatedDeliveryMinutes ?? FAR) -
          (b.coverage.estimatedDeliveryMinutes ?? FAR)
        );
      }
      if (sort === 'delivery_fee') {
        return (
          (a.coverage.deliveryFee ?? FAR) - (b.coverage.deliveryFee ?? FAR)
        );
      }
      if (sort === 'distance') {
        return (a.coverage.distanceKm ?? FAR) - (b.coverage.distanceKm ?? FAR);
      }
      if (sort === 'min_order') {
        return (
          (a.coverage.minimumOrderAmount ?? FAR) -
          (b.coverage.minimumOrderAmount ?? FAR)
        );
      }
      return (b.reviewSummary.averageRating ?? 0) - (a.reviewSummary.averageRating ?? 0);
    });
    // Available restaurants always rank above covered-but-unavailable ones.
    return sorted.sort(
      (a, b) => Number(b.availability.available) - Number(a.availability.available),
    );
  }

  // ===========================================================================
  // Logging
  // ===========================================================================

  private emptyResult(context: MatchContext, requestId: string, startedAt: number) {
    return {
      context: {
        countryCode: context.countryCode,
        postalCode: context.postalCode,
        latitude: context.latitude,
        longitude: context.longitude,
        matchStrategies: this.coverageService.strategiesFor(context),
      },
      restaurants: [],
      facets: {
        categories: [] as DiscoveryFacet[],
        cuisines: [] as DiscoveryFacet[],
      },
      meta: {
        requestId,
        candidateCount: 0,
        eligibleCount: 0,
        returnedCount: 0,
        unavailableCount: 0,
        total: 0,
        offset: 0,
        limit: DEFAULT_RESULT_LIMIT,
        rankingVersion: this.rankingService.version,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  private async writeLog(entry: {
    requestId: string;
    sessionToken: string | null;
    context: MatchContext;
    strategies: string[];
    candidateCount: number;
    eligibleCount: number;
    returnedCount: number;
    unavailableCount: number;
    durationMs: number;
  }): Promise<void> {
    // Telemetry must never break the response — log and swallow failures.
    try {
      await this.databaseService
        .prepare(
          `INSERT INTO "DiscoveryLog" (
             "requestId", "sessionToken", "countryCode", "postalCode",
             "latitude", "longitude", "matchStrategies",
             "candidateCount", "eligibleCount", "returnedCount",
             "unavailableCount", "rankingVersion", "durationMs"
           ) VALUES (
             $requestId, $sessionToken, $countryCode, $postalCode,
             $latitude, $longitude, $matchStrategies::jsonb,
             $candidateCount, $eligibleCount, $returnedCount,
             $unavailableCount, $rankingVersion, $durationMs
           )`,
        )
        .run({
          $requestId: entry.requestId,
          $sessionToken: entry.sessionToken,
          $countryCode: entry.context.countryCode,
          $postalCode: entry.context.postalCode,
          $latitude: entry.context.latitude,
          $longitude: entry.context.longitude,
          $matchStrategies: JSON.stringify(entry.strategies),
          $candidateCount: entry.candidateCount,
          $eligibleCount: entry.eligibleCount,
          $returnedCount: entry.returnedCount,
          $unavailableCount: entry.unavailableCount,
          $rankingVersion: this.rankingService.version,
          $durationMs: entry.durationMs,
        });
    } catch (error) {
      this.logger.warn(
        `DiscoveryLog write failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

interface SessionAddressRow {
  sessionToken: string;
  countryCode: string;
  canton: string | null;
  city: string | null;
  postalCode: string | null;
  street: string | null;
  houseNumber: string | null;
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string | null;
  source: string;
  expiresAt: string;
}

export interface RestaurantCoverage {
  matched: boolean;
  serviceAreaName: string;
  matchStrategy: MatchStrategy;
  deliveryFee: number | null;
  minimumOrderAmount: number | null;
  freeDeliveryThreshold: number | null;
  estimatedDeliveryMinutes: number | null;
  distanceKm: number | null;
}

export interface RestaurantPayload {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  imageUrl: string | null;
  coverage: RestaurantCoverage;
  availability: {
    available: boolean;
    openNow: boolean;
    reasons: AvailabilityReason[];
  };
  reviewSummary: { averageRating: number | null; totalReviews: number };
  cuisines: StoreCuisineLite[];
}

interface ComposedEntry {
  id: string;
  rankingCandidate: RankingCandidate;
  payload: RestaurantPayload;
}

export interface RestaurantResult extends RestaurantPayload {
  ranking: { position: number; score: number; breakdown: RankingBreakdown };
}
