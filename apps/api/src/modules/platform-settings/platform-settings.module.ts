import { Module } from '@nestjs/common';
import { AdminPlatformSettingsController } from './admin-platform-settings.controller';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';
import { PlatformSettingsService } from './platform-settings.service';
import { PlatformSettingsStore } from './platform-settings.store';

@Module({
  controllers: [GeoController, AdminPlatformSettingsController],
  providers: [PlatformSettingsStore, PlatformSettingsService, GeoService],
  exports: [PlatformSettingsService, GeoService],
})
export class PlatformSettingsModule {}
