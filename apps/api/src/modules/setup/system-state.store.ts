import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { SystemState } from './setup.constants';

export interface SystemStateRow {
  id: string;
  state: SystemState;
  initializingStartedAt: string | null;
  updatedAt: string;
}

@Injectable()
export class SystemStateStore {
  constructor(private readonly databaseService: DatabaseService) {}

  /** Reads the single system-state row, creating it if it is somehow absent. */
  async get(): Promise<SystemStateRow> {
    const existing = (await this.databaseService
      .prepare(`SELECT * FROM "SystemState" WHERE "id" = 'system'`)
      .get()) as SystemStateRow | undefined;

    if (existing) {
      return existing;
    }

    await this.databaseService
      .prepare(
        `INSERT INTO "SystemState" ("id", "state", "updatedAt")
         VALUES ('system', 'UNINITIALIZED', $now)
         ON CONFLICT ("id") DO NOTHING`,
      )
      .run({ $now: new Date().toISOString() });

    return (await this.databaseService
      .prepare(`SELECT * FROM "SystemState" WHERE "id" = 'system'`)
      .get()) as SystemStateRow;
  }

  /**
   * Atomically moves the system into INITIALIZING. The conditional UPDATE is
   * the duplicate-initialization guard: only one caller can win it. A stale
   * INITIALIZING claim (older than `staleBeforeIso`) can be reclaimed so a
   * crashed setup never locks the platform permanently.
   *
   * @returns true when this caller claimed the INITIALIZING state.
   */
  async claimInitializing(staleBeforeIso: string): Promise<boolean> {
    const now = new Date().toISOString();
    const result = await this.databaseService
      .prepare(
        `UPDATE "SystemState"
            SET "state" = 'INITIALIZING',
                "initializingStartedAt" = $now,
                "updatedAt" = $now
          WHERE "id" = 'system'
            AND (
              "state" = 'UNINITIALIZED'
              OR (
                "state" = 'INITIALIZING'
                AND "initializingStartedAt" < $staleBefore
              )
            )`,
      )
      .run({ $now: now, $staleBefore: staleBeforeIso });

    return (result.rowCount ?? 0) > 0;
  }

  /** Marks the bootstrap finished. */
  async markReady(): Promise<void> {
    await this.databaseService
      .prepare(
        `UPDATE "SystemState"
            SET "state" = 'READY',
                "initializingStartedAt" = NULL,
                "updatedAt" = $now
          WHERE "id" = 'system'`,
      )
      .run({ $now: new Date().toISOString() });
  }

  /**
   * Safe fallback after a failed init: returns the system to UNINITIALIZED so
   * setup can be retried. Never downgrades a READY system.
   */
  async resetToUninitialized(): Promise<void> {
    await this.databaseService
      .prepare(
        `UPDATE "SystemState"
            SET "state" = 'UNINITIALIZED',
                "initializingStartedAt" = NULL,
                "updatedAt" = $now
          WHERE "id" = 'system'
            AND "state" <> 'READY'`,
      )
      .run({ $now: new Date().toISOString() });
  }
}
