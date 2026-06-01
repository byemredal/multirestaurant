/**
 * Customer discovery — API contract layer.
 *
 * The ONLY module that knows backend URLs and DTO field names. Everything
 * above it consumes the mapped frontend domain types from `discovery-types.ts`.
 * Discovery logic stays backend-driven — this layer never filters or ranks.
 */

import { apiBaseUrl } from '@/lib/config';
import type {
  CustomerLocation,
  DiscoveryFilters,
  DiscoveryResult,
  DiscoveryRestaurant,
  LocationSelectionInput,
  SavedAddress,
} from './discovery-types';

export class DiscoveryApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'DiscoveryApiError';
  }
}

/**
 * Stable backend error codes → user-facing Turkish messages. Keeps raw codes
 * out of the UI; unknown codes fall back to a generic message.
 */
const ERROR_CODE_MESSAGES: Record<string, string> = {
  geo_country_mismatch: 'Girdiğin adres platformun hizmet verdiği ülkede değil.',
  invalid_postal_code: 'Bu posta kodu geçerli değil. Lütfen kontrol et.',
};

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  authToken?: string;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.authToken) headers.Authorization = `Bearer ${options.authToken}`;

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (!response.ok) {
    let code: string | undefined;
    try {
      const body = (await response.json()) as { code?: string };
      if (typeof body?.code === 'string') code = body.code;
    } catch {
      // Non-JSON error body — fall back to the generic message below.
    }
    const message =
      (code && ERROR_CODE_MESSAGES[code]) ||
      'İsteğin tamamlanamadı. Lütfen tekrar dene.';
    throw new DiscoveryApiError(message, response.status, code);
  }
  return (await response.json()) as T;
}

// ─── Backend DTO shapes (internal) ───────────────────────────────────────────

interface BackendAddress {
  countryCode?: string;
  city?: string | null;
  postalCode?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  formattedAddress?: string | null;
}

interface BackendSavedAddress extends BackendAddress {
  id: string;
  label?: string | null;
  isDefault?: boolean;
}

interface BackendRestaurant {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  imageUrl: string | null;
  coverage: {
    serviceAreaName: string;
    deliveryFee: number | null;
    minimumOrderAmount: number | null;
    freeDeliveryThreshold: number | null;
    estimatedDeliveryMinutes: number | null;
    distanceKm: number | null;
  };
  availability: {
    available: boolean;
    openNow: boolean;
    reasons: string[];
  };
  reviewSummary: { averageRating: number | null; totalReviews: number };
  ranking: { position: number };
  cuisines?: Array<{ id?: string; slug: string; name: string; emoji: string | null }>;
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function toCustomerLocation(
  raw: BackendAddress,
  origin: CustomerLocation['origin'],
  savedAddressId?: string,
): CustomerLocation {
  return {
    countryCode: raw.countryCode ?? 'CH',
    postalCode: raw.postalCode ?? null,
    city: raw.city ?? null,
    street: raw.street ?? null,
    houseNumber: raw.houseNumber ?? null,
    latitude: raw.latitude ?? null,
    longitude: raw.longitude ?? null,
    formattedAddress:
      raw.formattedAddress ?? raw.postalCode ?? raw.city ?? 'Bilinmeyen konum',
    origin,
    ...(savedAddressId ? { savedAddressId } : {}),
  };
}

function toSavedAddress(raw: BackendSavedAddress): SavedAddress {
  return {
    id: raw.id,
    label: raw.label ?? null,
    countryCode: raw.countryCode ?? 'CH',
    city: raw.city ?? '',
    postalCode: raw.postalCode ?? '',
    street: raw.street ?? null,
    houseNumber: raw.houseNumber ?? null,
    formattedAddress: raw.formattedAddress ?? raw.postalCode ?? '',
    latitude: raw.latitude ?? null,
    longitude: raw.longitude ?? null,
    isDefault: Boolean(raw.isDefault),
  };
}

export function savedAddressToLocation(address: SavedAddress): CustomerLocation {
  return {
    countryCode: address.countryCode,
    postalCode: address.postalCode || null,
    city: address.city || null,
    street: address.street,
    houseNumber: address.houseNumber,
    latitude: address.latitude,
    longitude: address.longitude,
    formattedAddress: address.formattedAddress,
    origin: 'saved',
    savedAddressId: address.id,
  };
}

function toRestaurant(raw: BackendRestaurant): DiscoveryRestaurant {
  const allowed = new Set([
    'store_unpublished',
    'store_inactive',
    'not_accepting_orders',
    'closed_now',
  ]);
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    category: raw.category,
    description: raw.description,
    imageUrl: raw.imageUrl,
    coverage: raw.coverage,
    availability: {
      available: raw.availability.available,
      openNow: raw.availability.openNow,
      reasons: raw.availability.reasons.filter((reason) =>
        allowed.has(reason),
      ) as DiscoveryRestaurant['availability']['reasons'],
    },
    rating: {
      average: raw.reviewSummary.averageRating,
      count: raw.reviewSummary.totalReviews,
    },
    cuisines: (raw.cuisines ?? []).map((cuisine) => ({
      id: cuisine.id ?? cuisine.slug,
      slug: cuisine.slug,
      name: cuisine.name,
      emoji: cuisine.emoji,
    })),
    rankPosition: raw.ranking.position,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface SessionAddressResult {
  sessionToken: string;
  location: CustomerLocation;
}

/** Anonymous flow: persist a postal code / address for the visitor's session. */
export async function createSessionAddress(
  input: LocationSelectionInput,
): Promise<SessionAddressResult> {
  const payload = await request<{ sessionToken: string; address: BackendAddress }>(
    '/public/discovery/session-address',
    {
      method: 'POST',
      body: {
        countryCode: input.countryCode ?? 'CH',
        postalCode: input.postalCode,
        city: input.city,
        street: input.street,
        houseNumber: input.houseNumber,
        latitude: input.latitude ?? undefined,
        longitude: input.longitude ?? undefined,
        formattedAddress: input.formattedAddress,
        source: input.source ?? 'postal_code',
      },
    },
  );
  return {
    sessionToken: payload.sessionToken,
    location: toCustomerLocation(payload.address, 'session'),
  };
}

/** Re-read a stored session address. Returns null when expired / not found. */
export async function fetchSessionAddress(
  sessionToken: string,
): Promise<SessionAddressResult | null> {
  try {
    const payload = await request<{
      sessionToken: string;
      address: BackendAddress;
    }>(`/public/discovery/session-address/${encodeURIComponent(sessionToken)}`);
    return {
      sessionToken: payload.sessionToken,
      location: toCustomerLocation(payload.address, 'session'),
    };
  } catch (error) {
    if (error instanceof DiscoveryApiError && error.status === 404) return null;
    throw error;
  }
}

export interface DiscoverParams {
  location: CustomerLocation;
  filters: DiscoveryFilters;
  sessionToken?: string | null;
  /** Pagination offset; the API also accepts `limit`. */
  offset?: number;
  signal?: AbortSignal;
}

/** Backend-driven restaurant discovery for a resolved location. */
export async function discoverRestaurants(
  params: DiscoverParams,
): Promise<DiscoveryResult> {
  const search = new URLSearchParams();
  // Prefer the session token (it carries the canonical address server-side).
  if (params.sessionToken) {
    search.set('sessionToken', params.sessionToken);
  } else if (params.location.postalCode) {
    search.set('postalCode', params.location.postalCode);
    search.set('countryCode', params.location.countryCode);
  } else if (
    params.location.latitude !== null &&
    params.location.longitude !== null
  ) {
    search.set('latitude', String(params.location.latitude));
    search.set('longitude', String(params.location.longitude));
    search.set('countryCode', params.location.countryCode);
  }

  if (params.filters.openNow) search.set('openNow', 'true');
  if (params.filters.freeDelivery) search.set('freeDelivery', 'true');
  if (params.filters.maxMinimumOrder !== null) {
    search.set('maxMinimumOrder', String(params.filters.maxMinimumOrder));
  }
  if (params.filters.category) search.set('category', params.filters.category);
  if (params.filters.cuisines.length > 0) {
    search.set('cuisines', params.filters.cuisines.join(','));
  }
  if (params.offset && params.offset > 0) {
    search.set('offset', String(params.offset));
  }
  search.set('sort', params.filters.sort);

  type BackendFacet = { id: string; label: string; count: number };
  const payload = await request<{
    restaurants: BackendRestaurant[];
    facets?: { categories?: BackendFacet[]; cuisines?: BackendFacet[] };
    meta: {
      candidateCount: number;
      returnedCount: number;
      unavailableCount: number;
      total?: number;
    };
  }>(`/public/discovery/restaurants?${search.toString()}`, {
    signal: params.signal,
  });

  return {
    restaurants: payload.restaurants.map(toRestaurant),
    facets: {
      categories: payload.facets?.categories ?? [],
      cuisines: payload.facets?.cuisines ?? [],
    },
    meta: {
      candidateCount: payload.meta.candidateCount,
      returnedCount: payload.meta.returnedCount,
      unavailableCount: payload.meta.unavailableCount,
      total: payload.meta.total ?? payload.restaurants.length,
    },
  };
}

/** Authenticated flow: the customer's default delivery address. */
export async function fetchDefaultCustomerAddress(
  authToken: string,
): Promise<SavedAddress | null> {
  const payload = await request<{ address: BackendSavedAddress | null }>(
    '/customer/addresses/default',
    { authToken },
  );
  return payload.address ? toSavedAddress(payload.address) : null;
}

/** All saved addresses for the authenticated customer. */
export async function fetchCustomerAddresses(
  authToken: string,
): Promise<SavedAddress[]> {
  const payload = await request<{ addresses: BackendSavedAddress[] }>(
    '/customer/addresses',
    { authToken },
  );
  return payload.addresses.map(toSavedAddress);
}
