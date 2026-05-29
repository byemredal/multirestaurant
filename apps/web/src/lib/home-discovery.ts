/**
 * Discovery routing helpers — the single source of truth for translating
 * between a location and its URL.
 *
 * Canonical discovery route: `/{mode}/food/{region}` where `region` is a
 * postal-first slug, e.g. `8001-zurich` or the bare `8001`.
 */

export type FulfillmentMode = 'delivery' | 'collection';

export type RegionOption = {
  id: string;
  postalCode: string;
  name: string;
  district: string;
  slug: string;
};

export type RegionSearchResult = {
  id: string;
  postalCode: string;
  name: string;
  district: string;
  slug: string;
  displayName: string;
  /** ISO-3166-1 alpha-2 of the active platform country, when known. */
  country?: string;
  lat?: string;
  lon?: string;
};

/** Postal codes across supported countries: 4 (CH) or 5 (TR) digits. */
const POSTAL_CODE = /^[1-9]\d{3,4}$/;

function toCitySlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Build a region slug — postal code first for unambiguous parsing.
 * `("Zürich", "8001")` → `8001-zurich`; `("", "8001")` → `8001`.
 */
export function slugifyRegion(name: string, postalCode: string): string {
  const code = postalCode.trim();
  const city = toCitySlug(name ?? '');
  return city ? `${code}-${city}` : code;
}

/**
 * Parse a region slug back into its postal code + display name. Tolerant of
 * either ordering (`8001-zurich` or a legacy `zurich-8001`).
 */
export function findRegionBySlug(slug?: string | null): RegionOption | null {
  if (!slug) return null;
  const trimmed = slug.trim().toLowerCase();
  const codeMatch = trimmed.match(/\d{4,5}/);
  if (!codeMatch || !POSTAL_CODE.test(codeMatch[0])) return null;

  const postalCode = codeMatch[0];
  const cityPart = trimmed
    .replace(postalCode, '')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
  const name = cityPart
    ? cityPart
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : postalCode;

  return { id: trimmed, postalCode, name, district: name, slug: trimmed };
}

/** Build the canonical discovery URL path for a location. */
export function buildDiscoveryPath(
  mode: FulfillmentMode,
  postalCode: string,
  city?: string | null,
): string {
  return `/${mode}/food/${slugifyRegion(city ?? '', postalCode)}`;
}

/** Narrow an arbitrary route segment to a supported fulfillment mode. */
export function normalizeFulfillmentMode(value?: string | null): FulfillmentMode {
  return value === 'collection' ? 'collection' : 'delivery';
}
