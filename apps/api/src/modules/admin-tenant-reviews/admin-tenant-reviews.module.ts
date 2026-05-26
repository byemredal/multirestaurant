import { Module } from '@nestjs/common';
import { AdminRoleGuard } from '../../common/security/guards/admin-role.guard';
import { AdminAuditLogModule } from '../admin-audit-log/admin-audit-log.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { MenuModule } from '../menu/menu.module';
import { TenantOnboardingModule } from '../tenant-onboarding/tenant-onboarding.module';
import { TenantsModule } from '../tenants/tenants.module';
import { StoreSettingsModule } from '../store-settings/store-settings.module';
import { StoresModule } from '../stores/stores.module';
import { SharedFileStorageModule } from '../shared-file-storage/shared-file-storage.module';
import { AdminDocumentReviewsController } from './admin-document-reviews.controller';
import { AdminComplianceCatalogController } from './admin-compliance-catalog.controller';
import { AdminTenantActivationController } from './admin-tenant-activation.controller';
import { AdminTenantApplicationsController } from './admin-tenant-applications.controller';
import { AdminTenantOversightController } from './admin-tenant-oversight.controller';
import { AdminTenantReviewsService } from './admin-tenant-reviews.service';

@Module({
  imports: [
    TenantOnboardingModule,
    AdminAuditLogModule,
    AdminAuthModule,
    TenantsModule,
    StoresModule,
    StoreSettingsModule,
    MenuModule,
    SharedFileStorageModule,
  ],
  controllers: [
    AdminComplianceCatalogController,
    AdminTenantApplicationsController,
    AdminDocumentReviewsController,
    AdminTenantActivationController,
    AdminTenantOversightController,
  ],
  providers: [AdminTenantReviewsService, AdminRoleGuard],
})
export class AdminTenantReviewsModule {}
