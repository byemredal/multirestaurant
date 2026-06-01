import {
  DEFAULT_DISCOVERY_FILTERS,
  type DiscoveryFilters,
  type DiscoverySort,
} from './discovery-types';
import type { FulfillmentMode } from '@/lib/home-discovery';

const URL_SORT_TO_STATE: Record<string, DiscoverySort> = {
  best_match: 'best_match',
  delivery_time_asc: 'eta',
  eta: 'eta',
  delivery_fee_asc: 'delivery_fee',
  delivery_fee: 'delivery_fee',
  rating_desc: 'rating',
  rating: 'rating',
  distance_asc: 'distance',
  distance: 'distance',
  min_order_asc: 'min_order',
  min_order: 'min_order',
};

const STATE_SORT_TO_URL: Record<DiscoverySort, string> = {
  best_match: 'best_match',
  eta: 'delivery_time_asc',
  delivery_fee: 'delivery_fee_asc',
  rating: 'rating_desc',
  distance: 'distance_asc',
  min_order: 'min_order_asc',
};

type SearchParamsLike = {
  get(name: string): string | null;
  toString(): string;
};

function truthy(value: string | null) {
  return value === 'true' || value === '1';
}

function splitCsv(value: string | null) {
  return value
    ? value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

export function sanitizeFiltersForMode(
  filters: DiscoveryFilters,
  mode: FulfillmentMode,
): DiscoveryFilters {
  if (mode === 'delivery') {
    return filters;
  }
  return {
    ...filters,
    freeDelivery: false,
    deliveryProvider: null,
  };
}

export function parseDiscoveryFiltersFromSearchParams(
  searchParams: SearchParamsLike,
  mode: FulfillmentMode,
): DiscoveryFilters {
  const sort = URL_SORT_TO_STATE[searchParams.get('sort') ?? ''] ?? DEFAULT_DISCOVERY_FILTERS.sort;
  const minOrderParam = searchParams.get('min_order') ?? searchParams.get('maxMinimumOrder');
  const parsedMinOrder = minOrderParam == null ? Number.NaN : Number(minOrderParam);

  return sanitizeFiltersForMode(
    {
      ...DEFAULT_DISCOVERY_FILTERS,
      sort,
      openNow: truthy(searchParams.get('open_now') ?? searchParams.get('openNow')),
      freeDelivery: truthy(searchParams.get('free_delivery') ?? searchParams.get('freeDelivery')),
      deliveryProvider:
        searchParams.get('delivery_provider') === 'platform_delivery' ||
        searchParams.get('delivery_provider') === 'restaurant_delivery'
          ? (searchParams.get('delivery_provider') as DiscoveryFilters['deliveryProvider'])
          : null,
      maxMinimumOrder:
        Number.isFinite(parsedMinOrder) && parsedMinOrder >= 0 ? parsedMinOrder : null,
      category: searchParams.get('category')?.trim() || null,
      cuisines: splitCsv(searchParams.get('cuisines')),
    },
    mode,
  );
}

export function writeDiscoveryFiltersToSearchParams(
  searchParams: SearchParamsLike,
  filters: DiscoveryFilters,
  mode: FulfillmentMode,
) {
  const next = new URLSearchParams(searchParams.toString());
  const sanitized = sanitizeFiltersForMode(filters, mode);

  for (const key of [
    'sort',
    'open_now',
    'openNow',
    'free_delivery',
    'freeDelivery',
    'delivery_provider',
    'min_order',
    'maxMinimumOrder',
    'category',
    'cuisines',
  ]) {
    next.delete(key);
  }

  if (sanitized.sort !== DEFAULT_DISCOVERY_FILTERS.sort) {
    next.set('sort', STATE_SORT_TO_URL[sanitized.sort]);
  }
  if (sanitized.deliveryProvider) {
    next.set('delivery_provider', sanitized.deliveryProvider);
  }
  if (sanitized.cuisines.length > 0) {
    next.set('cuisines', sanitized.cuisines.join(','));
  }
  if (sanitized.openNow) {
    next.set('open_now', 'true');
  }
  if (sanitized.freeDelivery) {
    next.set('free_delivery', 'true');
  }
  if (sanitized.maxMinimumOrder !== null) {
    next.set('min_order', String(sanitized.maxMinimumOrder));
  }
  if (sanitized.category) {
    next.set('category', sanitized.category);
  }

  return next;
}

export function discoveryFiltersEqual(left: DiscoveryFilters, right: DiscoveryFilters) {
  return (
    left.openNow === right.openNow &&
    left.freeDelivery === right.freeDelivery &&
    left.maxMinimumOrder === right.maxMinimumOrder &&
    left.deliveryProvider === right.deliveryProvider &&
    left.category === right.category &&
    left.sort === right.sort &&
    left.cuisines.join(',') === right.cuisines.join(',')
  );
}

export function hasActiveDiscoveryFilters(filters: DiscoveryFilters) {
  return !discoveryFiltersEqual(filters, DEFAULT_DISCOVERY_FILTERS);
}
