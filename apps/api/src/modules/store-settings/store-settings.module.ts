import { Module } from '@nestjs/common';
import { SetupModule } from '../setup/setup.module';
import { StoresModule } from '../stores/stores.module';
import { SystemTaxonomyModule } from '../system-taxonomy/system-taxonomy.module';
import {
  PublicStoreCommerceController,
  StoreSettingsController,
} from './store-settings.controller';
import { StoreSettingsService } from './store-settings.service';
import { StoreSettingsStore } from './store-settings.store';

@Module({
  imports: [StoresModule, SystemTaxonomyModule, SetupModule],
  controllers: [StoreSettingsController, PublicStoreCommerceController],
  providers: [StoreSettingsStore, StoreSettingsService],
  exports: [StoreSettingsStore, StoreSettingsService],
})
export class StoreSettingsModule {}
