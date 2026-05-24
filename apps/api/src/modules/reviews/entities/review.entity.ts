export type StoreReviewStatus = 'visible' | 'hidden' | 'flagged' | 'deleted';

export interface StoreReview {
  id: string;
  storeId: string;
  orderId: string;
  customerAccountId: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: StoreReviewStatus;
  moderationNote: string | null;
  flaggedAt: Date | null;
  flaggedReason: string | null;
  tenantReplyBody: string | null;
  tenantReplyAt: Date | null;
  tenantReplyByTenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoreReviewWithAuthor extends StoreReview {
  authorDisplayName: string;
}

export interface StoreReviewSummary {
  averageRating: number | null;
  totalReviews: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
}
