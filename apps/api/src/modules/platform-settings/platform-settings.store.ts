import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface SystemSettingRow {
  key: string;
  scope: string;
  valueJson: Record<string, unknown>;
}

/**
 * Thin store over the platform-wide `SystemSetting` key-value table
 * (see migration 0004 — created but previously unused).
 *
 * Strict opinion: callers MUST pass a tightly-scoped key (e.g. `geo.provider`)
 * and a JSON value object. The store does not invent keys or coerce shapes.
 */
@Injectable()
export class PlatformSettingsStore {
  constructor(private readonly databaseService: DatabaseService) {}

  async get(key: string): Promise<SystemSettingRow | null> {
    const row = (await this.databaseService
      .prepare(
        `SELECT "key", "scope", "valueJson"
           FROM "SystemSetting"
          WHERE "key" = $key
          LIMIT 1`,
      )
      .get({ $key: key })) as
      | { key: string; scope: string; valueJson: Record<string, unknown> | string }
      | undefined;

    if (!row) {
      return null;
    }

    // pg returns JSONB as an object; some drivers stringify — normalize.
    const valueJson =
      typeof row.valueJson === 'string'
        ? (JSON.parse(row.valueJson) as Record<string, unknown>)
        : row.valueJson;
    return { key: row.key, scope: row.scope, valueJson };
  }

  async set(
    key: string,
    valueJson: Record<string, unknown>,
    options?: { scope?: string; description?: string },
  ): Promise<SystemSettingRow> {
    const scope = options?.scope ?? 'platform';
    const now = new Date().toISOString();
    await this.databaseService
      .prepare(
        `INSERT INTO "SystemSetting" ("key", "scope", "valueJson", "description", "createdAt", "updatedAt")
         VALUES ($key, $scope, $valueJson, $description, $now, $now)
         ON CONFLICT ("key") DO UPDATE SET
           "scope" = EXCLUDED."scope",
           "valueJson" = EXCLUDED."valueJson",
           "description" = COALESCE(EXCLUDED."description", "SystemSetting"."description"),
           "updatedAt" = EXCLUDED."updatedAt"`,
      )
      .run({
        $key: key,
        $scope: scope,
        $valueJson: JSON.stringify(valueJson),
        $description: options?.description ?? null,
        $now: now,
      });

    return { key, scope, valueJson };
  }
}
