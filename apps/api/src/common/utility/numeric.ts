/**
 * Coerce an unknown DB column value to a finite number, or null otherwise.
 *
 * Why: PostgreSQL `NUMERIC` columns arrive from `pg` as strings, so callers
 * that need them as JS numbers (distance, fees, ratings, etc.) have to
 * defensively convert. Previously duplicated as `toNumber()` in
 * discovery/coverage.service and discovery/discovery.service.
 */
export function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
