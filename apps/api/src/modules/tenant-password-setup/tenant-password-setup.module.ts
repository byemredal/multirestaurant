import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { NotificationModule } from '../notification/notification.module';
import { SetupModule } from '../setup/setup.module';
import { TenantsModule } from '../tenants/tenants.module';
import { TenantPasswordSetupController } from './tenant-password-setup.controller';
import { TenantPasswordSetupService } from './tenant-password-setup.service';
import { TenantPasswordSetupStore } from './tenant-password-setup.store';

@Module({
  imports: [CommonModule, NotificationModule, SetupModule, TenantsModule],
  controllers: [TenantPasswordSetupController],
  providers: [TenantPasswordSetupStore, TenantPasswordSetupService],
  exports: [TenantPasswordSetupService],
})
export class TenantPasswordSetupModule {}
