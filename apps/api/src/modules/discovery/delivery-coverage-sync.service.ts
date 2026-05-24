import { randomUUID } from 'crypto';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

/**
 * A legacy `StoreDeliveryZone` as seen by the sync layer. Structurally
 * compatible with `StoreDeliveryZone` from the stores module, so callers can
 * pass that type directly without coupling the two modules.
 */
export interface LegacyDeliveryZoneInput {
  /** The legacy `StoreDeliveryZone.id` — becomes `legacyDeliveryZoneId`. */
  id: string;
  name: string;
  postalCodes: string[];
  radiusKm: number | null;
  minimumOrderAmount: number | null;
  deliveryFee: number | null;
  estimatedDeliveryMinutes: number | null;
}

const SWITZERLAND_ALIASES = new Set([
  'CH',
  'SWITZERLAND',
  'SCHWEIZ',
  'SUISSE',
  'SVIZZERA',
]);
const DEFAULT_COUNTRY = 'CH';

/**
 * Dual-write transition layer. Mirrors every legacy `StoreDeliveryZone` write
 * into the normalized coverage model (`StoreServiceArea` +
 * `StoreCoveragePostalCode`) so the two representations never drift.
 *
 * The normalized tables are the long-term source of truth; the legacy table is
 * kept for backward compatibility until all read paths are migrated. See
 * apps/api/docs/delivery-discovery-engine.md §9.
 */
@Injectable()
export class DeliveryCoverageSyncService {
  private readonly logger = new Logger(DeliveryCoverageSyncService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /** Normalize a free-text `Store.country` to an ISO-3166-1 alpha-2 code. */
  resolveCountryCode(rawCountry: string | null | undefined): string {
    const value = (rawCountry ?? '').trim().toUpperCase();
    if (!value) return DEFAULT_COUNTRY;
    if (SWITZERLAND_ALIASES.has(value)) return 'CH';
    if (/^[A-Z]{2}$/.test(value)) return value;
    return DEFAULT_COUNTRY;
  }

  /**
   * Re-derive a store's normalized coverage from its legacy delivery zones.
   *
   * MUST run inside an active transaction so the legacy and normalized writes
   * commit or roll back together — a partial write would create data drift.
   * Only legacy-derived areas (`legacyDeliveryZoneId IS NOT NULL`) are
   * replaced; radius/polygon areas added directly to the normalized model are
   * left untouched.
   */
  async syncFromLegacyZones(
    storeId: string,
    zones: LegacyDeliveryZoneInput[],
    storeCountry: string | null,
    timestamp: Date,
  ): Promise<void> {
    if (!this.databaseService.isTransactionActive()) {
      // Hard guard: a non-transactional sync could half-apply and drift.
      throw new InternalServerErrorException(
        'Delivery coverage sync must run inside a database transaction.',
      );
    }

    const countryCode = this.resolveCountryCode(storeCountry);
    const iso = timestamp.toISOString();

    // Remove the store's legacy-derived areas. The FK cascade clears their
    // StoreCoveragePostalCode rows. Independently-authored radius/polygon
    // areas (legacyDeliveryZoneId IS NULL) are deliberately preserved.
    await this.databaseService
      .prepare(
        `DELETE FROM "StoreServiceArea"
         WHERE "storeId" = $storeId AND "legacyDeliveryZoneId" IS NOT NULL`,
      )
      .run({ $storeId: storeId });

    const areaStatement = this.databaseService.prepare(
      `INSERT INTO "StoreServiceArea" (
         "id", "storeId", "name", "matchStrategy", "countryCode",
         "minimumOrderAmount", "deliveryFee", "estimatedDeliveryMinutes",
         "priority", "isActive", "legacyDeliveryZoneId", "createdAt", "updatedAt"
       ) VALUES (
         $id, $storeId, $name, 'postal_code', $countryCode,
         $minimumOrderAmount, $deliveryFee, $estimatedDeliveryMinutes,
         100, TRUE, $legacyDeliveryZoneId, $createdAt, $updatedAt
       )`,
    );
    const postalStatement = this.databaseService.prepare(
      `INSERT INTO "StoreCoveragePostalCode" (
         "id", "serviceAreaId", "storeId", "countryCode", "postalCode", "createdAt"
       ) VALUES (
         $id, $serviceAreaId, $storeId, $countryCode, $postalCode, $createdAt
       )
       ON CONFLICT ON CONSTRAINT "UQ_StoreCoveragePostalCode" DO NOTHING`,
    );

    let postalCount = 0;
    for (const zone of zones) {
      const serviceAreaId = randomUUID();
      // Legacy zones carry a radiusKm but no centre coordinate, so they cannot
      // form a valid radius area — they stay 'postal_code' strategy.
      await areaStatement.run({
        $id: serviceAreaId,
        $storeId: storeId,
        $name: zone.name,
        $countryCode: countryCode,
        $minimumOrderAmount: zone.minimumOrderAmount,
        $deliveryFee: zone.deliveryFee,
        $estimatedDeliveryMinutes: zone.estimatedDeliveryMinutes,
        $legacyDeliveryZoneId: zone.id,
        $createdAt: iso,
        $updatedAt: iso,
      });

      for (const postalCode of this.normalizePostalCodes(zone.postalCodes)) {
        await postalStatement.run({
          $id: randomUUID(),
          $serviceAreaId: serviceAreaId,
          $storeId: storeId,
          $countryCode: countryCode,
          $postalCode: postalCode,
          $createdAt: iso,
        });
        postalCount += 1;
      }
    }

    this.logger.debug(
      `Synced ${zones.length} legacy zone(s) / ${postalCount} postal code(s) ` +
        `into normalized coverage for store ${storeId}.`,
    );
  }

  /**
   * Standalone drift repair: re-derive a store's normalized coverage from its
   * current legacy zones, in its own transaction. Use for backfills or to
   * reconcile a store after a manual legacy edit.
   */
  async resyncStore(storeId: string): Promise<void> {
    await this.databaseService.transaction(async () => {
      const store = (await this.databaseService
        .prepare(`SELECT "country" FROM "Store" WHERE "id" = $id LIMIT 1`)
        .get({ $id: storeId })) as { country: string | null } | undefined;
      if (!store) return;

      const rows = (await this.databaseService
        .prepare(
          `SELECT "id", "name", "postalCodes", "radiusKm", "minimumOrderAmount",
                  "deliveryFee", "estimatedDeliveryMinutes"
           FROM "StoreDeliveryZone"
           WHERE "storeId" = $storeId`,
        )
        .all({ $storeId: storeId })) as Array<{
        id: string;
        name: string;
        postalCodes: string;
        radiusKm: number | null;
        minimumOrderAmount: number | null;
        deliveryFee: number | null;
        estimatedDeliveryMinutes: number | null;
      }>;

      const zones: LegacyDeliveryZoneInput[] = rows.map((row) => ({
        id: row.id,
        name: row.name,
        postalCodes: this.parsePostalCodes(row.postalCodes),
        radiusKm: row.radiusKm,
        minimumOrderAmount: row.minimumOrderAmount,
        deliveryFee: row.deliveryFee,
        estimatedDeliveryMinutes: row.estimatedDeliveryMinutes,
      }));

      await this.syncFromLegacyZones(storeId, zones, store.country, new Date());
    });
  }

  /** Trim, upper-case, drop empties and de-duplicate postal codes. */
  private normalizePostalCodes(postalCodes: string[]): string[] {
    const seen = new Set<string>();
    for (const raw of postalCodes ?? []) {
      const value = (raw ?? '').trim().toUpperCase();
      if (value) seen.add(value);
    }
    return [...seen];
  }

  /** Parse the legacy JSON-text `postalCodes` column defensively. */
  private parsePostalCodes(value: string): string[] {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : [];
    } catch {
      return [];
    }
  }
}
