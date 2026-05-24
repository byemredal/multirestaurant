import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { SetupController } from './setup.controller';
import { SetupGuard } from './setup.guard';
import { SetupService } from './setup.service';
import { SetupStore } from './setup.store';
import { SystemController } from './system.controller';
import { SystemStateService } from './system-state.service';
import { SystemStateStore } from './system-state.store';

@Module({
  imports: [CommonModule],
  controllers: [SetupController, SystemController],
  providers: [
    SetupService,
    SetupStore,
    SetupGuard,
    SystemStateService,
    SystemStateStore,
  ],
  exports: [SetupStore],
})
export class SetupModule {}
