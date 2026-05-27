import { Module } from '@nestjs/common';
import { AdminAuditLogModule } from '../admin-audit-log/admin-audit-log.module';
import { SetupModule } from '../setup/setup.module';
import { TenantsModule } from '../tenants/tenants.module';
import { TenantPasswordSetupModule } from '../tenant-password-setup/tenant-password-setup.module';
import { SharedFileStorageModule } from '../shared-file-storage/shared-file-storage.module';
import { NotificationModule } from '../notification/notification.module';
import { TenantOnboardingController } from './tenant-onboarding.controller';
import { TenantOnboardingService } from './tenant-onboarding.service';
import { TenantOnboardingStore } from './tenant-onboarding.store';

@Module({
  imports: [
    TenantsModule,
    SharedFileStorageModule,
    AdminAuditLogModule,
    NotificationModule,
    SetupModule,
    TenantPasswordSetupModule,
  ],
  controllers: [TenantOnboardingController],
  providers: [TenantOnboardingStore, TenantOnboardingService],
  exports: [TenantOnboardingStore, TenantOnboardingService],
})
export class TenantOnboardingModule {}
