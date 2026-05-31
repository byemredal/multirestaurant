/**
 * Cart persistence keys + teardown helpers for the customer (web) app.
 *
 * Pure, framework-free logic so the cart/auth session-boundary rules can be
 * reasoned about and unit-tested without React. The cart context owns the
 * React state; this module owns *what lives in storage* and *when it must be
 * wiped* on an auth boundary (logout / session expiry / cross-tab logout).
 */

/** Current guest-cart snapshot key. Only ever holds an anonymous cart. */
export const CART_STORAGE_KEY = 'lieferzonen:cart:v1';

/**
 * Keys written by older builds. Kept here so logout/expiry cleanup also
 * removes any stale snapshot a returning user might still carry. Add retired
 * keys here instead of deleting them silently.
 */
export const LEGACY_CART_STORAGE_KEYS: readonly string[] = [];

/**
 * Decide whether an auth-status change must tear the cart down.
 *
 * Only an `authenticated → anonymous` transition (logout, manual or via
 * session expiry) clears the cart. A plain guest navigating — or the initial
 * `loading → anonymous` resolution — must keep its own guest cart intact.
 */
export function shouldClearCartForAuthTransition(
  wasAuthenticated: boolean,
  isAuthenticatedNow: boolean,
): boolean {
  return wasAuthenticated && !isAuthenticatedNow;
}

/**
 * Remove the persisted guest cart snapshot (current + legacy keys). Safe to
 * call on the server (no-op) and when storage is unavailable/blocked.
 */
export function clearPersistedCart(): void {
  if (typeof window === 'undefined') return;
  for (const key of [CART_STORAGE_KEY, ...LEGACY_CART_STORAGE_KEYS]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* storage blocked — best effort */
    }
  }
}
