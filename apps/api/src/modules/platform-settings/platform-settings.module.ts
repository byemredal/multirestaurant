import { Module } from '@nestjs/common';
import { SetupModule } from '../setup/setup.module';
import { AdminPlatformSettingsController } from './admin-platform-settings.controller';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';
import { PlatformSettingsService } from './platform-settings.service';
import { PlatformSettingsStore } from './platform-settings.store';

@Module({
  imports: [SetupModule],
  controllers: [GeoController, AdminPlatformSettingsController],
  providers: [PlatformSettingsStore, PlatformSettingsService, GeoService],
  exports: [PlatformSettingsService, GeoService],
})
export class PlatformSettingsModule {}
