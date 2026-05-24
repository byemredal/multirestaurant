import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { AuditLogEntry } from './entities/audit-log.entity';

@Injectable()
export class AdminAuditLogStore {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(input: Omit<AuditLogEntry, 'id' | 'createdAt'>): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = {
      ...input,
      id: randomUUID(),
      createdAt: new Date(),
    };

    await this.databaseService
      .prepare(
        `INSERT INTO "AuditLog" (
          "id", "actorType", "actorId", "action", "entityType", "entityId",
          "applicationId", "tenantAccountId", "metadataJson", "createdAt"
        ) VALUES (
          $id, $actorType, $actorId, $action, $entityType, $entityId,
          $applicationId, $tenantAccountId, $metadataJson, $createdAt
        )`,
      )
      .run({
        $id: entry.id,
        $actorType: entry.actorType,
        $actorId: entry.actorId,
        $action: entry.action,
        $entityType: entry.entityType,
        $entityId: entry.entityId,
        $applicationId: entry.applicationId,
        $tenantAccountId: entry.tenantAccountId,
        $metadataJson: entry.metadataJson,
        $createdAt: entry.createdAt.toISOString(),
      });

    return entry;
  }

  async listForApplication(applicationId: string): Promise<AuditLogEntry[]> {
    const rows = await this.databaseService
      .prepare(
        `SELECT * FROM "AuditLog"
         WHERE "applicationId" = $applicationId
         ORDER BY "createdAt" DESC`,
      )
      .all({ $applicationId: applicationId }) as AuditLogRow[];

    return rows.map((row) => this.map(row));
  }

  private map(row: AuditLogRow): AuditLogEntry {
    return {
      id: row.id,
      actorType: row.actorType,
      actorId: row.actorId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      applicationId: row.applicationId,
      tenantAccountId: row.tenantAccountId,
      metadataJson: row.metadataJson,
      createdAt: new Date(row.createdAt),
    };
  }
}

interface AuditLogRow {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  applicationId: string | null;
  tenantAccountId: string | null;
  metadataJson: string;
  createdAt: string;
}
