import { Module } from '@nestjs/common';
import { DiscoveryModule } from '../discovery/discovery.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AdminStoresController } from './admin-stores.controller';
import { PublicStoresController, StoresController } from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  imports: [TenantsModule, DiscoveryModule],
  controllers: [StoresController, PublicStoresController, AdminStoresController],
  providers: [StoresService],
  exports: [StoresService],
})
export class StoresModule {}
