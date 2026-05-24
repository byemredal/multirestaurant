import { Injectable } from '@nestjs/common';
import { RankingBreakdown } from './entities/discovery.entity';

/**
 * Ranking version stamped onto every {@link DiscoveryLog}. Bump this whenever
 * weights or signals change so historical results stay explainable.
 */
export const RANKING_VERSION = 'v1';

/** Weighted signal contributions — must sum to 1. */
export const RANKING_WEIGHTS = {
  distance: 0.22,
  eta: 0.22,
  rating: 0.26,
  popularity: 0.15,
  promoted: 0.15,
} as const;

/** Normalization caps for the linear signal scalers. */
const MAX_DISTANCE_KM = 15;
const MAX_ETA_MINUTES = 75;
const POPULARITY_CAP = 500;
/** Multiplier applied to covered-but-unavailable stores so they always sink. */
const UNAVAILABLE_DEMOTION = 0.1;

/** The signals one store contributes to ranking. */
export interface RankingCandidate {
  storeId: string;
  distanceKm: number | null;
  estimatedDeliveryMinutes: number | null;
  averageRating: number | null;
  totalReviews: number;
  isPromoted: boolean;
  discoveryWeight: number;
  isAvailable: boolean;
}

export interface RankedResult {
  storeId: string;
  position: number;
  score: number;
  breakdown: RankingBreakdown;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Signal-based, versioned ranking. The score is a weighted sum of normalized
 * (0..1) signals; covered-but-unavailable stores are demoted, not dropped.
 * Future AI ranking plugs in as one more signal — see docs §6.
 */
@Injectable()
export class RankingService {
  readonly version = RANKING_VERSION;

  rank(candidates: RankingCandidate[]): RankedResult[] {
    return candidates
      .map((candidate) => this.score(candidate))
      .sort((a, b) => b.score - a.score)
      .map((result, index) => ({ ...result, position: index + 1 }));
  }

  private score(candidate: RankingCandidate): Omit<RankedResult, 'position'> {
    const signals = {
      // A missing signal scores neutrally (0.5) rather than penalizing.
      distance:
        candidate.distanceKm === null
          ? 0.5
          : 1 - clamp01(candidate.distanceKm / MAX_DISTANCE_KM),
      eta:
        candidate.estimatedDeliveryMinutes === null
          ? 0.5
          : 1 - clamp01(candidate.estimatedDeliveryMinutes / MAX_ETA_MINUTES),
      rating:
        candidate.averageRating === null
          ? 0.5
          : clamp01(candidate.averageRating / 5),
      // Log-scaled so the first reviews matter most.
      popularity: clamp01(
        Math.log1p(candidate.totalReviews) / Math.log1p(POPULARITY_CAP),
      ),
      // Promotion blends the boolean flag with the tunable per-store weight.
      promoted: candidate.isPromoted
        ? clamp01(Math.max(1, candidate.discoveryWeight) / 3)
        : 0,
    };

    const breakdown: RankingBreakdown = {
      distance: RANKING_WEIGHTS.distance * signals.distance,
      eta: RANKING_WEIGHTS.eta * signals.eta,
      rating: RANKING_WEIGHTS.rating * signals.rating,
      popularity: RANKING_WEIGHTS.popularity * signals.popularity,
      promoted: RANKING_WEIGHTS.promoted * signals.promoted,
      availability: candidate.isAvailable ? 1 : UNAVAILABLE_DEMOTION,
    };

    const base =
      breakdown.distance +
      breakdown.eta +
      breakdown.rating +
      breakdown.popularity +
      breakdown.promoted;

    const score = base * breakdown.availability;

    return {
      storeId: candidate.storeId,
      score: Math.round(score * 1000) / 1000,
      breakdown: {
        distance: round(breakdown.distance),
        eta: round(breakdown.eta),
        rating: round(breakdown.rating),
        popularity: round(breakdown.popularity),
        promoted: round(breakdown.promoted),
        availability: breakdown.availability,
      },
    };
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
