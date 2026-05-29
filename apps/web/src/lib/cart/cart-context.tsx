'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { readAuthSession } from '@/lib/storage/auth-session';
import { apiClient } from '@/lib/api/api-client';
import { apiBaseUrl } from '@/lib/config';

const BASE_URL = apiBaseUrl;
const STORAGE_KEY = 'lieferzonen:cart:v1';

// ─── Domain types ─────────────────────────────────────────────────────────────

export type LocalCartItem = {
  menuItemId: string;
  name: string;
  price: number;
  currency: string;
  quantity: number;
  /** Backend cart line-item UUID — present when synced with the /cart API. */
  cartItemId?: string;
};

// Minimal shapes from the backend ActiveCartResponseDto
type BackendCartItem = {
  id: string;
  menuItemId: string;
  itemNameSnapshot: string;
  unitBasePriceSnapshot: number;
  currencySnapshot: string;
  quantity: number;
};

type BackendCart = {
  storeId: string;
  storeName: string | null;
  currency: string;
  serviceType?: 'delivery' | 'pickup' | null;
  deliveryDistanceKm?: number | null;
  items: BackendCartItem[];
};

type BackendCartResponse = {
  cart: BackendCart | null;
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

export type CartServiceType = 'delivery' | 'pickup';

type CartState = {
  storeId: string | null;
  storeName: string | null;
  currency: string;
  items: LocalCartItem[];
  serviceType: CartServiceType;
  deliveryDistanceKm: number | null;
  isOpen: boolean;
};

type CartAction =
  | {
      type: 'ADD';
      storeId: string;
      storeName: string;
      item: Omit<LocalCartItem, 'quantity' | 'cartItemId'>;
    }
  | { type: 'UPDATE_QTY'; menuItemId: string; quantity: number }
  | { type: 'REMOVE'; menuItemId: string }
  | { type: 'CLEAR' }
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'SET_SERVICE_TYPE'; serviceType: CartServiceType }
  | { type: 'SET_DISTANCE'; deliveryDistanceKm: number | null }
  | { type: 'HYDRATE'; state: Omit<CartState, 'isOpen'> };

const EMPTY: CartState = {
  storeId: null,
  storeName: null,
  currency: 'CHF',
  items: [],
  serviceType: 'delivery',
  deliveryDistanceKm: null,
  isOpen: false,
};

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATE':
      // Preserve open/close state so hydrating after an add keeps the panel open.
      return { ...action.state, isOpen: state.isOpen };

    case 'ADD': {
      const sameStore =
        !state.storeId || state.storeId === action.storeId;
      const base: CartState = sameStore
        ? state
        : { ...EMPTY, isOpen: state.isOpen };

      const existing = base.items.find(
        (i) => i.menuItemId === action.item.menuItemId,
      );
      const items: LocalCartItem[] = existing
        ? base.items.map((i) =>
            i.menuItemId === action.item.menuItemId
              ? { ...i, quantity: i.quantity + 1 }
              : i,
          )
        : [...base.items, { ...action.item, quantity: 1 }];

      return {
        ...base,
        storeId: action.storeId,
        storeName: action.storeName,
        currency: action.item.currency || base.currency,
        items,
        isOpen: true,
      };
    }

    case 'UPDATE_QTY': {
      if (action.quantity <= 0) {
        const items = state.items.filter(
          (i) => i.menuItemId !== action.menuItemId,
        );
        return {
          ...state,
          items,
          storeId: items.length === 0 ? null : state.storeId,
          storeName: items.length === 0 ? null : state.storeName,
        };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.menuItemId === action.menuItemId
            ? { ...i, quantity: action.quantity }
            : i,
        ),
      };
    }

    case 'REMOVE': {
      const items = state.items.filter(
        (i) => i.menuItemId !== action.menuItemId,
      );
      return {
        ...state,
        items,
        storeId: items.length === 0 ? null : state.storeId,
        storeName: items.length === 0 ? null : state.storeName,
      };
    }

    case 'CLEAR':
      return { ...EMPTY };

    case 'OPEN':
      return { ...state, isOpen: true };

    case 'CLOSE':
      return { ...state, isOpen: false };

    case 'SET_SERVICE_TYPE':
      return { ...state, serviceType: action.serviceType };

    case 'SET_DISTANCE':
      return { ...state, deliveryDistanceKm: action.deliveryDistanceKm };

    default:
      return state;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapBackendCart(bc: BackendCart): Omit<CartState, 'isOpen'> {
  return {
    storeId: bc.storeId,
    storeName: bc.storeName,
    currency: bc.currency,
    serviceType: (bc.serviceType ?? 'delivery') as CartServiceType,
    deliveryDistanceKm:
      bc.deliveryDistanceKm === null || bc.deliveryDistanceKm === undefined
        ? null
        : Number(bc.deliveryDistanceKm),
    items: bc.items.map((item) => ({
      menuItemId: item.menuItemId,
      name: item.itemNameSnapshot,
      price: item.unitBasePriceSnapshot,
      currency: item.currencySnapshot,
      quantity: item.quantity,
      cartItemId: item.id,
    })),
  };
}

function parseApiError(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    const nested = d.error;
    if (nested && typeof nested === 'object') {
      const msg = (nested as Record<string, unknown>).message;
      if (typeof msg === 'string' && msg.length > 0) return msg;
    }
    const msg = d.message;
    if (typeof msg === 'string' && msg.length > 0) return msg;
  }
  return fallback;
}

// ─── Context contract ─────────────────────────────────────────────────────────

export type CartConflictInfo = {
  currentStoreName: string | null;
  incomingStoreName: string;
};

export type CartContextValue = {
  cart: CartState;
  totalItems: number;
  subtotal: number;
  isSyncing: boolean;
  error: string | null;
  isAuthenticated: boolean;
  addItem: (
    storeId: string,
    storeName: string,
    item: Omit<LocalCartItem, 'quantity' | 'cartItemId'>,
  ) => void;
  updateQty: (menuItemId: string, quantity: number) => void;
  removeItem: (menuItemId: string) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  setServiceType: (serviceType: CartServiceType) => void;
  setDeliveryDistance: (distanceKm: number | null) => void;
  itemQty: (menuItemId: string) => number;
  hasConflict: (storeId: string) => boolean;
  conflictInfo: (
    storeId: string,
    incomingName: string,
  ) => CartConflictInfo | null;
};

const CartContext = createContext<CartContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, dispatch] = useReducer(reducer, EMPTY);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Always-current reference to cart state — safe to read inside callbacks.
  const cartRef = useRef(cart);
  cartRef.current = cart;

  // ── Mount: detect auth, load cart ──────────────────────────────────────────
  useEffect(() => {
    const session = readAuthSession();

    if (session) {
      setIsAuthenticated(true);
      setIsSyncing(true);
      apiClient({ method: 'GET', url: `${BASE_URL}/cart`, token: session.accessToken })
        .then((res) => {
          if (res.ok) {
            const { cart: bc } = res.data as BackendCartResponse;
            if (bc) dispatch({ type: 'HYDRATE', state: mapBackendCart(bc) });
          }
          // Silently ignore load errors on mount — cart stays empty.
        })
        .finally(() => {
          setIsSyncing(false);
          setHydrated(true);
        });
    } else {
      // Guest mode: restore from localStorage.
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Omit<CartState, 'isOpen'>;
          if (Array.isArray(parsed?.items)) {
            dispatch({ type: 'HYDRATE', state: parsed });
          }
        }
      } catch {
        // ignore
      }
      setHydrated(true);
    }
  }, []);

  // ── Guest-mode localStorage persistence ────────────────────────────────────
  const didFirstPersist = useRef(false);
  useEffect(() => {
    if (!hydrated || isAuthenticated) return;
    // Skip the initial run triggered by hydration itself.
    if (!didFirstPersist.current) {
      didFirstPersist.current = true;
      return;
    }
    const { isOpen: _ignored, ...persistable } = cart;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  }, [cart, hydrated, isAuthenticated]);

  // ── addItem ────────────────────────────────────────────────────────────────
  const addItem = useCallback(
    (
      storeId: string,
      storeName: string,
      item: Omit<LocalCartItem, 'quantity' | 'cartItemId'>,
    ) => {
      const session = readAuthSession();
      if (!session) {
        dispatch({ type: 'ADD', storeId, storeName, item });
        return;
      }

      setError(null);
      setIsSyncing(true);

      const currentCart = cartRef.current;
      const hasStoreConflict =
        currentCart.storeId !== null &&
        currentCart.storeId !== storeId &&
        currentCart.items.length > 0;

      const run = async () => {
        if (hasStoreConflict) {
          // Clear the backend cart before adding from a new store.
          const clearRes = await apiClient({
            method: 'DELETE',
            url: `${BASE_URL}/cart`,
            token: session.accessToken,
          });
          if (!clearRes.ok) {
            setError('Sepet temizlenemedi. Lütfen tekrar deneyin.');
            return;
          }
        }

        const res = await apiClient({
          method: 'POST',
          url: `${BASE_URL}/cart/items`,
          token: session.accessToken,
          body: {
            storeId,
            menuItemId: item.menuItemId,
            quantity: 1,
            // Seed a brand-new cart with the mode the customer is browsing in
            // (delivery vs pickup). Ignored by the backend if a cart exists.
            serviceType: cartRef.current.serviceType,
          },
        });

        if (res.ok) {
          const { cart: bc } = res.data as BackendCartResponse;
          if (bc) {
            dispatch({ type: 'HYDRATE', state: mapBackendCart(bc) });
          } else {
            dispatch({ type: 'CLEAR' });
          }
          dispatch({ type: 'OPEN' });
        } else {
          setError(parseApiError(res.data, 'Ürün sepete eklenemedi.'));
        }
      };

      run().finally(() => setIsSyncing(false));
    },
    [],
  );

  // ── updateQty ──────────────────────────────────────────────────────────────
  const updateQty = useCallback((menuItemId: string, quantity: number) => {
    const session = readAuthSession();
    if (!session) {
      dispatch({ type: 'UPDATE_QTY', menuItemId, quantity });
      return;
    }

    const cartItem = cartRef.current.items.find(
      (i) => i.menuItemId === menuItemId,
    );
    if (!cartItem?.cartItemId) {
      // Fallback — shouldn't happen in normal flow.
      dispatch({ type: 'UPDATE_QTY', menuItemId, quantity });
      return;
    }

    setError(null);
    setIsSyncing(true);

    const { cartItemId } = cartItem;

    const run = async () => {
      if (quantity <= 0) {
        const res = await apiClient({
          method: 'DELETE',
          url: `${BASE_URL}/cart/items/${cartItemId}`,
          token: session.accessToken,
        });
        if (res.ok) {
          const { cart: bc } = res.data as BackendCartResponse;
          if (bc) dispatch({ type: 'HYDRATE', state: mapBackendCart(bc) });
          else dispatch({ type: 'CLEAR' });
        } else {
          setError(parseApiError(res.data, 'Ürün kaldırılamadı.'));
        }
      } else {
        const res = await apiClient({
          method: 'PATCH',
          url: `${BASE_URL}/cart/items/${cartItemId}`,
          token: session.accessToken,
          body: { quantity },
        });
        if (res.ok) {
          const { cart: bc } = res.data as BackendCartResponse;
          if (bc) dispatch({ type: 'HYDRATE', state: mapBackendCart(bc) });
        } else {
          setError(parseApiError(res.data, 'Miktar güncellenemedi.'));
        }
      }
    };

    run().finally(() => setIsSyncing(false));
  }, []);

  // ── removeItem ─────────────────────────────────────────────────────────────
  const removeItem = useCallback((menuItemId: string) => {
    const session = readAuthSession();
    if (!session) {
      dispatch({ type: 'REMOVE', menuItemId });
      return;
    }

    const cartItem = cartRef.current.items.find(
      (i) => i.menuItemId === menuItemId,
    );
    if (!cartItem?.cartItemId) {
      dispatch({ type: 'REMOVE', menuItemId });
      return;
    }

    setError(null);
    setIsSyncing(true);

    apiClient({
      method: 'DELETE',
      url: `${BASE_URL}/cart/items/${cartItem.cartItemId}`,
      token: session.accessToken,
    })
      .then((res) => {
        if (res.ok) {
          const { cart: bc } = res.data as BackendCartResponse;
          if (bc) dispatch({ type: 'HYDRATE', state: mapBackendCart(bc) });
          else dispatch({ type: 'CLEAR' });
        } else {
          setError(parseApiError(res.data, 'Ürün kaldırılamadı.'));
        }
      })
      .finally(() => setIsSyncing(false));
  }, []);

  // ── clearCart ──────────────────────────────────────────────────────────────
  const clearCart = useCallback(() => {
    const session = readAuthSession();
    if (!session) {
      dispatch({ type: 'CLEAR' });
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    setError(null);
    setIsSyncing(true);

    apiClient({
      method: 'DELETE',
      url: `${BASE_URL}/cart`,
      token: session.accessToken,
    })
      .then((res) => {
        // 404 means the cart was already gone (e.g. cleared by order creation) —
        // desired state is achieved, so still clear local state.
        if (res.ok || res.status === 404) {
          dispatch({ type: 'CLEAR' });
        } else {
          setError('Sepet temizlenemedi.');
        }
      })
      .finally(() => setIsSyncing(false));
  }, []);

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const openCart = useCallback(() => dispatch({ type: 'OPEN' }), []);
  const closeCart = useCallback(() => dispatch({ type: 'CLOSE' }), []);

  const setServiceType = useCallback((serviceType: CartServiceType) => {
    dispatch({ type: 'SET_SERVICE_TYPE', serviceType });

    const session = readAuthSession();
    if (!session) return;
    if (!cartRef.current.storeId) return;

    setError(null);
    setIsSyncing(true);

    apiClient({
      method: 'PATCH',
      url: `${BASE_URL}/cart/preferences`,
      token: session.accessToken,
      body: { serviceType },
    })
      .then((res) => {
        if (res.ok) {
          const { cart: bc } = res.data as BackendCartResponse;
          if (bc) dispatch({ type: 'HYDRATE', state: mapBackendCart(bc) });
        } else {
          setError(parseApiError(res.data, 'Hizmet tipi güncellenemedi.'));
        }
      })
      .finally(() => setIsSyncing(false));
  }, []);

  const setDeliveryDistance = useCallback((deliveryDistanceKm: number | null) => {
    dispatch({ type: 'SET_DISTANCE', deliveryDistanceKm });

    const session = readAuthSession();
    if (!session) return;
    if (!cartRef.current.storeId) return;

    setError(null);
    setIsSyncing(true);

    apiClient({
      method: 'PATCH',
      url: `${BASE_URL}/cart/preferences`,
      token: session.accessToken,
      body: { deliveryDistanceKm },
    })
      .then((res) => {
        if (res.ok) {
          const { cart: bc } = res.data as BackendCartResponse;
          if (bc) dispatch({ type: 'HYDRATE', state: mapBackendCart(bc) });
        } else {
          setError(parseApiError(res.data, 'Mesafe güncellenemedi.'));
        }
      })
      .finally(() => setIsSyncing(false));
  }, []);

  const itemQty = useCallback(
    (menuItemId: string) =>
      cart.items.find((i) => i.menuItemId === menuItemId)?.quantity ?? 0,
    [cart.items],
  );

  const hasConflict = useCallback(
    (storeId: string) =>
      cart.storeId !== null &&
      cart.storeId !== storeId &&
      cart.items.length > 0,
    [cart.storeId, cart.items.length],
  );

  const conflictInfo = useCallback(
    (storeId: string, incomingName: string): CartConflictInfo | null => {
      if (!hasConflict(storeId)) return null;
      return {
        currentStoreName: cart.storeName,
        incomingStoreName: incomingName,
      };
    },
    [cart.storeName, hasConflict],
  );

  const totalItems = useMemo(
    () => cart.items.reduce((s, i) => s + i.quantity, 0),
    [cart.items],
  );
  const subtotal = useMemo(
    () => cart.items.reduce((s, i) => s + i.price * i.quantity, 0),
    [cart.items],
  );

  // Sağlayıcı value'sini sabitliyoruz — aksi halde her render'da yeni referans
  // üretilir ve tüm useCart() tüketicileri gereksiz yere yeniden render olur.
  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      totalItems,
      subtotal,
      isSyncing,
      error,
      isAuthenticated,
      addItem,
      updateQty,
      removeItem,
      clearCart,
      openCart,
      closeCart,
      setServiceType,
      setDeliveryDistance,
      itemQty,
      hasConflict,
      conflictInfo,
    }),
    [
      cart,
      totalItems,
      subtotal,
      isSyncing,
      error,
      isAuthenticated,
      addItem,
      updateQty,
      removeItem,
      clearCart,
      openCart,
      closeCart,
      setServiceType,
      setDeliveryDistance,
      itemQty,
      hasConflict,
      conflictInfo,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be inside <CartProvider>');
  return ctx;
}
