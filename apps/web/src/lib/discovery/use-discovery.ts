'use client';

/**
 * Customer discovery — restaurant discovery hook.
 *
 * Owns the DISCOVERY-side state machine. Reads the active location from
 * `DiscoveryProvider` and fetches backend-driven results — it never filters or
 * ranks restaurants locally; filters are passed through as query params.
 *
 * Discovery states: DISCOVERY_IDLE · DISCOVERY_LOADING · DISCOVERY_EMPTY
 *                   DISCOVERY_READY · DISCOVERY_ERROR
 */

import { useCallback, useEffect, useState } from 'react';

import { discoverRestaurants } from './discovery-api';
import { useAddressContext } from './discovery-context';
import type {
  DiscoveryFacets,
  DiscoveryFilters,
  DiscoveryMeta,
  DiscoveryRestaurant,
  DiscoveryState,
} from './discovery-types';

const EMPTY_FACETS: DiscoveryFacets = { categories: [], cuisines: [] };

export interface UseDiscoveryResult {
  state: DiscoveryState;
  restaurants: DiscoveryRestaurant[];
  facets: DiscoveryFacets;
  meta: DiscoveryMeta | null;
  error: string | null;
  /** Force a re-fetch for the current location + filters. */
  refresh: () => void;
}

export function useDiscovery(filters: DiscoveryFilters): UseDiscoveryResult {
  const { hydrated, location, sessionToken } = useAddressContext();

  const [state, setState] = useState<DiscoveryState>('DISCOVERY_IDLE');
  const [restaurants, setRestaurants] = useState<DiscoveryRestaurant[]>([]);
  const [facets, setFacets] = useState<DiscoveryFacets>(EMPTY_FACETS);
  const [meta, setMeta] = useState<DiscoveryMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const refresh = useCallback(() => setReloadTick((tick) => tick + 1), []);

  const { openNow, freeDelivery, maxMinimumOrder, category, sort } = filters;
  // Arrays need a stable primitive key for the effect dependency list.
  const cuisinesKey = filters.cuisines.join(',');

  useEffect(() => {
    if (!hydrated) return;

    if (!location) {
      setState('DISCOVERY_IDLE');
      setRestaurants([]);
      setFacets(EMPTY_FACETS);
      setMeta(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setState('DISCOVERY_LOADING');
    setError(null);

    discoverRestaurants({
      location,
      sessionToken,
      filters: {
        openNow,
        freeDelivery,
        maxMinimumOrder,
        category,
        cuisines: cuisinesKey ? cuisinesKey.split(',') : [],
        sort,
      },
      signal: controller.signal,
    })
      .then((result) => {
        setRestaurants(result.restaurants);
        setFacets(result.facets);
        setMeta(result.meta);
        setState(
          result.restaurants.length === 0
            ? 'DISCOVERY_EMPTY'
            : 'DISCOVERY_READY',
        );
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') {
          return;
        }
        setRestaurants([]);
        setMeta(null);
        setError('Restoranlar şu anda yüklenemiyor. Lütfen tekrar deneyin.');
        setState('DISCOVERY_ERROR');
      });

    return () => controller.abort();
  }, [
    hydrated,
    location,
    sessionToken,
    openNow,
    freeDelivery,
    maxMinimumOrder,
    category,
    cuisinesKey,
    sort,
    reloadTick,
  ]);

  return { state, restaurants, facets, meta, error, refresh };
}
