import { Module } from '@nestjs/common';
import { AdminAuditLogService } from './admin-audit-log.service';
import { AdminAuditLogStore } from './admin-audit-log.store';

@Module({
  providers: [AdminAuditLogStore, AdminAuditLogService],
  exports: [AdminAuditLogStore, AdminAuditLogService],
})
export class AdminAuditLogModule {}
