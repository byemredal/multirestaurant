import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from '../../common/common.module';
import { StaffAuthController } from './staff-auth.controller';
import { StaffAuthService } from './staff-auth.service';
import { StaffAuthStore } from './staff-auth.store';
import { StaffJwtStrategy } from './strategies/staff-jwt.strategy';

@Module({
  imports: [CommonModule, PassportModule],
  controllers: [StaffAuthController],
  providers: [StaffAuthService, StaffAuthStore, StaffJwtStrategy],
  exports: [StaffAuthService, StaffAuthStore],
})
export class StaffAuthModule {}
