import { Module } from '@nestjs/common';
import { SetupModule } from '../setup/setup.module';
import { PlatformConfigController } from './platform-config.controller';
import { PlatformConfigService } from './platform-config.service';

@Module({
  imports: [SetupModule],
  controllers: [PlatformConfigController],
  providers: [PlatformConfigService],
})
export class PlatformConfigModule {}
