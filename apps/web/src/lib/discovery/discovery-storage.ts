/**
 * Customer discovery — local persistence layer.
 *
 * Survives page refreshes without fragile in-memory state. We persist:
 *  - the anonymous session token (re-validated against the API on hydration)
 *  - a snapshot of the resolved location (for instant optimistic render)
 *
 * Auth sessions and saved addresses are NOT persisted here — those are owned
 * by the auth layer / backend and re-fetched on demand.
 */

import type { CustomerLocation } from './discovery-types';

const SESSION_TOKEN_KEY = 'discovery.session-token';
const LOCATION_SNAPSHOT_KEY = 'discovery.location-snapshot';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

// ─── Session token ───────────────────────────────────────────────────────────

export function readSessionToken(): string | null {
  if (!canUseStorage()) return null;
  const value = window.localStorage.getItem(SESSION_TOKEN_KEY);
  return value && value.length >= 8 ? value : null;
}

export function writeSessionToken(token: string): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearSessionToken(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(SESSION_TOKEN_KEY);
}

// ─── Location snapshot ───────────────────────────────────────────────────────

/**
 * The last resolved location, used for an instant optimistic render on
 * refresh while the session token is re-validated in the background.
 */
export function readLocationSnapshot(): CustomerLocation | null {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(LOCATION_SNAPSHOT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CustomerLocation;
    if (typeof parsed.formattedAddress !== 'string' || !parsed.countryCode) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeLocationSnapshot(location: CustomerLocation): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(LOCATION_SNAPSHOT_KEY, JSON.stringify(location));
}

export function clearLocationSnapshot(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(LOCATION_SNAPSHOT_KEY);
}

/** Clear every discovery-owned key — used on a full location reset. */
export function clearDiscoveryStorage(): void {
  clearSessionToken();
  clearLocationSnapshot();
}
