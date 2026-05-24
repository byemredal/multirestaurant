'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTenantAuth } from '@/lib/auth/tenant-auth-context';
import { listTenantOrders, type TenantOrderListItem } from '@/lib/tenant-client';
import { armNotificationSound, playNewOrderBeep } from './notification-sound';

const POLL_INTERVAL_MS = 15_000;

const ACTIVE_STATUSES = new Set<string>([
  'pending_confirmation',
  'confirmed',
  'preparing',
  'ready',
]);

type StreamValue = {
  /** Operasyonel statüdeki canlı sipariş listesi (15 sn polling). */
  orders: TenantOrderListItem[];
  /** İlk açılışta sayfaya iskelet (skeleton) gösterilebilmesi için. */
  loading: boolean;
  /** Arka plan refresh sırasında — header/refresh tuşu işaretleyebilir. */
  refreshing: boolean;
  error: string | null;
  /** Sidebar / nav badge için onay bekleyen sayısı. */
  pendingCount: number;
  /** Son refresh'te ilk kez görülen sipariş ID'leri. Highlight/sound tüketicide. */
  newOrderIds: ReadonlySet<string>;
  /** Manuel "Yenile" tetikleyici. */
  refresh: () => Promise<void>;
  /** Yeni-sipariş işaretini düşür. Tüketici highlight'ı tetikledikten sonra çağırmalı. */
  markSeen: (orderIds?: string[]) => void;
  /** Tenant status update'i sonrası optimistic mutasyon. Aktif statüden çıkan
   *  sipariş otomatik listeden düşer. */
  applyLocalStatusChange: (orderId: string, status: string) => void;
};

const noop = () => {};
const asyncNoop = async () => {};

const DEFAULT_VALUE: StreamValue = {
  orders: [],
  loading: false,
  refreshing: false,
  error: null,
  pendingCount: 0,
  newOrderIds: new Set(),
  refresh: asyncNoop,
  markSeen: noop,
  applyLocalStatusChange: noop,
};

const TenantOrderStreamContext = createContext<StreamValue>(DEFAULT_VALUE);

export function TenantOrderStreamProvider({ children }: { children: ReactNode }) {
  const { session, status } = useTenantAuth();
  const isActiveTenant = Boolean(session) && status === 'ACTIVE';

  const [orders, setOrders] = useState<TenantOrderListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());

  // Diff için bilinen ID snapshot'u.
  const knownIdsRef = useRef<Set<string>>(new Set());
  // İlk fetch tamamlanana kadar gelen siparişleri "yeni" sayma (initial load
  // beep yağdırmasın).
  const hasLoadedOnceRef = useRef(false);
  // Eşzamanlı fetch çakışmasını engelle.
  const inflightRef = useRef(false);

  const fetchOnce = useCallback(
    async (isBackground: boolean) => {
      if (!session || inflightRef.current) return;
      inflightRef.current = true;
      if (isBackground) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const list = await listTenantOrders(session, 'operational');
        const next = list ?? [];
        const incomingIdList = next.map((o) => o.id);

        const freshIds: string[] = [];
        if (hasLoadedOnceRef.current) {
          for (const id of incomingIdList) {
            if (!knownIdsRef.current.has(id)) freshIds.push(id);
          }
        }
        knownIdsRef.current = new Set(incomingIdList);
        hasLoadedOnceRef.current = true;

        setOrders(next);
        setError(null);

        if (freshIds.length > 0) {
          setNewOrderIds((current) => {
            const merged = new Set(current);
            for (const id of freshIds) merged.add(id);
            return merged;
          });
          playNewOrderBeep();
        }
      } catch {
        setError('Siparişler yüklenemedi.');
      } finally {
        setLoading(false);
        setRefreshing(false);
        inflightRef.current = false;
      }
    },
    [session],
  );

  // Lifecycle: oturum aktifken initial fetch + 15 sn polling +
  // visibilitychange. Tenant active değilken hiçbir şey yapma.
  useEffect(() => {
    if (!isActiveTenant) {
      // Logout / status değişimi: state'i temizle.
      knownIdsRef.current = new Set();
      hasLoadedOnceRef.current = false;
      setOrders([]);
      setNewOrderIds(new Set());
      setError(null);
      return;
    }

    void fetchOnce(false);

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startInterval = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        if (document.visibilityState === 'visible') {
          void fetchOnce(true);
        }
      }, POLL_INTERVAL_MS);
    };

    const stopInterval = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchOnce(true);
        startInterval();
      } else {
        stopInterval();
      }
    };

    if (document.visibilityState === 'visible') {
      startInterval();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopInterval();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActiveTenant, fetchOnce]);

  // Autoplay policy: ilk kullanıcı etkileşiminde AudioContext'i arm et.
  useEffect(() => {
    if (!isActiveTenant) return;
    const arm = () => {
      armNotificationSound();
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
    };
    window.addEventListener('pointerdown', arm, { once: true });
    window.addEventListener('keydown', arm, { once: true });
    return () => {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
    };
  }, [isActiveTenant]);

  const refresh = useCallback(async () => {
    await fetchOnce(true);
  }, [fetchOnce]);

  const markSeen = useCallback((ids?: string[]) => {
    setNewOrderIds((current) => {
      if (!ids || ids.length === 0) return new Set();
      const next = new Set(current);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const applyLocalStatusChange = useCallback((orderId: string, newStatus: string) => {
    setOrders((current) => {
      const updated = current.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: newStatus,
              lastStatusChangedAt: new Date().toISOString(),
            }
          : o,
      );
      // Aktif statüden çıkan sipariş operational stream'den düşer.
      const filtered = updated.filter((o) => ACTIVE_STATUSES.has(o.status));
      knownIdsRef.current = new Set(filtered.map((o) => o.id));
      return filtered;
    });
  }, []);

  const pendingCount = orders.reduce(
    (count, o) => (o.status === 'pending_confirmation' ? count + 1 : count),
    0,
  );

  return (
    <TenantOrderStreamContext.Provider
      value={{
        orders,
        loading,
        refreshing,
        error,
        pendingCount,
        newOrderIds,
        refresh,
        markSeen,
        applyLocalStatusChange,
      }}
    >
      {children}
    </TenantOrderStreamContext.Provider>
  );
}

/** Provider yoksa default değerler döner — provider dışı render'lar (login,
 *  onboarding) hiçbir şey yapmayan no-op state alır. */
export function useTenantOrderStream(): StreamValue {
  return useContext(TenantOrderStreamContext);
}
