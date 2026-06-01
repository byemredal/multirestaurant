'use client';

/**
 * Customer discovery restaurant hook. It owns the DISCOVERY-side state machine
 * and keeps loading distinct from empty/error states.
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
const MIN_LOADING_MS = 180;

export interface UseDiscoveryResult {
  state: DiscoveryState;
  restaurants: DiscoveryRestaurant[];
  facets: DiscoveryFacets;
  meta: DiscoveryMeta | null;
  error: string | null;
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

  const {
    openNow,
    freeDelivery,
    maxMinimumOrder,
    category,
    sort,
    deliveryProvider,
  } = filters;
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
    const startedAt = Date.now();
    let settled = false;
    setState('DISCOVERY_LOADING');
    setError(null);

    const finish = (callback: () => void) => {
      const run = () => {
        if (!controller.signal.aborted && !settled) {
          settled = true;
          callback();
        }
      };
      const remaining = MIN_LOADING_MS - (Date.now() - startedAt);
      if (remaining > 0) {
        window.setTimeout(run, remaining);
      } else {
        run();
      }
    };

    discoverRestaurants({
      location,
      sessionToken,
      filters: {
        openNow,
        freeDelivery,
        maxMinimumOrder,
        deliveryProvider,
        category,
        cuisines: cuisinesKey ? cuisinesKey.split(',') : [],
        sort,
      },
      signal: controller.signal,
    })
      .then((result) => {
        finish(() => {
          setRestaurants(result.restaurants);
          setFacets(result.facets);
          setMeta(result.meta);
          setState(
            result.restaurants.length === 0
              ? 'DISCOVERY_EMPTY'
              : 'DISCOVERY_READY',
          );
        });
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') {
          return;
        }
        finish(() => {
          setRestaurants([]);
          setMeta(null);
          setError('Restoranlar su anda yuklenemiyor. Lutfen tekrar deneyin.');
          setState('DISCOVERY_ERROR');
        });
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
    deliveryProvider,
    cuisinesKey,
    sort,
    reloadTick,
  ]);

  return { state, restaurants, facets, meta, error, refresh };
}
