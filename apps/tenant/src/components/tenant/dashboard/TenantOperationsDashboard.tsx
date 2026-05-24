'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import TenantDashboardShell from '@/components/tenant/TenantDashboardShell';
import { useTenantAuth } from '@/lib/auth/tenant-auth-context';
import { useTenantOrderStream } from '@/lib/realtime/tenant-order-stream-context';
import { usePulseTracker } from '@/lib/realtime/use-pulse-tracker';
import {
  listTenantMenuCategories,
  listTenantMenuItems,
  listTenantOrders,
  type TenantOrderListItem,
} from '@/lib/tenant-client';
import {
  computeSetupProgress,
  hasMeaningfulOpeningHours,
} from '@/lib/dashboard/setup-progress';
import { useTenantStores } from '@/lib/tenant-store-context';
import { LiveOrdersStrip } from './LiveOrdersStrip';
import { TodayMetrics } from './TodayMetrics';
import { StoreStatusCard } from './StoreStatusCard';
import { QuickActions } from './QuickActions';
import { RecentActivityFeed } from './RecentActivityFeed';
import { SetupProgressCard } from './SetupProgressCard';
import { EmptyTenantHero } from './EmptyTenantHero';

function todayMidnightIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

export default function TenantOperationsDashboard() {
  const { session, logout } = useTenantAuth();
  const {
    orders: liveOrders,
    loading: streamLoading,
    refreshing: streamRefreshing,
    error: streamError,
    refresh: streamRefresh,
    newOrderIds,
    markSeen,
  } = useTenantOrderStream();

  const {
    stores,
    activeStoreId,
    loading: storesLoading,
    loadedOnce: storesLoadedOnce,
    error: storesError,
    refresh: refreshStores,
  } = useTenantStores();

  const [todayHistory, setTodayHistory] = useState<TenantOrderListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoadedOnce, setHistoryLoadedOnce] = useState(false);

  const [primaryStoreCounts, setPrimaryStoreCounts] = useState<{
    storeId: string;
    categoryCount: number;
    menuItemCount: number;
  } | null>(null);
  const [countsLoading, setCountsLoading] = useState(false);

  // Pulse logic ortak hook'ta — orders sayfasıyla birebir tutarlı UX.
  const pulsingIds = usePulseTracker(newOrderIds, markSeen);

  // Aktif store değiştikçe bugünkü tarihçe de o store'a göre filtrelenir.
  // Live stream şimdilik tenant-bazlı (filter yok); bu plan kararı (Faz B foundation).
  const fetchTodayHistory = useCallback(async () => {
    if (!session) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const list = await listTenantOrders(session, 'history', {
        createdFrom: todayMidnightIso(),
        storeId: activeStoreId ?? undefined,
      });
      setTodayHistory(list ?? []);
      setHistoryLoadedOnce(true);
    } catch {
      setHistoryError('Bugünkü kapanan siparişler yüklenemedi.');
    } finally {
      setHistoryLoading(false);
    }
  }, [session, activeStoreId]);

  const fetchPrimaryStoreCounts = useCallback(
    async (storeId: string) => {
      if (!session) return;
      setCountsLoading(true);
      try {
        const [categories, items] = await Promise.all([
          listTenantMenuCategories(session, storeId),
          listTenantMenuItems(session, storeId),
        ]);
        setPrimaryStoreCounts({
          storeId,
          categoryCount: Array.isArray(categories) ? categories.length : 0,
          menuItemCount: Array.isArray(items) ? items.length : 0,
        });
      } catch {
        // Sessiz başarısızlık — setup progress eksik adım gibi davranır;
        // tüm dashboard'ı bloklamamak gerekir.
        setPrimaryStoreCounts({ storeId, categoryCount: 0, menuItemCount: 0 });
      } finally {
        setCountsLoading(false);
      }
    },
    [session],
  );

  useEffect(() => {
    if (session) {
      void fetchTodayHistory();
    }
  }, [session, fetchTodayHistory]);

  useEffect(() => {
    if (!activeStoreId) {
      setPrimaryStoreCounts(null);
      return;
    }
    if (primaryStoreCounts?.storeId === activeStoreId) return;
    void fetchPrimaryStoreCounts(activeStoreId);
  }, [activeStoreId, primaryStoreCounts?.storeId, fetchPrimaryStoreCounts]);

  async function handleSignOut() {
    await logout();
  }

  async function refreshAll() {
    await Promise.all([streamRefresh(), fetchTodayHistory(), refreshStores()]);
    if (activeStoreId) {
      await fetchPrimaryStoreCounts(activeStoreId);
    }
  }

  const progress = useMemo(() => {
    if (!storesLoadedOnce) return null;
    if (stores.length === 0) return null;
    return computeSetupProgress({
      storeCount: stores.length,
      hasOpeningHours: hasMeaningfulOpeningHours(stores),
      categoryCount: primaryStoreCounts?.categoryCount ?? 0,
      menuItemCount: primaryStoreCounts?.menuItemCount ?? 0,
      observedOrderCount: liveOrders.length + todayHistory.length,
    });
  }, [storesLoadedOnce, stores, primaryStoreCounts, liveOrders.length, todayHistory.length]);

  if (!session) return null;

  const metricsLoading = streamLoading && liveOrders.length === 0 && !historyLoadedOnce;
  const recentActivity: TenantOrderListItem[] = [...liveOrders, ...todayHistory];
  const isRefreshing = streamRefreshing || historyLoading || storesLoading;

  const showEmptyHero = storesLoadedOnce && stores.length === 0;
  const progressLoading =
    storesLoading ||
    (activeStoreId !== null && primaryStoreCounts?.storeId !== activeStoreId && countsLoading);

  if (showEmptyHero) {
    return (
      <TenantDashboardShell
        currentHref="/dashboard"
        title="Operasyon Merkezi"
        description="İlk restoranını oluşturarak başla — operasyon paneli devreye girsin."
        companyName={session.tenant.companyName}
        userName={`${session.tenant.firstName} ${session.tenant.lastName}`}
        onSignOut={handleSignOut}
      >
        <EmptyTenantHero />
      </TenantDashboardShell>
    );
  }

  return (
    <TenantDashboardShell
      currentHref="/dashboard"
      title="Operasyon Merkezi"
      description="Restoranınızın bugünkü canlı durumunu, son hareketleri ve kritik aksiyonları tek panelden takip edin."
      companyName={session.tenant.companyName}
      userName={`${session.tenant.firstName} ${session.tenant.lastName}`}
      onSignOut={handleSignOut}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-[11.5px] uppercase tracking-[0.16em] text-slate-400">
          Canlı akış · 15 sn'de bir otomatik tazelenir
          {streamRefreshing ? ' · Yenileniyor…' : ''}
        </p>
        <button
          type="button"
          onClick={() => void refreshAll()}
          disabled={isRefreshing}
          className="rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:border-[#09479A]/30 hover:text-[#09479A] disabled:opacity-50"
        >
          {isRefreshing ? (
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 animate-spin rounded-full border border-[#09479A] border-t-transparent" />
              Yenileniyor
            </span>
          ) : (
            'Yenile'
          )}
        </button>
      </div>

      {streamError ? (
        <div className="mb-4 flex items-center justify-between rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-700">
          <span>Canlı sipariş akışı sorunu: {streamError}</span>
          <button
            type="button"
            onClick={() => void streamRefresh()}
            className="ml-3 rounded-[8px] border border-red-300 px-2.5 py-1 text-[11.5px] font-semibold text-red-700 hover:bg-red-100"
          >
            Tekrar dene
          </button>
        </div>
      ) : null}

      <div className="grid gap-4">
        <SetupProgressCard progress={progress} loading={progressLoading} />
        <LiveOrdersStrip
          orders={liveOrders}
          loading={streamLoading && liveOrders.length === 0}
          pulsingIds={pulsingIds}
        />

        <TodayMetrics
          activeOrders={liveOrders}
          todayHistory={todayHistory}
          loading={metricsLoading || (historyLoading && !historyLoadedOnce)}
          error={historyError}
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <RecentActivityFeed
            orders={recentActivity}
            loading={streamLoading && historyLoading && recentActivity.length === 0}
          />
          <div className="grid gap-4">
            <StoreStatusCard
              stores={stores}
              loading={storesLoading}
              error={storesError}
              onUpdated={refreshStores}
            />
            <QuickActions />
          </div>
        </div>
      </div>
    </TenantDashboardShell>
  );
}
