import { Injectable } from '@nestjs/common';
import { AdminAuditLogStore } from './admin-audit-log.store';

@Injectable()
export class AdminAuditLogService {
  constructor(private readonly store: AdminAuditLogStore) {}

  log(input: {
    actorType: string;
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    applicationId?: string | null;
    tenantAccountId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    return this.store.create({
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      applicationId: input.applicationId ?? null,
      tenantAccountId: input.tenantAccountId ?? null,
      metadataJson: JSON.stringify(input.metadata ?? {}),
    });
  }

  listApplicationTimeline(applicationId: string) {
    return this.store.listForApplication(applicationId);
  }
}
