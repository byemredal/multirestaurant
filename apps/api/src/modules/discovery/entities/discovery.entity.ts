/**
 * Domain types for the delivery coverage & restaurant discovery engine.
 * See apps/api/docs/delivery-discovery-engine.md.
 */

/** Coverage matching strategies, ordered by rollout phase. */
export type MatchStrategy = 'postal_code' | 'radius' | 'polygon';

/** How a session address was captured. */
export type SessionAddressSource =
  | 'postal_code'
  | 'autocomplete'
  | 'geolocation'
  | 'manual';

/** Machine-readable reasons a covered store is still not orderable. */
export type AvailabilityReason =
  | 'store_unpublished'
  | 'store_inactive'
  | 'not_accepting_orders'
  | 'closed_now';

/**
 * The canonical address shape shared by saved and session addresses.
 * `country` is an ISO-3166-1 alpha-2 code.
 */
export interface NormalizedAddress {
  countryCode: string;
  canton: string | null;
  city: string | null;
  postalCode: string | null;
  street: string | null;
  houseNumber: string | null;
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string;
}

/**
 * The resolved input to the matching engine. Produced from a session address,
 * an explicit postal code / coordinate pair, or a saved customer address.
 */
export interface MatchContext {
  countryCode: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * A single store ↔ context coverage hit produced by one matcher. Carries the
 * delivery economics of the matched service area so downstream stages never
 * re-query.
 */
export interface CoverageMatch {
  storeId: string;
  serviceAreaId: string;
  serviceAreaName: string;
  matchStrategy: MatchStrategy;
  /** Great-circle distance to the area centre; null for postal-code matches. */
  distanceKm: number | null;
  minimumOrderAmount: number | null;
  deliveryFee: number | null;
  freeDeliveryThreshold: number | null;
  estimatedDeliveryMinutes: number | null;
  /** Lower wins when one store has several overlapping areas. */
  priority: number;
}

/** A matcher implements exactly one {@link MatchStrategy}. */
export interface CoverageMatcher {
  readonly strategy: MatchStrategy;
  /** Cheap precondition check — skip the matcher when the context lacks input. */
  supports(context: MatchContext): boolean;
  match(context: MatchContext): Promise<CoverageMatch[]>;
}

/** Per-store availability verdict, orthogonal to coverage. */
export interface AvailabilityState {
  available: boolean;
  openNow: boolean;
  reasons: AvailabilityReason[];
}

/** Ranking signal weights — see {@link RANKING_WEIGHTS}. */
export interface RankingBreakdown {
  distance: number;
  eta: number;
  rating: number;
  popularity: number;
  promoted: number;
  availability: number;
}
