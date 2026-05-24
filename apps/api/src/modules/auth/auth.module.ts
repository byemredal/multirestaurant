import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from '../../common/common.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CustomerAccountsStore } from './auth.store';
import { CustomerLoyaltyStore } from './customer-loyalty.store';
import { CustomerJwtStrategy } from './strategies/customer-jwt.strategy';

@Module({
  imports: [CommonModule, PassportModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    CustomerAccountsStore,
    CustomerLoyaltyStore,
    CustomerJwtStrategy,
  ],
  exports: [AuthService, CustomerAccountsStore, CustomerLoyaltyStore],
})
export class AuthModule {}
