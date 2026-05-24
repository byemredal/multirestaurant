import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { Public } from '../../common/security/decorators/public.decorator';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { CreateReviewDto } from './dto/create-review.dto';
import { FlagReviewDto } from './dto/flag-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
@AuthTypes('customer')
@ApiTags('customer-reviews')
@ApiBearerAuth('bearer')
export class CustomerReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('eligible-orders')
  @ApiOperation({ summary: 'List completed orders that are eligible for review.' })
  @ApiOkResponse({ description: 'Returns the orders the customer can still review.' })
  listEligibleOrders(@Req() request: AuthenticatedRequest) {
    return this.reviewsService.listEligibleOrdersForCustomer(request.user.id);
  }

  @Get('mine')
  @ApiOperation({ summary: 'List reviews authored by the authenticated customer.' })
  listMine(@Req() request: AuthenticatedRequest) {
    return this.reviewsService.listForCustomer(request.user.id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a review for a completed order belonging to the customer.',
  })
  @ApiBody({ type: CreateReviewDto })
  @ApiCreatedResponse({ description: 'Review created for a verified-purchase order.' })
  @ApiUnauthorizedResponse({ description: 'Customer bearer token is missing or invalid.' })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createForCustomer(request.user.id, dto);
  }

  @Delete(':reviewId')
  @ApiOperation({ summary: 'Soft-delete a customer-owned review.' })
  @ApiParam({ name: 'reviewId', description: 'Review identifier.' })
  delete(
    @Req() request: AuthenticatedRequest,
    @Param('reviewId', new ParseUUIDPipe({ version: '4' })) reviewId: string,
  ) {
    return this.reviewsService.deleteOwnReview(request.user.id, reviewId);
  }
}

@Controller('public/stores/:storeId/reviews')
@Public()
@ApiTags('public-store-reviews')
export class PublicStoreReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List public reviews for a store.' })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  list(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const numericLimit = limit ? Number(limit) : undefined;
    const numericOffset = offset ? Number(offset) : undefined;
    return this.reviewsService.listPublicForStore(storeId, {
      limit: Number.isFinite(numericLimit) ? numericLimit : undefined,
      offset: Number.isFinite(numericOffset) ? numericOffset : undefined,
    });
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get aggregate rating summary for a store.' })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  summary(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
  ) {
    return this.reviewsService.getPublicSummary(storeId);
  }
}

@Controller('tenant/stores/:storeId/reviews')
@AuthTypes('tenant')
@ApiTags('tenant-store-reviews')
@ApiBearerAuth('bearer')
export class TenantStoreReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List reviews for a tenant-owned store.' })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  list(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reviewsService.listForTenant(storeId, request.user.id);
  }

  @Post(':reviewId/reply')
  @ApiOperation({ summary: 'Post an official tenant reply to a review.' })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  @ApiParam({ name: 'reviewId', description: 'Review identifier.' })
  @ApiBody({ type: ReplyReviewDto })
  reply(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Param('reviewId', new ParseUUIDPipe({ version: '4' })) reviewId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: ReplyReviewDto,
  ) {
    return this.reviewsService.replyAsTenant(
      storeId,
      reviewId,
      request.user.id,
      dto,
    );
  }

  @Patch(':reviewId/flag')
  @ApiOperation({ summary: 'Flag a review for moderation; hides it from the public list.' })
  @ApiParam({ name: 'storeId', description: 'Store identifier.' })
  @ApiParam({ name: 'reviewId', description: 'Review identifier.' })
  @ApiBody({ type: FlagReviewDto })
  flag(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Param('reviewId', new ParseUUIDPipe({ version: '4' })) reviewId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: FlagReviewDto,
  ) {
    return this.reviewsService.flagAsTenant(
      storeId,
      reviewId,
      request.user.id,
      dto,
    );
  }
}
