import { NextResponse } from 'next/server';

import { slugifyRegion, type RegionSearchResult } from '@/lib/home-discovery';

const LOCATIONIQ_API_KEY = process.env.LOCATIONIQ_API_KEY;
const CACHE_TTL_MS = 60_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const cache = new Map<string, { expiresAt: number; results: RegionSearchResult[] }>();
const requestCounts = new Map<string, { count: number; resetAt: number }>();

type LocationIqItem = {
  place_id: string | number;
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: {
    postcode?: string;
    town?: string;
    city?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
  };
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

function normalizeItem(item: LocationIqItem): RegionSearchResult | null {
  const postalCode = item.address?.postcode?.trim();
  const name =
    item.address?.town?.trim() ||
    item.address?.city?.trim() ||
    item.address?.village?.trim() ||
    item.address?.municipality?.trim();
  const district =
    item.address?.county?.trim() ||
    item.address?.state?.trim() ||
    name;

  if (!postalCode || !name) {
    return null;
  }

  return {
    id: String(item.place_id),
    postalCode,
    name,
    district: district ?? name,
    slug: slugifyRegion(name, postalCode),
    displayName: item.display_name ?? `${postalCode} ${name}`,
    lat: item.lat,
    lon: item.lon,
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

  if (!LOCATIONIQ_API_KEY) {
    return NextResponse.json(
      { results: [], error: 'locationiq_api_key_missing' },
      { status: 500 },
    );
  }

  const upstreamUrl = new URL('https://us1.locationiq.com/v1/search');
  upstreamUrl.searchParams.set('key', LOCATIONIQ_API_KEY);
  upstreamUrl.searchParams.set('q', query);
  upstreamUrl.searchParams.set('format', 'json');
  upstreamUrl.searchParams.set('addressdetails', '1');
  upstreamUrl.searchParams.set('normalizecity', '1');
  upstreamUrl.searchParams.set('countrycodes', 'ch');
  upstreamUrl.searchParams.set('limit', '5');

  const cacheKey = query.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ results: cached.results, cached: true });
  }

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

    const payload = (await response.json()) as LocationIqItem[];
    const results = payload
      .map(normalizeItem)
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
