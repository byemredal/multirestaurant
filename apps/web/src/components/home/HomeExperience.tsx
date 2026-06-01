'use client';

/**
 * Homepage / discovery experience.
 *
 * The URL is authoritative:
 *   `/`                       → marketing landing + location entry
 *   `/{mode}/food/{region}`   → backend-driven discovery for that postal code
 *
 * `DiscoveryProvider` resolves the route's postal code into a location;
 * `useDiscovery` fetches restaurants for it. This component only renders and
 * navigates — it never fetches or filters restaurants itself, and the header
 * is the single location control (no competing address bar).
 */

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { CookieConsentBar } from '@/components/cookie-consent-bar';
import HomeHeader from '@/components/shell/HomeHeader';
import HomeLanding from '@/components/home/HomeLanding';
import AddressSwitcherModal from '@/components/discovery/AddressSwitcherModal';
import RestaurantList from '@/components/discovery/RestaurantList';
import {
  DiscoveryProvider,
  useAddressContext,
} from '@/lib/discovery/discovery-context';
import { useDiscovery } from '@/lib/discovery/use-discovery';
import {
  DEFAULT_DISCOVERY_FILTERS,
  type DiscoveryFilters,
  type DiscoveryState,
} from '@/lib/discovery/discovery-types';
import {
  discoveryFiltersEqual,
  hasActiveDiscoveryFilters,
  parseDiscoveryFiltersFromSearchParams,
  sanitizeFiltersForMode,
  writeDiscoveryFiltersToSearchParams,
} from '@/lib/discovery/discovery-filter-url';
import {
  buildDiscoveryPath,
  findRegionBySlug,
  type FulfillmentMode,
  type RegionSearchResult,
} from '@/lib/home-discovery';
import { reportTelemetry } from '@/lib/telemetry';

type Props = {
  initialMode?: FulfillmentMode;
  initialRegionSlug?: string | null;
};

const BUDGET_OPTIONS: Array<{ id: string; label: string; value: number | null }> = [
  { id: 'all', label: 'Tümü', value: null },
  { id: '20', label: '20 CHF ve altı', value: 20 },
  { id: '30', label: '30 CHF ve altı', value: 30 },
];

export default function HomeExperience({
  initialMode = 'delivery',
  initialRegionSlug = null,
}: Props) {
  const region = useMemo(
    () => findRegionBySlug(initialRegionSlug),
    [initialRegionSlug],
  );
  const routePostalCode = region?.postalCode ?? null;
  // A bare postal-code slug yields name === postalCode — treat that as "no city".
  const routeCity =
    region && region.name !== region.postalCode ? region.name : null;

  return (
    <DiscoveryProvider routePostalCode={routePostalCode} routeCity={routeCity}>
      <HomeContent
        initialMode={initialMode}
        routePostalCode={routePostalCode}
        routeCity={routeCity}
      />
    </DiscoveryProvider>
  );
}

function HomeContent({
  initialMode,
  routePostalCode,
  routeCity,
}: {
  initialMode: FulfillmentMode;
  routePostalCode: string | null;
  routeCity: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hydrated, addressState, location, isAuthenticated } =
    useAddressContext();

  const [mode, setMode] = useState<FulfillmentMode>(initialMode);
  const [filters, setFilters] = useState<DiscoveryFilters>(() =>
    parseDiscoveryFiltersFromSearchParams(searchParams, initialMode),
  );
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const discovery = useDiscovery(filters);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const nextFilters = parseDiscoveryFiltersFromSearchParams(searchParams, initialMode);
    setFilters((current) =>
      discoveryFiltersEqual(current, nextFilters) ? current : nextFilters,
    );
  }, [initialMode, searchParams]);

  useEffect(() => {
    if (!routePostalCode) return;
    const sanitized = sanitizeFiltersForMode(filters, mode);
    if (!discoveryFiltersEqual(sanitized, filters)) {
      setFilters(sanitized);
      return;
    }
    const nextSearchParams = writeDiscoveryFiltersToSearchParams(
      searchParams,
      sanitized,
      mode,
    );
    const currentQuery = searchParams.toString();
    const nextQuery = nextSearchParams.toString();
    if (currentQuery !== nextQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    }
  }, [filters, mode, pathname, routePostalCode, router, searchParams]);

  // Authenticated users landing on `/` are routed to their default address.
  useEffect(() => {
    if (routePostalCode || !isAuthenticated) return;
    if (location?.postalCode) {
      router.replace(
        buildDiscoveryPath(mode, location.postalCode, location.city),
      );
    }
  }, [routePostalCode, isAuthenticated, location, mode, router]);

  const [isNavigating, setIsNavigating] = useState(false);

  // Clear the pending guard once the destination route has resolved (postal
  // code or fulfillment mode changed), so subsequent navigations aren't blocked.
  useEffect(() => {
    setIsNavigating(false);
  }, [routePostalCode, routeCity, initialMode]);

  const goToLocation = (postalCode: string, city: string | null) => {
    if (isNavigating) return;
    setIsNavigating(true);
    router.push(buildDiscoveryPath(mode, postalCode, city));
  };

  // ── Landing hero location search ───────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RegionSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const needle = query.trim();
    if (!needle) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const response = await fetch(
          `/api/location-search?q=${encodeURIComponent(needle)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error('location_search_failed');
        }
        const payload = (await response.json()) as {
          results?: RegionSearchResult[];
        };
        setSearchResults(payload.results ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setSearchResults([]);
          setSearchError('Konum araması şu anda çalışmıyor. Lütfen tekrar dene.');
        }
      } finally {
        setSearchLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const handleSelectRegion = (result: RegionSearchResult) => {
    if (isNavigating) return;
    void reportTelemetry({
      type: 'discovery_location_selected',
      payload: { postalCode: result.postalCode },
    });
    setQuery('');
    goToLocation(result.postalCode, result.name);
  };

  const updateFilters = (patch: Partial<DiscoveryFilters>) => {
    setFilters((current) => sanitizeFiltersForMode({ ...current, ...patch }, mode));
  };

  const onBudgetChange = (id: string) => {
    const option = BUDGET_OPTIONS.find((item) => item.id === id);
    updateFilters({ maxMinimumOrder: option?.value ?? null });
  };

  const resetFilters = () => {
    setFilters(sanitizeFiltersForMode(DEFAULT_DISCOVERY_FILTERS, mode));
  };

  const changeMode = (next: FulfillmentMode) => {
    if (isNavigating) return;
    setMode(next);
    setFilters((current) => sanitizeFiltersForMode(current, next));
    const postalCode = location?.postalCode ?? routePostalCode;
    if (postalCode) {
      setIsNavigating(true);
      const nextFilters = sanitizeFiltersForMode(filters, next);
      const nextSearchParams = writeDiscoveryFiltersToSearchParams(
        searchParams,
        nextFilters,
        next,
      );
      const query = nextSearchParams.toString();
      router.push(
        `${buildDiscoveryPath(next, postalCode, location?.city ?? routeCity)}${query ? `?${query}` : ''}`,
      );
    }
  };

  // ── Landing route ─────────────────────────────────────────────────────────
  if (!routePostalCode) {
    return (
      <>
        <HomeHeader fulfillmentMode={mode} />
        <main className="min-h-screen bg-white text-ink-900">
          <HomeLanding
            query={query}
            onQueryChange={setQuery}
            searchLoading={searchLoading}
            searchError={searchError}
            searchResults={searchResults}
            onSelectRegion={handleSelectRegion}
            navigating={isNavigating}
          />
        </main>
        <CookieConsentBar />
      </>
    );
  }

  // ── Discovery route ───────────────────────────────────────────────────────
  const regionLabel =
    location?.formattedAddress ??
    (routeCity ? `${routePostalCode} ${routeCity}` : routePostalCode);

  // The list shows ADDRESS_LOADING (resolving the route) as a load state too.
  const listState: DiscoveryState =
    !hydrated || addressState === 'ADDRESS_LOADING'
      ? 'DISCOVERY_LOADING'
      : discovery.state === 'DISCOVERY_IDLE'
        ? 'DISCOVERY_EMPTY'
        : discovery.state;

  const restaurantCount = discovery.restaurants.length;
  const unavailableCount = discovery.meta?.unavailableCount ?? 0;

  return (
    <>
      <HomeHeader
        activeRegionLabel={regionLabel}
        fulfillmentMode={mode}
        onBackHome={() => router.push('/')}
        onFulfillmentModeChange={changeMode}
        onOpenRegionModal={() => setSwitcherOpen(true)}
      />

      <main className="min-h-screen bg-ink-50 text-ink-900">
        <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
          {/* Authenticated-but-no-saved-address nudge */}
          {addressState === 'AUTH_USER_NO_ADDRESS' && (
            <div className="mb-5 rounded-2xl border border-warning-200 bg-warning-50 px-4 py-3">
              <p className="text-[13px] text-warning-700">
                Bu konumu hesabına kaydetmedin. Sipariş verirken adresini
                kaydedebilirsin.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Filters */}
            <aside
              className={`w-full shrink-0 lg:w-[240px] ${
                filtersOpen ? 'block' : 'hidden lg:block'
              }`}
            >
              <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
                <div className="space-y-2">
                  {(
                    [
                      { key: 'openNow', label: 'Şu an açık' },
                      { key: 'freeDelivery', label: 'Ücretsiz teslimat' },
                    ] as const
                  ).map(({ key, label }) => {
                    const active = filters[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => updateFilters({ [key]: !active })}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[14px] font-medium transition hover:bg-ink-50"
                      >
                        <span
                          className={
                            active
                              ? 'font-semibold text-primary-700'
                              : 'text-ink-900'
                          }
                        >
                          {label}
                        </span>
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition ${
                            active
                              ? 'border-primary bg-primary text-white'
                              : 'border-ink-300'
                          }`}
                        >
                          {active && <CheckIcon />}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {discovery.facets.categories.length > 0 && (
                  <>
                    <div className="my-4 border-t border-ink-100" />
                    <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-400">
                      Mekan türü
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {discovery.facets.categories.map((facet) => {
                        const active = filters.category === facet.id;
                        return (
                          <button
                            key={facet.id}
                            type="button"
                            onClick={() =>
                              updateFilters({
                                category: active ? null : facet.id,
                              })
                            }
                            className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
                              active
                                ? 'bg-primary text-white'
                                : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                            }`}
                          >
                            {facet.label}
                            <span
                              className={
                                active
                                  ? 'ml-1 text-white/70'
                                  : 'ml-1 text-ink-400'
                              }
                            >
                              {facet.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {discovery.facets.cuisines.length > 0 && (
                  <>
                    <div className="my-4 border-t border-ink-100" />
                    <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-400">
                      Mutfak
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {discovery.facets.cuisines.map((facet) => {
                        const active = filters.cuisines.includes(facet.id);
                        return (
                          <button
                            key={facet.id}
                            type="button"
                            onClick={() =>
                              updateFilters({
                                cuisines: active
                                  ? filters.cuisines.filter(
                                      (id) => id !== facet.id,
                                    )
                                  : [...filters.cuisines, facet.id],
                              })
                            }
                            className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
                              active
                                ? 'bg-primary text-white'
                                : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                            }`}
                          >
                            {facet.label}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                <div className="my-4 border-t border-ink-100" />
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-400">
                  Min. sipariş
                </p>
                <div className="space-y-1.5">
                  {BUDGET_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onBudgetChange(option.id)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] transition ${
                          (filters.maxMinimumOrder === option.value ||
                            (filters.maxMinimumOrder === null && option.value === null))
                            ? 'bg-primary-50 font-semibold text-primary-700'
                          : 'text-ink-900 hover:bg-ink-50'
                      }`}
                    >
                      <span
                        className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                          (filters.maxMinimumOrder === option.value ||
                            (filters.maxMinimumOrder === null && option.value === null))
                            ? 'border-primary bg-primary'
                            : 'border-ink-300'
                        }`}
                      />
                      {option.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-4 w-full rounded-xl py-2 text-[13px] text-ink-400 transition hover:text-danger-500"
                >
                  Filtreleri temizle
                </button>
              </div>
            </aside>

            {/* Results */}
            <div className="min-w-0 flex-1">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-[20px] font-bold text-ink-900">
                    {listState === 'DISCOVERY_LOADING'
                      ? 'Restoranlar yükleniyor…'
                      : listState === 'DISCOVERY_READY'
                        ? `${restaurantCount} restoran bulundu`
                        : 'Restoran keşfi'}
                  </h1>
                  <p className="text-[13px] text-ink-500">
                    {regionLabel}
                    {unavailableCount > 0 && listState === 'DISCOVERY_READY'
                      ? ` — ${unavailableCount} restoran şu an kapalı`
                      : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((value) => !value)}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-ink-200 bg-white px-4 text-[13px] font-semibold text-ink-800 transition hover:bg-ink-50 lg:hidden"
                  >
                    Filtrele
                  </button>
                  <select
                    value={filters.sort}
                    onChange={(event) =>
                      updateFilters({
                        sort: event.target.value as DiscoveryFilters['sort'],
                      })
                    }
                    className="h-10 rounded-xl border border-ink-200 bg-white pl-3 pr-8 text-[13px] font-medium text-ink-900 outline-none focus:border-primary"
                  >
                    <option value="best_match">En iyi eşleşme</option>
                    <option value="eta">En hızlı</option>
                    <option value="distance">En yakın</option>
                    <option value="delivery_fee">En düşük teslimat</option>
                    <option value="min_order">En düşük min. sipariş</option>
                    <option value="rating">En yüksek puan</option>
                  </select>
                </div>
              </div>

              <RestaurantList
                state={listState}
                restaurants={discovery.restaurants}
                error={discovery.error}
                onRetry={discovery.refresh}
                onChangeAddress={() => setSwitcherOpen(true)}
                hasActiveFilters={hasActiveDiscoveryFilters(filters)}
                onClearFilters={resetFilters}
              />
            </div>
          </div>
        </div>
      </main>

      <AddressSwitcherModal
        open={switcherOpen}
        mode={mode}
        onClose={() => setSwitcherOpen(false)}
      />
      <CookieConsentBar />
    </>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
