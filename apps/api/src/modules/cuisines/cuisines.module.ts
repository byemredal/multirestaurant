import { Module } from '@nestjs/common';
import { StoresModule } from '../stores/stores.module';
import { CuisinesService } from './cuisines.service';
import {
  TenantStoreCuisinesController,
  PublicCuisinesController,
  PublicStoreCuisinesController,
} from './cuisines.controller';

@Module({
  imports: [StoresModule],
  controllers: [
    PublicCuisinesController,
    PublicStoreCuisinesController,
    TenantStoreCuisinesController,
  ],
  providers: [CuisinesService],
  exports: [CuisinesService],
})
export class CuisinesModule {}
