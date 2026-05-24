import { Module } from '@nestjs/common';
import { StoresModule } from '../stores/stores.module';
import { SystemTaxonomyModule } from '../system-taxonomy/system-taxonomy.module';
import {
  PublicStoreCommerceController,
  StoreSettingsController,
} from './store-settings.controller';
import { StoreSettingsService } from './store-settings.service';
import { StoreSettingsStore } from './store-settings.store';

@Module({
  imports: [StoresModule, SystemTaxonomyModule],
  controllers: [StoreSettingsController, PublicStoreCommerceController],
  providers: [StoreSettingsStore, StoreSettingsService],
  exports: [StoreSettingsStore, StoreSettingsService],
})
export class StoreSettingsModule {}
