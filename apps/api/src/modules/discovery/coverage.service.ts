import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  CoverageMatch,
  CoverageMatcher,
  MatchContext,
  MatchStrategy,
} from './entities/discovery.entity';

/** NUMERIC columns arrive from `pg` as strings — coerce defensively. */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

interface CoverageRow {
  storeId: string;
  serviceAreaId: string;
  serviceAreaName: string;
  minimumOrderAmount: string | number | null;
  deliveryFee: string | number | null;
  freeDeliveryThreshold: string | number | null;
  estimatedDeliveryMinutes: number | null;
  priority: number;
  distanceKm?: string | number | null;
}

function mapCoverageRow(row: CoverageRow, strategy: MatchStrategy): CoverageMatch {
  return {
    storeId: row.storeId,
    serviceAreaId: row.serviceAreaId,
    serviceAreaName: row.serviceAreaName,
    matchStrategy: strategy,
    distanceKm: toNumber(row.distanceKm),
    minimumOrderAmount: toNumber(row.minimumOrderAmount),
    deliveryFee: toNumber(row.deliveryFee),
    freeDeliveryThreshold: toNumber(row.freeDeliveryThreshold),
    estimatedDeliveryMinutes:
      row.estimatedDeliveryMinutes === null ? null : Number(row.estimatedDeliveryMinutes),
    priority: Number(row.priority ?? 100),
  };
}

const SERVICE_AREA_COLUMNS = `
  sa."storeId"                   AS "storeId",
  sa."id"                        AS "serviceAreaId",
  sa."name"                      AS "serviceAreaName",
  sa."minimumOrderAmount"        AS "minimumOrderAmount",
  sa."deliveryFee"               AS "deliveryFee",
  sa."freeDeliveryThreshold"     AS "freeDeliveryThreshold",
  sa."estimatedDeliveryMinutes"  AS "estimatedDeliveryMinutes",
  sa."priority"                  AS "priority"
`;

/**
 * Phase 1 — exact postal-code coverage.
 * Served by `IDX_StoreCoveragePostalCode_lookup (countryCode, postalCode)`.
 */
class PostalCodeMatcher implements CoverageMatcher {
  readonly strategy: MatchStrategy = 'postal_code';

  constructor(private readonly db: DatabaseService) {}

  supports(context: MatchContext): boolean {
    return Boolean(context.postalCode);
  }

  async match(context: MatchContext): Promise<CoverageMatch[]> {
    const rows = (await this.db
      .prepare(
        `SELECT ${SERVICE_AREA_COLUMNS}
         FROM "StoreCoveragePostalCode" cpc
         JOIN "StoreServiceArea" sa ON sa."id" = cpc."serviceAreaId"
         WHERE cpc."countryCode" = $countryCode
           AND cpc."postalCode" = $postalCode
           AND sa."isActive" = TRUE
           AND sa."matchStrategy" = 'postal_code'`,
      )
      .all({
        $countryCode: context.countryCode,
        $postalCode: context.postalCode,
      })) as unknown as CoverageRow[];

    return rows.map((row) => mapCoverageRow(row, this.strategy));
  }
}

/**
 * Phase 2 — geo-radius coverage. Haversine great-circle distance computed in
 * SQL; needs no PostGIS. Active once service areas carry radius data.
 */
class RadiusMatcher implements CoverageMatcher {
  readonly strategy: MatchStrategy = 'radius';

  constructor(private readonly db: DatabaseService) {}

  supports(context: MatchContext): boolean {
    return context.latitude !== null && context.longitude !== null;
  }

  async match(context: MatchContext): Promise<CoverageMatch[]> {
    const rows = (await this.db
      .prepare(
        `SELECT * FROM (
           SELECT ${SERVICE_AREA_COLUMNS},
                  sa."radiusKm" AS "radiusKm",
                  6371 * acos(LEAST(1, GREATEST(-1,
                    cos(radians($lat)) * cos(radians(sa."centerLatitude")) *
                    cos(radians(sa."centerLongitude") - radians($lng)) +
                    sin(radians($lat)) * sin(radians(sa."centerLatitude"))
                  ))) AS "distanceKm"
           FROM "StoreServiceArea" sa
           WHERE sa."matchStrategy" = 'radius'
             AND sa."isActive" = TRUE
             AND sa."countryCode" = $countryCode
             AND sa."centerLatitude" IS NOT NULL
             AND sa."centerLongitude" IS NOT NULL
             AND sa."radiusKm" IS NOT NULL
         ) m
         WHERE m."distanceKm" <= m."radiusKm"
         ORDER BY m."distanceKm" ASC`,
      )
      .all({
        $countryCode: context.countryCode,
        $lat: context.latitude,
        $lng: context.longitude,
      })) as unknown as CoverageRow[];

    return rows.map((row) => mapCoverageRow(row, this.strategy));
  }
}

/**
 * Phase 3 — polygon coverage via PostGIS `ST_Contains`. Stubbed until the
 * PostGIS migration adds the `geometry` column + GiST index (see docs §8):
 *
 *   SELECT cp."storeId", cp."serviceAreaId"
 *   FROM "StoreCoveragePolygon" cp
 *   JOIN "StoreServiceArea" sa ON sa."id" = cp."serviceAreaId"
 *   WHERE sa."isActive" = TRUE AND sa."matchStrategy" = 'polygon'
 *     AND ST_Contains(cp."area",
 *                     ST_SetSRID(ST_MakePoint($lng, $lat), 4326));
 */
class PolygonMatcher implements CoverageMatcher {
  readonly strategy: MatchStrategy = 'polygon';

  /** Disabled until PostGIS is enabled — the registry simply skips it. */
  supports(): boolean {
    return false;
  }

  async match(): Promise<CoverageMatch[]> {
    return [];
  }
}

/**
 * Runs every matcher whose `supports()` precondition holds, then collapses the
 * union to the best coverage row per store (lowest priority, then distance,
 * then delivery fee).
 */
@Injectable()
export class CoverageService {
  private readonly logger = new Logger(CoverageService.name);
  private readonly matchers: CoverageMatcher[];

  constructor(private readonly databaseService: DatabaseService) {
    this.matchers = [
      new PostalCodeMatcher(databaseService),
      new RadiusMatcher(databaseService),
      new PolygonMatcher(),
    ];
  }

  /** Strategies that actually ran for the given context — for logging. */
  strategiesFor(context: MatchContext): MatchStrategy[] {
    return this.matchers
      .filter((matcher) => matcher.supports(context))
      .map((matcher) => matcher.strategy);
  }

  async resolve(context: MatchContext): Promise<Map<string, CoverageMatch>> {
    const active = this.matchers.filter((matcher) => matcher.supports(context));

    const results = await Promise.all(
      active.map(async (matcher) => {
        try {
          return await matcher.match(context);
        } catch (error) {
          // A failing strategy must not sink the whole discovery request.
          this.logger.error(
            `Coverage matcher "${matcher.strategy}" failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          return [] as CoverageMatch[];
        }
      }),
    );

    const best = new Map<string, CoverageMatch>();
    for (const match of results.flat()) {
      const current = best.get(match.storeId);
      if (!current || this.isBetter(match, current)) {
        best.set(match.storeId, match);
      }
    }
    return best;
  }

  private isBetter(candidate: CoverageMatch, current: CoverageMatch): boolean {
    if (candidate.priority !== current.priority) {
      return candidate.priority < current.priority;
    }
    const candidateDistance = candidate.distanceKm ?? Number.POSITIVE_INFINITY;
    const currentDistance = current.distanceKm ?? Number.POSITIVE_INFINITY;
    if (candidateDistance !== currentDistance) {
      return candidateDistance < currentDistance;
    }
    return (candidate.deliveryFee ?? 0) < (current.deliveryFee ?? 0);
  }
}
