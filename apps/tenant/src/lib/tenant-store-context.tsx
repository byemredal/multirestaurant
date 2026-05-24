'use client';

/**
 * Tenant ≠ Store ayrımının ilk görünür adımı. Bir tenant bir veya birden
 * fazla store'a sahip olabilir. Bu context aktif store'un kimliğini paylaşır;
 * dashboard / orders / studio gibi ekranlar storeId filtresini buradan
 * alacak. Faz B foundation — permission/role/multi-admin yok.
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
import { useTenantAuth } from '@/lib/auth/tenant-auth-context';
import { listTenantStores } from '@/lib/tenant-client';

export type TenantStoreSummary = {
  id: string;
  name: string;
  slug?: string;
  status?: string;
  isActive?: boolean;
  category?: string;
  imageUrl?: string | null;
  openingHours?: Array<{
    isClosed?: boolean;
    openTime?: string | null;
    closeTime?: string | null;
  }>;
};

type TenantStoreContextValue = {
  stores: TenantStoreSummary[];
  activeStoreId: string | null;
  activeStore: TenantStoreSummary | null;
  loading: boolean;
  loadedOnce: boolean;
  error: string | null;
  setActiveStore: (storeId: string) => void;
  refresh: () => Promise<void>;
};

const ACTIVE_STORE_KEY = 'tenant.active-store-id';

const TenantStoreContext = createContext<TenantStoreContextValue | null>(null);

function readPersistedActiveStoreId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACTIVE_STORE_KEY);
  } catch {
    return null;
  }
}

function persistActiveStoreId(storeId: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (storeId) {
      window.localStorage.setItem(ACTIVE_STORE_KEY, storeId);
    } else {
      window.localStorage.removeItem(ACTIVE_STORE_KEY);
    }
  } catch {
    // sessiz — quota/private mode gibi durumlar UI'ı bloklamasın
  }
}

export function TenantStoreProvider({ children }: { children: ReactNode }) {
  const { session, status } = useTenantAuth();
  const isReady = Boolean(session) && status === 'ACTIVE';

  const [stores, setStores] = useState<TenantStoreSummary[]>([]);
  const [activeStoreId, setActiveStoreIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!session) return;
    if (inflightRef.current) return;
    inflightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const list = await listTenantStores(session);
      const mapped = ((list ?? []) as TenantStoreSummary[]).map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        status: s.status,
        isActive: s.isActive,
        category: s.category,
        imageUrl: s.imageUrl ?? null,
        openingHours: s.openingHours,
      }));
      setStores(mapped);
      setLoadedOnce(true);

      // Persisted aktif store hâlâ listede mi? Değilse en yeni store'a düş.
      // /stores/mine "createdAt DESC" döndürdüğü için ilk eleman = en yeni.
      const persisted = readPersistedActiveStoreId();
      const persistedStillValid =
        persisted !== null && mapped.some((store) => store.id === persisted);
      if (persistedStillValid) {
        setActiveStoreIdState(persisted);
      } else if (mapped.length > 0) {
        const fallback = mapped[0].id;
        setActiveStoreIdState(fallback);
        persistActiveStoreId(fallback);
      } else {
        setActiveStoreIdState(null);
        persistActiveStoreId(null);
      }
    } catch {
      setError('Restoran listesi yüklenemedi.');
    } finally {
      setLoading(false);
      inflightRef.current = false;
    }
  }, [session]);

  useEffect(() => {
    if (!isReady) {
      setStores([]);
      setActiveStoreIdState(null);
      setLoadedOnce(false);
      setError(null);
      return;
    }
    void refresh();
  }, [isReady, refresh]);

  const setActiveStore = useCallback(
    (storeId: string) => {
      if (!stores.some((s) => s.id === storeId)) return;
      setActiveStoreIdState(storeId);
      persistActiveStoreId(storeId);
    },
    [stores],
  );

  const activeStore = useMemo<TenantStoreSummary | null>(() => {
    if (!activeStoreId) return null;
    return stores.find((s) => s.id === activeStoreId) ?? null;
  }, [activeStoreId, stores]);

  const value = useMemo<TenantStoreContextValue>(
    () => ({
      stores,
      activeStoreId,
      activeStore,
      loading,
      loadedOnce,
      error,
      setActiveStore,
      refresh,
    }),
    [
      stores,
      activeStoreId,
      activeStore,
      loading,
      loadedOnce,
      error,
      setActiveStore,
      refresh,
    ],
  );

  return (
    <TenantStoreContext.Provider value={value}>{children}</TenantStoreContext.Provider>
  );
}

export function useTenantStores(): TenantStoreContextValue {
  const context = useContext(TenantStoreContext);
  if (!context) {
    throw new Error('useTenantStores must be used within a TenantStoreProvider.');
  }
  return context;
}

export function useActiveStore(): {
  storeId: string | null;
  store: TenantStoreSummary | null;
} {
  const ctx = useTenantStores();
  return { storeId: ctx.activeStoreId, store: ctx.activeStore };
}
