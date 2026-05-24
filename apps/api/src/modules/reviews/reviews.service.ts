import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { StoresService } from '../stores/stores.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { FlagReviewDto } from './dto/flag-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import {
  StoreReview,
  StoreReviewStatus,
  StoreReviewSummary,
  StoreReviewWithAuthor,
} from './entities/review.entity';

interface ReviewRow {
  id: string;
  storeId: string;
  orderId: string;
  customerAccountId: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: string;
  moderationNote: string | null;
  flaggedAt: string | Date | null;
  flaggedReason: string | null;
  tenantReplyBody: string | null;
  tenantReplyAt: string | Date | null;
  tenantReplyByTenantId: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface ReviewRowWithAuthor extends ReviewRow {
  authorFirstName: string;
  authorLastName: string;
}

interface OrderRow {
  id: string;
  customerAccountId: string;
  storeId: string;
  status: string;
  createdAt: string | Date;
}

interface EligibleOrderRow extends OrderRow {
  storeName: string;
  totalAmount: number;
  currencySnapshot: string;
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storesService: StoresService,
  ) {}

  /**
   * Creates a review for a completed order belonging to the customer.
   * Reject when the order is not completed yet (verified-purchase rule).
   */
  async createForCustomer(customerAccountId: string, dto: CreateReviewDto) {
    const order = (await this.databaseService
      .prepare(
        `SELECT "id", "customerAccountId", "storeId", "status", "createdAt"
         FROM "Order"
         WHERE "id" = $orderId`,
      )
      .get({ $orderId: dto.orderId })) as OrderRow | undefined;

    if (!order) {
      throw new NotFoundException('Order could not be found.');
    }
    if (order.customerAccountId !== customerAccountId) {
      throw new ForbiddenException('You can only review your own orders.');
    }
    if (order.status !== 'completed') {
      throw new ConflictException(
        'You can only review an order that has been completed.',
      );
    }

    const existing = await this.databaseService
      .prepare(`SELECT "id" FROM "StoreReview" WHERE "orderId" = $orderId`)
      .get<{ id: string }>({ $orderId: dto.orderId });
    if (existing) {
      throw new ConflictException('This order has already been reviewed.');
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    await this.databaseService
      .prepare(
        `INSERT INTO "StoreReview" (
          "id", "storeId", "orderId", "customerAccountId",
          "rating", "title", "body", "status",
          "createdAt", "updatedAt"
        ) VALUES (
          $id, $storeId, $orderId, $customerAccountId,
          $rating, $title, $body, 'visible',
          $createdAt, $updatedAt
        )`,
      )
      .run({
        $id: id,
        $storeId: order.storeId,
        $orderId: order.id,
        $customerAccountId: customerAccountId,
        $rating: dto.rating,
        $title: dto.title?.trim() || null,
        $body: dto.body?.trim() || null,
        $createdAt: now,
        $updatedAt: now,
      });

    const review = await this.findReviewByIdInternal(id);
    if (!review) {
      throw new NotFoundException('Failed to load the newly created review.');
    }
    return { review };
  }

  async listEligibleOrdersForCustomer(customerAccountId: string) {
    const orders = (await this.databaseService
      .prepare(
        `SELECT o."id", o."storeId", o."status", o."createdAt",
                o."totalAmount", o."currencySnapshot",
                r."name" AS "storeName"
         FROM "Order" o
         INNER JOIN "Store" r ON r."id" = o."storeId"
         LEFT JOIN "StoreReview" rr ON rr."orderId" = o."id"
         WHERE o."customerAccountId" = $customerAccountId
           AND o."status" = 'completed'
           AND rr."id" IS NULL
         ORDER BY o."createdAt" DESC
         LIMIT 20`,
      )
      .all({ $customerAccountId: customerAccountId })) as unknown as EligibleOrderRow[];

    return {
      orders: orders.map((order) => ({
        id: order.id,
        storeId: order.storeId,
        storeName: order.storeName,
        totalAmount: Number(order.totalAmount),
        currency: order.currencySnapshot,
        createdAt:
          order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt),
      })),
    };
  }

  async listForCustomer(customerAccountId: string) {
    const rows = (await this.databaseService
      .prepare(
        `SELECT rr.*, r."name" AS "storeName"
         FROM "StoreReview" rr
         INNER JOIN "Store" r ON r."id" = rr."storeId"
         WHERE rr."customerAccountId" = $customerAccountId
           AND rr."status" != 'deleted'
         ORDER BY rr."createdAt" DESC`,
      )
      .all({ $customerAccountId: customerAccountId })) as unknown as Array<
      ReviewRow & { storeName: string }
    >;

    return {
      reviews: rows.map((row) => ({
        ...this.mapReview(row),
        storeName: row.storeName,
      })),
    };
  }

  async deleteOwnReview(customerAccountId: string, reviewId: string) {
    const review = await this.findReviewByIdInternal(reviewId);
    if (!review) {
      throw new NotFoundException('Review could not be found.');
    }
    if (review.customerAccountId !== customerAccountId) {
      throw new ForbiddenException('You can only delete your own reviews.');
    }
    await this.databaseService
      .prepare(
        `UPDATE "StoreReview"
         SET "status" = 'deleted', "updatedAt" = NOW()
         WHERE "id" = $id`,
      )
      .run({ $id: reviewId });
    return { success: true };
  }

  /**
   * Public reviews list. Only visible/flagged-but-still-shown rows are returned.
   */
  async listPublicForStore(
    storeId: string,
    options: { limit?: number; offset?: number } = {},
  ) {
    await this.ensureStoreExists(storeId);
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
    const offset = Math.max(options.offset ?? 0, 0);

    const rows = (await this.databaseService
      .prepare(
        `SELECT rr.*, ca."firstName" AS "authorFirstName", ca."lastName" AS "authorLastName"
         FROM "StoreReview" rr
         INNER JOIN "CustomerAccount" ca ON ca."id" = rr."customerAccountId"
         WHERE rr."storeId" = $storeId
           AND rr."status" = 'visible'
         ORDER BY rr."createdAt" DESC
         LIMIT $limit OFFSET $offset`,
      )
      .all({
        $storeId: storeId,
        $limit: limit,
        $offset: offset,
      })) as unknown as ReviewRowWithAuthor[];

    return {
      reviews: rows.map((row) => this.mapReviewWithAuthor(row)),
      pagination: { limit, offset },
    };
  }

  async getPublicSummary(storeId: string): Promise<StoreReviewSummary> {
    await this.ensureStoreExists(storeId);
    const result = (await this.databaseService
      .prepare(
        `SELECT
            ROUND(AVG("rating")::numeric, 2) AS "averageRating",
            COUNT(*)::int AS "totalReviews",
            COUNT(*) FILTER (WHERE "rating" = 1)::int AS "rating1",
            COUNT(*) FILTER (WHERE "rating" = 2)::int AS "rating2",
            COUNT(*) FILTER (WHERE "rating" = 3)::int AS "rating3",
            COUNT(*) FILTER (WHERE "rating" = 4)::int AS "rating4",
            COUNT(*) FILTER (WHERE "rating" = 5)::int AS "rating5"
         FROM "StoreReview"
         WHERE "storeId" = $storeId AND "status" = 'visible'`,
      )
      .get({ $storeId: storeId })) as {
      averageRating: string | number | null;
      totalReviews: number;
      rating1: number;
      rating2: number;
      rating3: number;
      rating4: number;
      rating5: number;
    };

    return {
      averageRating: result.averageRating === null ? null : Number(result.averageRating),
      totalReviews: Number(result.totalReviews ?? 0),
      ratingDistribution: {
        1: Number(result.rating1 ?? 0),
        2: Number(result.rating2 ?? 0),
        3: Number(result.rating3 ?? 0),
        4: Number(result.rating4 ?? 0),
        5: Number(result.rating5 ?? 0),
      },
    };
  }

  async getSummariesForStoreIds(storeIds: string[]) {
    if (storeIds.length === 0) return {} as Record<string, StoreReviewSummary>;
    const rows = (await this.databaseService
      .prepare(
        `SELECT "storeId",
                ROUND(AVG("rating")::numeric, 2) AS "averageRating",
                COUNT(*)::int AS "totalReviews"
         FROM "StoreReview"
         WHERE "storeId" = ANY($storeIds::uuid[]) AND "status" = 'visible'
         GROUP BY "storeId"`,
      )
      .all({ $storeIds: storeIds })) as Array<{
      storeId: string;
      averageRating: string | number | null;
      totalReviews: number;
    }>;

    const result: Record<string, StoreReviewSummary> = {};
    for (const row of rows) {
      result[row.storeId] = {
        averageRating: row.averageRating === null ? null : Number(row.averageRating),
        totalReviews: Number(row.totalReviews ?? 0),
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }
    return result;
  }

  /**
   * Tenant-side: list reviews for an owned store, including hidden/flagged.
   */
  async listForTenant(storeId: string, ownerTenantId: string) {
    await this.ensureOwnedStore(storeId, ownerTenantId);

    const rows = (await this.databaseService
      .prepare(
        `SELECT rr.*, ca."firstName" AS "authorFirstName", ca."lastName" AS "authorLastName"
         FROM "StoreReview" rr
         INNER JOIN "CustomerAccount" ca ON ca."id" = rr."customerAccountId"
         WHERE rr."storeId" = $storeId
           AND rr."status" != 'deleted'
         ORDER BY rr."createdAt" DESC`,
      )
      .all({
        $storeId: storeId,
      })) as unknown as ReviewRowWithAuthor[];

    const summary = await this.getPublicSummary(storeId);
    return {
      reviews: rows.map((row) => this.mapReviewWithAuthor(row)),
      summary,
    };
  }

  async replyAsTenant(
    storeId: string,
    reviewId: string,
    ownerTenantId: string,
    dto: ReplyReviewDto,
  ) {
    await this.ensureOwnedStore(storeId, ownerTenantId);
    const review = await this.findReviewByIdInternal(reviewId);
    if (!review || review.storeId !== storeId) {
      throw new NotFoundException('Review could not be found for this store.');
    }
    if (review.status === 'deleted') {
      throw new BadRequestException('You cannot reply to a deleted review.');
    }

    const now = new Date().toISOString();
    await this.databaseService
      .prepare(
        `UPDATE "StoreReview"
         SET "tenantReplyBody" = $body,
             "tenantReplyAt" = $now,
             "tenantReplyByTenantId" = $tenantId,
             "updatedAt" = $now
         WHERE "id" = $id`,
      )
      .run({
        $id: reviewId,
        $body: dto.body.trim(),
        $now: now,
        $tenantId: ownerTenantId,
      });

    const updated = await this.findReviewByIdInternal(reviewId);
    return { review: updated };
  }

  async flagAsTenant(
    storeId: string,
    reviewId: string,
    ownerTenantId: string,
    dto: FlagReviewDto,
  ) {
    await this.ensureOwnedStore(storeId, ownerTenantId);
    const review = await this.findReviewByIdInternal(reviewId);
    if (!review || review.storeId !== storeId) {
      throw new NotFoundException('Review could not be found for this store.');
    }
    if (review.status === 'flagged' || review.status === 'deleted') {
      throw new BadRequestException('Review is already flagged or deleted.');
    }

    const now = new Date().toISOString();
    await this.databaseService
      .prepare(
        `UPDATE "StoreReview"
         SET "status" = 'flagged',
             "flaggedAt" = $now,
             "flaggedReason" = $reason,
             "updatedAt" = $now
         WHERE "id" = $id`,
      )
      .run({
        $id: reviewId,
        $now: now,
        $reason: dto.reason?.trim() || null,
      });

    return { review: await this.findReviewByIdInternal(reviewId) };
  }

  // ---------- helpers ----------

  private async findReviewByIdInternal(id: string): Promise<StoreReview | null> {
    const row = (await this.databaseService
      .prepare(`SELECT * FROM "StoreReview" WHERE "id" = $id`)
      .get({ $id: id })) as ReviewRow | undefined;
    return row ? this.mapReview(row) : null;
  }

  private async ensureStoreExists(storeId: string) {
    const store = await this.databaseService
      .prepare(`SELECT "id" FROM "Store" WHERE "id" = $id`)
      .get<{ id: string }>({ $id: storeId });
    if (!store) {
      throw new NotFoundException('Store could not be found.');
    }
  }

  private async ensureOwnedStore(storeId: string, ownerTenantId: string) {
    const store = await this.storesService.findOwnedStore(
      storeId,
      ownerTenantId,
    );
    if (!store) {
      throw new ForbiddenException('You can only manage reviews for your own stores.');
    }
    return store;
  }

  private mapReview(row: ReviewRow): StoreReview {
    return {
      id: row.id,
      storeId: row.storeId,
      orderId: row.orderId,
      customerAccountId: row.customerAccountId,
      rating: row.rating,
      title: row.title,
      body: row.body,
      status: row.status as StoreReviewStatus,
      moderationNote: row.moderationNote,
      flaggedAt: row.flaggedAt
        ? row.flaggedAt instanceof Date
          ? row.flaggedAt
          : new Date(row.flaggedAt)
        : null,
      flaggedReason: row.flaggedReason,
      tenantReplyBody: row.tenantReplyBody,
      tenantReplyAt: row.tenantReplyAt
        ? row.tenantReplyAt instanceof Date
          ? row.tenantReplyAt
          : new Date(row.tenantReplyAt)
        : null,
      tenantReplyByTenantId: row.tenantReplyByTenantId,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
    };
  }

  private mapReviewWithAuthor(row: ReviewRowWithAuthor): StoreReviewWithAuthor {
    const first = (row.authorFirstName ?? '').trim();
    const lastInitial = (row.authorLastName ?? '').trim().charAt(0);
    const displayName = first
      ? lastInitial
        ? `${first} ${lastInitial}.`
        : first
      : 'Müşteri';
    return {
      ...this.mapReview(row),
      authorDisplayName: displayName,
    };
  }
}
