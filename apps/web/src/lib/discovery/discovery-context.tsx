'use client';

/**
 * Customer discovery — address context.
 *
 * Owns the ADDRESS-side state machine and the resolved customer location.
 * Resolution is ROUTE-DRIVEN: the active postal code comes from the URL
 * (`routePostalCode`), so the URL is the single source of truth. This
 * component never reads `window.location` — the route segment is passed in.
 *
 * Address states: NO_ADDRESS_SELECTED · ADDRESS_LOADING · SESSION_ADDRESS
 *                 AUTH_USER_NO_ADDRESS · AUTH_USER_DEFAULT_ADDRESS
 *
 * Storage lifecycle — see README §"localStorage lifecycle".
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { readAuthSession } from '@/lib/storage/auth-session';
import {
  createSessionAddress,
  fetchCustomerAddresses,
  fetchDefaultCustomerAddress,
  fetchSessionAddress,
  savedAddressToLocation,
} from './discovery-api';
import {
  clearDiscoveryStorage,
  readLocationSnapshot,
  readSessionToken,
  writeLocationSnapshot,
  writeSessionToken,
} from './discovery-storage';
import type {
  AddressState,
  CustomerLocation,
  SavedAddress,
} from './discovery-types';

/** Fires after `writeAuthSession` / `clearAuthSession` — see auth-session.ts. */
const AUTH_CHANGED_EVENT = 'lieferzonen:auth-changed';

interface DiscoveryContextValue {
  /** False until the first route-driven resolve has completed (SSR-safe). */
  hydrated: boolean;
  addressState: AddressState;
  location: CustomerLocation | null;
  isAuthenticated: boolean;
  savedAddresses: SavedAddress[];
  /** Session token of the active session location; null for saved addresses. */
  sessionToken: string | null;
  /** Re-run address resolution for the current route. */
  refresh: () => void;
}

const DiscoveryContext = createContext<DiscoveryContextValue | null>(null);

interface DiscoveryProviderProps {
  children: ReactNode;
  /** Postal code parsed from the discovery route; null on the landing route. */
  routePostalCode: string | null;
  /** City parsed from the route slug, used for the location label. */
  routeCity?: string | null;
}

export function DiscoveryProvider({
  children,
  routePostalCode,
  routeCity = null,
}: DiscoveryProviderProps) {
  const [hydrated, setHydrated] = useState(false);
  const [addressState, setAddressState] = useState<AddressState>(
    routePostalCode ? 'ADDRESS_LOADING' : 'NO_ADDRESS_SELECTED',
  );
  const [location, setLocation] = useState<CustomerLocation | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [sessionToken, setSessionTokenState] = useState<string | null>(null);
  const [authVersion, setAuthVersion] = useState(0);

  // Guards against overlapping resolves; tracks the prior auth state so a
  // logout transition can clear stale anonymous storage.
  const resolveSeq = useRef(0);
  const wasAuthenticated = useRef(false);

  /**
   * Resolve a session address for a postal code. Reuses (and re-validates) a
   * stored token when its snapshot matches; otherwise creates a fresh one.
   */
  const resolveSessionForPostal = useCallback(
    async (
      postalCode: string,
      onOptimistic?: (snapshot: CustomerLocation) => void,
    ): Promise<{ location: CustomerLocation; token: string }> => {
      const storedToken = readSessionToken();
      const snapshot = readLocationSnapshot();

      if (storedToken && snapshot && snapshot.postalCode === postalCode) {
        onOptimistic?.(snapshot);
        const session = await fetchSessionAddress(storedToken).catch(
          () => undefined,
        );
        if (session) {
          writeLocationSnapshot(session.location);
          return { location: session.location, token: session.sessionToken };
        }
        if (session === null) {
          // Token expired — drop it and fall through to create a new one.
          clearDiscoveryStorage();
        } else {
          // Network error — keep the optimistic snapshot + token.
          return { location: snapshot, token: storedToken };
        }
      }

      const created = await createSessionAddress({
        postalCode,
        source: 'manual',
      });
      writeSessionToken(created.sessionToken);
      writeLocationSnapshot(created.location);
      return { location: created.location, token: created.sessionToken };
    },
    [],
  );

  /**
   * Resolve the address state. The URL postal code is authoritative when
   * present; otherwise the account default (authenticated) or nothing
   * (anonymous → landing).
   */
  const resolve = useCallback(async () => {
    const seq = ++resolveSeq.current;
    const isStale = () => seq !== resolveSeq.current;

    setAddressState('ADDRESS_LOADING');
    const auth = readAuthSession();

    // Logout transition — clear stale anonymous discovery storage.
    if (wasAuthenticated.current && !auth) clearDiscoveryStorage();
    wasAuthenticated.current = Boolean(auth);

    // ── Authenticated ───────────────────────────────────────────────────────
    if (auth) {
      setIsAuthenticated(true);
      let addresses: SavedAddress[] = [];
      let defaultAddress: SavedAddress | null = null;
      try {
        [defaultAddress, addresses] = await Promise.all([
          fetchDefaultCustomerAddress(auth.accessToken),
          fetchCustomerAddresses(auth.accessToken).catch(() => []),
        ]);
      } catch {
        // Auth token unusable for address APIs — treat as no saved addresses.
      }
      if (isStale()) return;
      setSavedAddresses(addresses);
      const accountState: AddressState = addresses.length
        ? 'AUTH_USER_DEFAULT_ADDRESS'
        : 'AUTH_USER_NO_ADDRESS';

      if (!routePostalCode) {
        // Landing route — the account default drives discovery.
        if (addresses.length) clearDiscoveryStorage();
        const primary = defaultAddress ?? addresses[0] ?? null;
        setSessionTokenState(null);
        setLocation(primary ? savedAddressToLocation(primary) : null);
        setAddressState(accountState);
        return;
      }

      // Discovery route — the URL postal code is authoritative.
      const savedMatch = addresses.find(
        (item) => item.postalCode === routePostalCode,
      );
      if (savedMatch) {
        setSessionTokenState(null);
        setLocation(savedAddressToLocation(savedMatch));
        setAddressState(accountState);
        return;
      }
      try {
        const resolved = await resolveSessionForPostal(routePostalCode);
        if (isStale()) return;
        setSessionTokenState(resolved.token);
        setLocation(applyRouteCity(resolved.location, routeCity));
      } catch {
        if (isStale()) return;
        setSessionTokenState(null);
        setLocation(null);
      }
      setAddressState(accountState);
      return;
    }

    // ── Anonymous ───────────────────────────────────────────────────────────
    setIsAuthenticated(false);
    setSavedAddresses([]);

    if (!routePostalCode) {
      // Landing route — no auto-restore; the visitor picks a location.
      setSessionTokenState(null);
      setLocation(null);
      setAddressState('NO_ADDRESS_SELECTED');
      return;
    }

    try {
      const resolved = await resolveSessionForPostal(
        routePostalCode,
        (snapshot) => {
          if (!isStale()) setLocation(applyRouteCity(snapshot, routeCity));
        },
      );
      if (isStale()) return;
      setSessionTokenState(resolved.token);
      setLocation(applyRouteCity(resolved.location, routeCity));
      setAddressState('SESSION_ADDRESS');
    } catch {
      if (isStale()) return;
      setSessionTokenState(null);
      setLocation(null);
      setAddressState('NO_ADDRESS_SELECTED');
    }
  }, [routePostalCode, routeCity, resolveSessionForPostal]);

  // Resolve on mount, on route changes, and on auth changes.
  useEffect(() => {
    let active = true;
    void resolve().finally(() => {
      if (active) setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, [resolve, authVersion]);

  // Re-resolve on login / logout (same-tab event + cross-tab storage event).
  useEffect(() => {
    const onAuthChanged = () => setAuthVersion((version) => version + 1);
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    window.addEventListener('storage', onAuthChanged);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
      window.removeEventListener('storage', onAuthChanged);
    };
  }, []);

  const refresh = useCallback(() => {
    void resolve();
  }, [resolve]);

  const value = useMemo<DiscoveryContextValue>(
    () => ({
      hydrated,
      addressState,
      location,
      isAuthenticated,
      savedAddresses,
      sessionToken,
      refresh,
    }),
    [
      hydrated,
      addressState,
      location,
      isAuthenticated,
      savedAddresses,
      sessionToken,
      refresh,
    ],
  );

  return (
    <DiscoveryContext.Provider value={value}>
      {children}
    </DiscoveryContext.Provider>
  );
}

/** Prefer a route-supplied city label over a postal-code-only one. */
function applyRouteCity(
  location: CustomerLocation,
  routeCity: string | null,
): CustomerLocation {
  if (!routeCity || location.city) return location;
  return {
    ...location,
    city: routeCity,
    formattedAddress: location.postalCode
      ? `${location.postalCode} ${routeCity}`
      : routeCity,
  };
}

export function useAddressContext(): DiscoveryContextValue {
  const context = useContext(DiscoveryContext);
  if (!context) {
    throw new Error('useAddressContext must be used within a DiscoveryProvider.');
  }
  return context;
}
