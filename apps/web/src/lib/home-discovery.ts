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
  lat?: string;
  lon?: string;
};

/** Swiss postal codes: 4 digits, 1000–9999. */
const SWISS_POSTAL_CODE = /^[1-9]\d{3}$/;

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
  const codeMatch = trimmed.match(/\d{4}/);
  if (!codeMatch || !SWISS_POSTAL_CODE.test(codeMatch[0])) return null;

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
