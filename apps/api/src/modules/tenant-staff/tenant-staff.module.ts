import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { TenantsModule } from '../tenants/tenants.module';
import { TenantMembershipStore } from './tenant-membership.store';
import { TenantStaffController } from './tenant-staff.controller';
import { TenantStaffService } from './tenant-staff.service';

@Module({
  imports: [CommonModule, StaffAuthModule, TenantsModule],
  controllers: [TenantStaffController],
  providers: [TenantStaffService, TenantMembershipStore],
  exports: [TenantStaffService],
})
export class TenantStaffModule {}
