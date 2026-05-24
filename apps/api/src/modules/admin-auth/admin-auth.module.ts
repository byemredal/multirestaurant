import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from '../../common/common.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminUsersStore } from './admin-users.store';

@Module({
  imports: [CommonModule, PassportModule],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminUsersStore],
  exports: [AdminAuthService, AdminUsersStore],
})
export class AdminAuthModule {}
