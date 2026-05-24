import { Module } from '@nestjs/common';
import { AddressNormalizationService } from './address-normalization.service';
import { CoverageService } from './coverage.service';
import { CustomerAddressController } from './customer-address.controller';
import { CustomerAddressService } from './customer-address.service';
import { DeliveryCoverageSyncService } from './delivery-coverage-sync.service';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { RankingService } from './ranking.service';

/**
 * Delivery coverage & restaurant discovery engine.
 * See apps/api/docs/delivery-discovery-engine.md.
 */
@Module({
  controllers: [DiscoveryController, CustomerAddressController],
  providers: [
    DiscoveryService,
    CoverageService,
    AddressNormalizationService,
    RankingService,
    CustomerAddressService,
    DeliveryCoverageSyncService,
  ],
  exports: [
    DiscoveryService,
    CustomerAddressService,
    DeliveryCoverageSyncService,
  ],
})
export class DiscoveryModule {}
