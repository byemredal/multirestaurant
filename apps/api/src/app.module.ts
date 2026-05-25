import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { CommonModule } from './common/common.module';
import { AccessTokenGuard } from './common/security/guards/access-token.guard';
import { authConfig } from './config/auth.config';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { stripeConfig } from './config/stripe.config';
import { validateEnvironment } from './config/environment.validation';
import { DatabaseModule } from './database/database.module';
import { AdminAuditLogModule } from './modules/admin-audit-log/admin-audit-log.module';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { AdminTenantReviewsModule } from './modules/admin-tenant-reviews/admin-tenant-reviews.module';
import { AuthModule } from './modules/auth/auth.module';
import { CartModule } from './modules/cart/cart.module';
import { CuisinesModule } from './modules/cuisines/cuisines.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { LegalConsentModule } from './modules/legal-consent/legal-consent.module';
import { MenuModule } from './modules/menu/menu.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PlatformConfigModule } from './modules/platform-config/platform-config.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { TenantOnboardingModule } from './modules/tenant-onboarding/tenant-onboarding.module';
import { StoresModule } from './modules/stores/stores.module';
import { StoreSettingsModule } from './modules/store-settings/store-settings.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SetupModule } from './modules/setup/setup.module';
import { StaffAuthModule } from './modules/staff-auth/staff-auth.module';
import { TenantStaffModule } from './modules/tenant-staff/tenant-staff.module';
import { SharedFileStorageModule } from './modules/shared-file-storage/shared-file-storage.module';
import { SystemTaxonomyModule } from './modules/system-taxonomy/system-taxonomy.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, databaseConfig, stripeConfig],
      validate: validateEnvironment,
      expandVariables: true,
    }),
    DatabaseModule,
    CommonModule,
    SetupModule,
    PlatformConfigModule,
    SystemTaxonomyModule,
    SharedFileStorageModule,
    AdminAuditLogModule,
    AdminAuthModule,
    TenantOnboardingModule,
    AdminTenantReviewsModule,
    AuthModule,
    StaffAuthModule,
    CartModule,
    TenantsModule,
    TenantStaffModule,
    StoresModule,
    StoreSettingsModule,
    MenuModule,
    OrdersModule,
    PaymentsModule,
    CuisinesModule,
    ReviewsModule,
    LegalConsentModule,
    DiscoveryModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },
  ],
})
export class AppModule {}
