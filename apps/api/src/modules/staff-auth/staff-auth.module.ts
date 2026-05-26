import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from '../../common/common.module';
import { StoresModule } from '../stores/stores.module';
import { StaffAuthController } from './staff-auth.controller';
import { StaffAuthService } from './staff-auth.service';
import { StaffAuthStore } from './staff-auth.store';
import { StaffInviteTokenStore } from './staff-invite-token.store';
import { StaffJwtStrategy } from './strategies/staff-jwt.strategy';

@Module({
  imports: [CommonModule, PassportModule, StoresModule],
  controllers: [StaffAuthController],
  providers: [StaffAuthService, StaffAuthStore, StaffInviteTokenStore, StaffJwtStrategy],
  exports: [StaffAuthService, StaffAuthStore, StaffInviteTokenStore],
})
export class StaffAuthModule {}
