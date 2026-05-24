import { Module } from '@nestjs/common';
import { StoresModule } from '../stores/stores.module';
import {
  CustomerReviewsController,
  TenantStoreReviewsController,
  PublicStoreReviewsController,
} from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [StoresModule],
  controllers: [
    CustomerReviewsController,
    PublicStoreReviewsController,
    TenantStoreReviewsController,
  ],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
