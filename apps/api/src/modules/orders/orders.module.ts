import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LegalConsentModule } from '../legal-consent/legal-consent.module';
import { TenantsModule } from '../tenants/tenants.module';
import { StoresModule } from '../stores/stores.module';
import { StoreSettingsModule } from '../store-settings/store-settings.module';
import { SystemTaxonomyModule } from '../system-taxonomy/system-taxonomy.module';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersController } from './orders.controller';
import { StaffOrdersController } from './staff-orders.controller';
import { TenantOrdersController } from './tenant-orders.controller';
import { TenantTestOrdersController } from './tenant-test-orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    AuthModule,
    TenantsModule,
    StoresModule,
    StoreSettingsModule,
    SystemTaxonomyModule,
    LegalConsentModule,
  ],
  controllers: [
    OrdersController,
    TenantOrdersController,
    TenantTestOrdersController,
    StaffOrdersController,
    AdminOrdersController,
  ],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
