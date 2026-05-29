/**
 * Customer discovery — location-search abstraction seam.
 *
 * `LocationInput` depends only on the `LocationSearchProvider` interface, never
 * on a concrete provider. To onboard Swisstopo / Google Places / Mapbox /
 * Nominatim, implement this interface and pass it to `LocationInput` (or swap
 * `defaultLocationProvider`) — no UI or state code changes.
 *
 * The shipped default proxies the app's own `/api/location-search` route
 * (currently OSM/LocationIQ-backed, Switzerland-scoped).
 */

import type { LocationSuggestion } from './discovery-types';

export interface LocationSearchProvider {
  /** Stable identifier, surfaced in telemetry. */
  readonly id: string;
  search(query: string, signal?: AbortSignal): Promise<LocationSuggestion[]>;
}

/** Postal codes across supported countries: 4 (CH) or 5 (TR) digits. */
export function isSupportedPostalCode(value: string): boolean {
  return /^[1-9]\d{3,4}$/.test(value.trim());
}

/**
 * A bare postal-code suggestion — lets a visitor proceed by typing just a
 * postal code, even before any provider returns address-level matches. The
 * country is inferred from the active-platform-scoped provider results.
 */
export function postalCodeSuggestion(
  postalCode: string,
  countryCode?: string,
): LocationSuggestion {
  return {
    id: `postal:${countryCode ?? 'XX'}:${postalCode}`,
    label: postalCode,
    secondaryLabel: 'Posta kodu',
    postalCode,
    city: '',
    countryCode: countryCode ?? '',
    latitude: null,
    longitude: null,
  };
}

interface InternalSearchResult {
  id: string;
  postalCode: string;
  name: string;
  district: string;
  displayName: string;
  country?: string;
  lat?: string;
  lon?: string;
}

/**
 * Default provider — proxies `/api/location-search`. The underlying geocoding
 * provider is an implementation detail of that route.
 */
export const defaultLocationProvider: LocationSearchProvider = {
  id: 'internal-location-search',
  async search(query, signal) {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const response = await fetch(
      `/api/location-search?q=${encodeURIComponent(trimmed)}`,
      { signal },
    );
    if (!response.ok) return [];

    const payload = (await response.json()) as {
      results?: InternalSearchResult[];
    };

    const suggestions: LocationSuggestion[] = (payload.results ?? []).map(
      (result) => ({
        id: result.id,
        label: `${result.postalCode} ${result.name}`.trim(),
        secondaryLabel: result.district || result.name,
        postalCode: result.postalCode,
        city: result.name,
        countryCode: result.country ?? '',
        latitude: result.lat ? Number(result.lat) : null,
        longitude: result.lon ? Number(result.lon) : null,
      }),
    );

    // Promote a typed postal code so a direct code entry always works. The
    // country is borrowed from a returned suggestion when available (results are
    // already scoped to the active platform country by the backend).
    if (isSupportedPostalCode(trimmed) && !suggestions.some((s) => s.postalCode === trimmed)) {
      const inferredCountry = suggestions.find((s) => s.countryCode)?.countryCode;
      suggestions.unshift(postalCodeSuggestion(trimmed, inferredCountry));
    }
    return suggestions;
  },
};
