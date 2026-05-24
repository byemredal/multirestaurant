import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from '../../common/common.module';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantAccountsStore } from './tenants.store';
import { TenantStatusEventsService } from './tenant-status-events.service';
import { TenantJwtStrategy } from './strategies/tenant-jwt.strategy';

@Module({
  imports: [CommonModule, PassportModule],
  controllers: [TenantsController],
  providers: [
    TenantsService,
    TenantAccountsStore,
    TenantStatusEventsService,
    TenantJwtStrategy,
  ],
  exports: [TenantsService, TenantAccountsStore, TenantStatusEventsService],
})
export class TenantsModule {}
