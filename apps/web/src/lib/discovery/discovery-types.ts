/**
 * Customer discovery — frontend domain types.
 *
 * These types are deliberately decoupled from backend DTOs: the API contract
 * layer (`discovery-api.ts`) maps raw responses into these shapes, so UI and
 * state code never depend on backend field naming. See `README.md`.
 */

// ─── Address / location ──────────────────────────────────────────────────────

/** ISO-3166-1 alpha-2; Switzerland-first platform. */
export type CountryCode = string;

export type LocationOrigin = 'session' | 'saved' | 'seed';

export type SessionAddressSource =
  | 'postal_code'
  | 'autocomplete'
  | 'geolocation'
  | 'manual';

/**
 * The resolved location the discovery engine runs against. Produced from a
 * session address, a saved customer address, or a seed (e.g. a region slug).
 */
export interface CustomerLocation {
  countryCode: CountryCode;
  postalCode: string | null;
  city: string | null;
  street: string | null;
  houseNumber: string | null;
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string;
  origin: LocationOrigin;
  /** Present when origin === 'saved'. */
  savedAddressId?: string;
}

/** A persisted customer address (authenticated users). */
export interface SavedAddress {
  id: string;
  label: string | null;
  countryCode: CountryCode;
  city: string;
  postalCode: string;
  street: string | null;
  houseNumber: string | null;
  formattedAddress: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
}

/** A normalized location-search hit (provider-agnostic). */
export interface LocationSuggestion {
  id: string;
  /** Primary line, e.g. "6300 Zug". */
  label: string;
  /** Secondary line, e.g. the district / canton. */
  secondaryLabel: string;
  postalCode: string;
  city: string;
  countryCode: CountryCode;
  latitude: number | null;
  longitude: number | null;
}

// ─── Restaurants ─────────────────────────────────────────────────────────────

/** Machine-readable reasons a covered restaurant is still not orderable. */
export type AvailabilityReason =
  | 'store_unpublished'
  | 'store_inactive'
  | 'not_accepting_orders'
  | 'closed_now';

export interface RestaurantAvailability {
  /** Coverage matched AND the store will serve an order right now. */
  available: boolean;
  openNow: boolean;
  reasons: AvailabilityReason[];
}

export interface RestaurantCoverage {
  serviceAreaName: string;
  deliveryFee: number | null;
  minimumOrderAmount: number | null;
  freeDeliveryThreshold: number | null;
  estimatedDeliveryMinutes: number | null;
  distanceKm: number | null;
}

export interface DiscoveryCuisine {
  id: string;
  slug: string;
  name: string;
  emoji: string | null;
}

export interface DiscoveryRestaurant {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  imageUrl: string | null;
  coverage: RestaurantCoverage;
  availability: RestaurantAvailability;
  rating: { average: number | null; count: number };
  cuisines: DiscoveryCuisine[];
  rankPosition: number;
}

/** A filter facet bucket — a category or cuisine with its result count. */
export interface DiscoveryFacet {
  id: string;
  label: string;
  count: number;
}

export interface DiscoveryFacets {
  categories: DiscoveryFacet[];
  cuisines: DiscoveryFacet[];
}

export interface DiscoveryMeta {
  candidateCount: number;
  returnedCount: number;
  unavailableCount: number;
  /** Total eligible results before pagination. */
  total: number;
}

export interface DiscoveryResult {
  restaurants: DiscoveryRestaurant[];
  facets: DiscoveryFacets;
  meta: DiscoveryMeta;
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export type DiscoverySort =
  | 'best_match'
  | 'eta'
  | 'delivery_fee'
  | 'rating'
  | 'distance'
  | 'min_order';

export interface DiscoveryFilters {
  openNow: boolean;
  freeDelivery: boolean;
  maxMinimumOrder: number | null;
  /**
   * URL-backed delivery-provider filter. The current backend discovery contract
   * does not expose provider matching yet, so this is stored/cleared in the UI
   * and intentionally not sent to the API until that contract exists.
   */
  deliveryProvider: 'platform_delivery' | 'restaurant_delivery' | null;
  /** Store category / merchant type; null = all. */
  category: string | null;
  /** Cuisine IDs; legacy slugs are still accepted by the API. */
  cuisines: string[];
  sort: DiscoverySort;
}

export const DEFAULT_DISCOVERY_FILTERS: DiscoveryFilters = {
  openNow: false,
  freeDelivery: false,
  maxMinimumOrder: null,
  deliveryProvider: null,
  category: null,
  cuisines: [],
  sort: 'best_match',
};

// ─── State machine ───────────────────────────────────────────────────────────

/**
 * Address-resolution state. Owned by `DiscoveryProvider`. Explicit by design —
 * never collapse these into booleans.
 */
export type AddressState =
  | 'NO_ADDRESS_SELECTED'
  | 'ADDRESS_LOADING'
  | 'SESSION_ADDRESS'
  | 'AUTH_USER_NO_ADDRESS'
  | 'AUTH_USER_DEFAULT_ADDRESS';

/** Restaurant-discovery state. Owned by `useDiscovery`. */
export type DiscoveryState =
  | 'DISCOVERY_IDLE'
  | 'DISCOVERY_LOADING'
  | 'DISCOVERY_EMPTY'
  | 'DISCOVERY_READY'
  | 'DISCOVERY_ERROR';

/** Input accepted when selecting a new location. */
export interface LocationSelectionInput {
  countryCode?: CountryCode;
  postalCode?: string;
  city?: string;
  street?: string;
  houseNumber?: string;
  latitude?: number | null;
  longitude?: number | null;
  formattedAddress?: string;
  source?: SessionAddressSource;
}
