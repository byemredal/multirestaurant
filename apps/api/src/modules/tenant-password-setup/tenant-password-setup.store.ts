import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export type PasswordSetupPurpose = 'initial_password_setup' | 'password_reset';
export type PasswordSetupDeliveryStatus = 'queued' | 'sent' | 'failed' | 'unavailable';

export interface PasswordSetupTokenRow {
  id: string;
  tenantAccountId: string;
  tokenHash: string;
  purpose: PasswordSetupPurpose;
  expiresAt: Date;
  consumedAt: Date | null;
  createdByAdminId: string | null;
  sentToEmail: string | null;
  sentToPhone: string | null;
  deliveryStatus: PasswordSetupDeliveryStatus | null;
  deliveryErrorCode: string | null;
  createdAt: Date;
}

interface PasswordSetupTokenDbRow {
  id: string;
  tenantAccountId: string;
  tokenHash: string;
  purpose: string;
  expiresAt: string;
  consumedAt: string | null;
  createdByAdminId: string | null;
  sentToEmail: string | null;
  sentToPhone: string | null;
  deliveryStatus: string | null;
  deliveryErrorCode: string | null;
  createdAt: string;
}

@Injectable()
export class TenantPasswordSetupStore {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(input: {
    tenantAccountId: string;
    tokenHash: string;
    purpose: PasswordSetupPurpose;
    expiresAt: Date;
    createdByAdminId: string | null;
    sentToEmail: string | null;
    sentToPhone: string | null;
  }): Promise<PasswordSetupTokenRow> {
    const id = randomUUID();
    const createdAt = new Date();
    await this.databaseService
      .prepare(
        `INSERT INTO "TenantPasswordSetupToken" (
            "id","tenantAccountId","tokenHash","purpose","expiresAt",
            "createdByAdminId","sentToEmail","sentToPhone","createdAt"
         ) VALUES (
            $id,$tenantAccountId,$tokenHash,$purpose,$expiresAt,
            $createdByAdminId,$sentToEmail,$sentToPhone,$createdAt
         )`,
      )
      .run({
        $id: id,
        $tenantAccountId: input.tenantAccountId,
        $tokenHash: input.tokenHash,
        $purpose: input.purpose,
        $expiresAt: input.expiresAt.toISOString(),
        $createdByAdminId: input.createdByAdminId,
        $sentToEmail: input.sentToEmail,
        $sentToPhone: input.sentToPhone,
        $createdAt: createdAt.toISOString(),
      });
    return {
      id,
      tenantAccountId: input.tenantAccountId,
      tokenHash: input.tokenHash,
      purpose: input.purpose,
      expiresAt: input.expiresAt,
      consumedAt: null,
      createdByAdminId: input.createdByAdminId,
      sentToEmail: input.sentToEmail,
      sentToPhone: input.sentToPhone,
      deliveryStatus: null,
      deliveryErrorCode: null,
      createdAt,
    };
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordSetupTokenRow | null> {
    const row = (await this.databaseService
      .prepare(`SELECT * FROM "TenantPasswordSetupToken" WHERE "tokenHash" = $tokenHash LIMIT 1`)
      .get({ $tokenHash: tokenHash })) as PasswordSetupTokenDbRow | undefined;
    return row ? this.map(row) : null;
  }

  /**
   * Most-recent token for a tenant. Used by the tenant workspace to surface a
   * public-safe summary of "what we tried to deliver" on the approved screen
   * (`sent` / `queued` / `failed` / `unavailable`) without ever exposing the
   * raw token, the token hash, or the link.
   */
  async findLatestForTenant(tenantAccountId: string): Promise<PasswordSetupTokenRow | null> {
    const row = (await this.databaseService
      .prepare(
        `SELECT * FROM "TenantPasswordSetupToken"
          WHERE "tenantAccountId" = $tenantAccountId
          ORDER BY "createdAt" DESC
          LIMIT 1`,
      )
      .get({ $tenantAccountId: tenantAccountId })) as PasswordSetupTokenDbRow | undefined;
    return row ? this.map(row) : null;
  }

  async setDeliveryStatus(
    id: string,
    deliveryStatus: PasswordSetupDeliveryStatus,
    deliveryErrorCode: string | null,
  ): Promise<void> {
    await this.databaseService
      .prepare(
        `UPDATE "TenantPasswordSetupToken"
           SET "deliveryStatus" = $deliveryStatus,
               "deliveryErrorCode" = $deliveryErrorCode
         WHERE "id" = $id`,
      )
      .run({
        $id: id,
        $deliveryStatus: deliveryStatus,
        $deliveryErrorCode: deliveryErrorCode,
      });
  }

  async consumeIfActive(id: string, consumedAt: Date): Promise<boolean> {
    const result = await this.databaseService
      .prepare(
        `UPDATE "TenantPasswordSetupToken"
           SET "consumedAt" = $consumedAt
         WHERE "id" = $id
           AND "consumedAt" IS NULL
           AND "expiresAt" > $consumedAt`,
      )
      .run({ $id: id, $consumedAt: consumedAt.toISOString() });
    return result.rowCount === 1;
  }

  /**
   * Invalidate every still-active token for the tenant. Called when issuing
   * a fresh one so an old, still-in-the-inbox link cannot be replayed.
   */
  async invalidateActiveForTenant(tenantAccountId: string, now: Date): Promise<void> {
    await this.databaseService
      .prepare(
        `UPDATE "TenantPasswordSetupToken"
           SET "consumedAt" = $now
         WHERE "tenantAccountId" = $tenantAccountId
           AND "consumedAt" IS NULL`,
      )
      .run({
        $tenantAccountId: tenantAccountId,
        $now: now.toISOString(),
      });
  }

  private map(row: PasswordSetupTokenDbRow): PasswordSetupTokenRow {
    return {
      id: row.id,
      tenantAccountId: row.tenantAccountId,
      tokenHash: row.tokenHash,
      purpose:
        row.purpose === 'initial_password_setup' || row.purpose === 'password_reset'
          ? row.purpose
          : 'initial_password_setup',
      expiresAt: new Date(row.expiresAt),
      consumedAt: row.consumedAt ? new Date(row.consumedAt) : null,
      createdByAdminId: row.createdByAdminId,
      sentToEmail: row.sentToEmail,
      sentToPhone: row.sentToPhone,
      deliveryStatus:
        row.deliveryStatus === 'queued' ||
        row.deliveryStatus === 'sent' ||
        row.deliveryStatus === 'failed' ||
        row.deliveryStatus === 'unavailable'
          ? row.deliveryStatus
          : null,
      deliveryErrorCode: row.deliveryErrorCode,
      createdAt: new Date(row.createdAt),
    };
  }
}
