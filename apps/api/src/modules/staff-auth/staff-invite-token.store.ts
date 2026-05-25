import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { StaffInviteToken } from './entities/staff-invite-token.entity';

interface StaffInviteTokenRow {
  id: string;
  staffAccountId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  createdByTenantAccountId: string | null;
  metadataJson: Record<string, unknown> | string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class StaffInviteTokenStore {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Issue a new invite token for `staffAccountId`.
   *
   * Returns the **raw** token to the caller exactly once. The raw value is
   * NEVER persisted — only `hashToken(raw)` lives in the DB. Existing
   * unused tokens for the same staff are atomically marked-used in the same
   * transaction so only one invite token is ever valid at a time.
   */
  async issueForStaff(args: {
    staffAccountId: string;
    createdByTenantAccountId: string;
    ttlMs: number;
    metadata?: Record<string, unknown>;
  }): Promise<{ rawToken: string; token: StaffInviteToken }> {
    const rawToken = StaffInviteTokenStore.generateRawToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + args.ttlMs);
    const token: StaffInviteToken = {
      id: randomUUID(),
      staffAccountId: args.staffAccountId,
      tokenHash: StaffInviteTokenStore.hashToken(rawToken),
      expiresAt,
      usedAt: null,
      createdByTenantAccountId: args.createdByTenantAccountId,
      metadata: args.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };

    await this.databaseService.transaction(async () => {
      // Revoke any prior outstanding tokens for the same staff so only one
      // invite is ever live. Equivalent to "burn previous, issue fresh".
      await this.databaseService
        .prepare(
          `UPDATE "StaffInviteToken"
           SET "usedAt" = $now, "updatedAt" = $now
           WHERE "staffAccountId" = $staffAccountId AND "usedAt" IS NULL`,
        )
        .run({
          $staffAccountId: args.staffAccountId,
          $now: now.toISOString(),
        });

      await this.databaseService
        .prepare(
          `INSERT INTO "StaffInviteToken" (
            "id", "staffAccountId", "tokenHash", "expiresAt", "usedAt",
            "createdByTenantAccountId", "metadataJson", "createdAt", "updatedAt"
          ) VALUES (
            $id, $staffAccountId, $tokenHash, $expiresAt, NULL,
            $createdByTenantAccountId, $metadataJson::jsonb, $createdAt, $updatedAt
          )`,
        )
        .run({
          $id: token.id,
          $staffAccountId: token.staffAccountId,
          $tokenHash: token.tokenHash,
          $expiresAt: token.expiresAt.toISOString(),
          $createdByTenantAccountId: token.createdByTenantAccountId,
          $metadataJson: JSON.stringify(token.metadata),
          $createdAt: token.createdAt.toISOString(),
          $updatedAt: token.updatedAt.toISOString(),
        });
    });

    return { rawToken, token };
  }

  /**
   * Look up a token by its **raw** value. The store hashes the input and
   * matches `tokenHash`. Returns null when no row matches — callers should
   * treat null, expired, and already-used the same: invalid token.
   */
  async findByRawToken(rawToken: string): Promise<StaffInviteToken | null> {
    const tokenHash = StaffInviteTokenStore.hashToken(rawToken);
    const row = (await this.databaseService
      .prepare(`SELECT * FROM "StaffInviteToken" WHERE "tokenHash" = $tokenHash`)
      .get({ $tokenHash: tokenHash })) as StaffInviteTokenRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  /**
   * Mark a token as used. Returns true if the row was untouched and got
   * marked here, false if it had already been used or did not exist —
   * which is how the accept-invite flow detects replay attempts atomically.
   */
  async markUsed(tokenId: string): Promise<boolean> {
    const now = new Date().toISOString();
    const result = await this.databaseService
      .prepare(
        `UPDATE "StaffInviteToken"
         SET "usedAt" = $now, "updatedAt" = $now
         WHERE "id" = $id AND "usedAt" IS NULL`,
      )
      .run({ $id: tokenId, $now: now });
    return (result.rowCount ?? 0) > 0;
  }

  /** Test helper: SHA-256(rawToken) → hex (32-byte hex string). */
  static hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /** Generates a 32-byte URL-safe raw token. Caller MUST treat as a secret. */
  static generateRawToken(): string {
    // 32 bytes = 256 bits of entropy → base64url is 43 chars, no padding.
    return randomBytes(32).toString('base64url');
  }

  private mapRow(row: StaffInviteTokenRow): StaffInviteToken {
    return {
      id: row.id,
      staffAccountId: row.staffAccountId,
      tokenHash: row.tokenHash,
      expiresAt: new Date(row.expiresAt),
      usedAt: row.usedAt ? new Date(row.usedAt) : null,
      createdByTenantAccountId: row.createdByTenantAccountId,
      metadata:
        typeof row.metadataJson === 'string'
          ? (JSON.parse(row.metadataJson) as Record<string, unknown>)
          : (row.metadataJson ?? {}),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}
