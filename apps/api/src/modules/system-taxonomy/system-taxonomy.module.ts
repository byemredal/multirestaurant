import { Module } from '@nestjs/common';
import {
  AdminSystemTaxonomyController,
  SystemTaxonomyController,
} from './system-taxonomy.controller';
import { SystemTaxonomyService } from './system-taxonomy.service';

@Module({
  controllers: [SystemTaxonomyController, AdminSystemTaxonomyController],
  providers: [SystemTaxonomyService],
  exports: [SystemTaxonomyService],
})
export class SystemTaxonomyModule {}
