import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
import { StoresModule } from '../stores/stores.module';
import { SetupModule } from '../setup/setup.module';
import { MenuController, PublicMenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  imports: [TenantsModule, StoresModule, SetupModule],
  controllers: [MenuController, PublicMenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
