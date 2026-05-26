import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface InstallationProfileRow {
  id: 'install';
  countryCode: string;
  locale: string;
  currencyCode: string;
  timezone: string;
  packVersion: string;
  initializedAt: string;
  initializedByAdminId: string | null;
}

export interface UpsertInstallationProfileInput {
  countryCode: string;
  locale: string;
  currencyCode: string;
  timezone: string;
  packVersion: string;
  initializedByAdminId: string | null;
  initializedAt: string;
}

/**
 * Single-row InstallationProfile reader/writer. Reads are intentionally
 * uncached at this layer — the service in front of it owns the cache.
 */
@Injectable()
export class InstallationProfileStore {
  constructor(private readonly databaseService: DatabaseService) {}

  async find(): Promise<InstallationProfileRow | null> {
    const row = (await this.databaseService
      .prepare(`SELECT * FROM "InstallationProfile" WHERE "id" = 'install'`)
      .get()) as InstallationProfileRow | undefined;
    return row ?? null;
  }

  /**
   * Single-row insert. Setup is the only writer; the CHECK("id" = 'install')
   * constraint means a second insert raises a unique-constraint violation
   * which the service treats as "already initialized".
   */
  async insert(input: UpsertInstallationProfileInput): Promise<void> {
    await this.databaseService
      .prepare(
        `INSERT INTO "InstallationProfile" (
           "id", "countryCode", "locale", "currencyCode",
           "timezone", "packVersion",
           "initializedAt", "initializedByAdminId"
         ) VALUES (
           'install', $countryCode, $locale, $currencyCode,
           $timezone, $packVersion,
           $initializedAt, $initializedByAdminId
         )`,
      )
      .run({
        $countryCode: input.countryCode,
        $locale: input.locale,
        $currencyCode: input.currencyCode,
        $timezone: input.timezone,
        $packVersion: input.packVersion,
        $initializedAt: input.initializedAt,
        $initializedByAdminId: input.initializedByAdminId,
      });
  }
}
