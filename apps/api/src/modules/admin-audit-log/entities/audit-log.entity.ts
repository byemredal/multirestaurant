export interface AuditLogEntry {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  applicationId: string | null;
  tenantAccountId: string | null;
  metadataJson: string;
  createdAt: Date;
}
