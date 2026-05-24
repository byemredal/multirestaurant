import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StoresModule } from '../stores/stores.module';
import { StoreSettingsModule } from '../store-settings/store-settings.module';
import { SystemTaxonomyModule } from '../system-taxonomy/system-taxonomy.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [AuthModule, StoresModule, StoreSettingsModule, SystemTaxonomyModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
