import { NextResponse } from 'next/server';

import { resolveApiBaseUrl } from '@shared/api-base-url';
import { slugifyRegion, type RegionSearchResult } from '@/lib/home-discovery';

const CACHE_TTL_MS = 60_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const cache = new Map<string, { expiresAt: number; results: RegionSearchResult[] }>();
const requestCounts = new Map<string, { count: number; resetAt: number }>();

/**
 * Provider-agnostic suggestion as returned by the backend `/geo/suggest`
 * endpoint. The geo provider (and its API key) live entirely server-side in the
 * API; this route only adapts the shape to the storefront's `RegionSearchResult`.
 */
type GeoAddressSuggestion = {
  id: string;
  label: string;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
};

export const dynamic = 'force-dynamic';

function getClientKey(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
}

function isRateLimited(clientKey: string) {
  const now = Date.now();
  const current = requestCounts.get(clientKey);

  if (!current || current.resetAt <= now) {
    requestCounts.set(clientKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (current.count >= RATE_LIMIT_MAX) {
    return true;
  }

  current.count += 1;
  requestCounts.set(clientKey, current);
  return false;
}

function adaptSuggestion(item: GeoAddressSuggestion): RegionSearchResult | null {
  const postalCode = item.postalCode?.trim();
  const name = item.city?.trim();
  if (!postalCode || !name) {
    return null;
  }
  return {
    id: item.id,
    postalCode,
    name,
    district: name,
    slug: slugifyRegion(name, postalCode),
    displayName: item.label?.trim() || `${postalCode} ${name}`,
    country: item.country ?? undefined,
    lat: item.latitude != null ? String(item.latitude) : undefined,
    lon: item.longitude != null ? String(item.longitude) : undefined,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();
  const clientKey = getClientKey(request);

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  if (isRateLimited(clientKey)) {
    return NextResponse.json({ results: [], error: 'rate_limited' }, { status: 429 });
  }

  const cacheKey = query.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ results: cached.results, cached: true });
  }

  // The backend biases suggestions to the active platform country and enforces
  // the provider/key, so this route stays a thin adapter — no country param or
  // API key needed here.
  const upstreamUrl = new URL(`${resolveApiBaseUrl()}/geo/suggest`);
  upstreamUrl.searchParams.set('q', query);

  try {
    const response = await fetch(upstreamUrl.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { results: [], error: 'location_lookup_failed' },
        { status: response.status },
      );
    }

    const payload = (await response.json()) as { results?: GeoAddressSuggestion[] };
    const results = (payload.results ?? [])
      .map(adaptSuggestion)
      .filter((item): item is RegionSearchResult => item !== null);

    cache.set(cacheKey, {
      results,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { results: [], error: 'location_lookup_unreachable' },
      { status: 502 },
    );
  }
}
