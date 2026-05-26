'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useStaffAuth } from '@/lib/auth/staff-auth-context';
import {
  listStaffOrders,
  listStaffStores,
  type StaffOrderListItem,
  type StaffOrderListQuery,
  type StaffStoreSummary,
} from '@/lib/auth/staff-client';
import { getOrderStatusLabel } from '@/lib/orders/labels';

type ScopeKey = 'operational' | 'history';

const SCOPE_TABS: { key: ScopeKey; label: string }[] = [
  { key: 'operational', label: 'Aktif' },
  { key: 'history', label: 'Geçmiş' },
];

const STATUS_COLORS: Record<string, string> = {
  pending_confirmation: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  preparing: 'bg-blue-50 text-blue-700 border-blue-200',
  ready: 'bg-green-50 text-green-700 border-green-200',
  completed: 'bg-zinc-50 text-zinc-500 border-zinc-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-zinc-50 text-zinc-400 border-zinc-200',
  payment_failed: 'bg-red-50 text-red-600 border-red-200',
  pending_payment: 'bg-amber-50 text-amber-600 border-amber-200',
};

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function shortenStoreId(id: string) {
  return id.slice(0, 8);
}

/**
 * `/staff/orders` workspace. Uses the isolated staff session (NOT the
 * tenant session) so a staff token never leaks into a tenant-owner code
 * path. Read-only for this slice; status mutations are deferred until
 * staff write-permissions land.
 */
export default function StaffOrdersWorkspace() {
  const { session } = useStaffAuth();
  const [scope, setScope] = useState<ScopeKey>('operational');
  const [storeFilter, setStoreFilter] = useState<string | 'all'>('all');
  const [orders, setOrders] = useState<StaffOrderListItem[]>([]);
  const [stores, setStores] = useState<StaffStoreSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const store of stores) map.set(store.id, store.name);
    return map;
  }, [stores]);

  const loadOrders = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!session) return;
      if (opts.silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const query: StaffOrderListQuery = { scope };
        if (storeFilter !== 'all') query.storeId = storeFilter;
        const next = await listStaffOrders(session, query);
        setOrders(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Siparişler yüklenemedi.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [session, scope, storeFilter],
  );

  const loadStores = useCallback(async () => {
    if (!session) return;
    try {
      const next = await listStaffStores(session);
      setStores(next);
    } catch {
      // Store hydration is best-effort: fall back to UUIDs.
      setStores([]);
    }
  }, [session]);

  useEffect(() => {
    void loadStores();
  }, [loadStores]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  if (!session) return null;

  const showInitialSpinner = loading && orders.length === 0;
  const showEmpty = !loading && !error && orders.length === 0;

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Personel
          </div>
          <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.01em] text-slate-900 sm:text-[24px]">
            Siparişler
          </h1>
          <p className="mt-1 text-[13px] text-slate-500">
            Yalnızca size atanmış mağazalara ait siparişleri görüntülüyorsunuz.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/staff/dashboard"
            className="rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Panele dön
          </Link>
          <button
            type="button"
            onClick={() => void loadOrders({ silent: true })}
            disabled={refreshing || loading}
            className="rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {refreshing ? 'Yenileniyor…' : 'Yenile'}
          </button>
        </div>
      </header>

      <section className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {SCOPE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setScope(tab.key)}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
                scope === tab.key
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label
            htmlFor="staff-store-filter"
            className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-slate-400"
          >
            Mağaza
          </label>
          <select
            id="staff-store-filter"
            value={storeFilter}
            onChange={(event) => setStoreFilter(event.target.value)}
            className="rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-slate-400"
          >
            <option value="all">Tümü ({session.staff.storeScope.length})</option>
            {session.staff.storeScope.map((id) => (
              <option key={id} value={id}>
                {storeNameById.get(id) ?? `Mağaza ${shortenStoreId(id)}`}
              </option>
            ))}
          </select>
        </div>
      </section>

      {showInitialSpinner ? (
        <div className="space-y-2.5" aria-busy="true" aria-live="polite">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[96px] animate-pulse rounded-[14px] border border-slate-100 bg-slate-50"
            />
          ))}
        </div>
      ) : null}

      {!showInitialSpinner && error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-red-200 bg-red-50 px-5 py-4 text-[13px] text-red-700">
          <span className="break-words">{error}</span>
          <button
            type="button"
            onClick={() => void loadOrders()}
            className="shrink-0 rounded-[8px] border border-red-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-red-700 transition hover:bg-red-100"
          >
            Tekrar dene
          </button>
        </div>
      ) : null}

      {showEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-[16px] border border-slate-100 bg-white py-16 text-center">
          <p className="text-[15px] font-semibold text-slate-800">
            {scope === 'operational' ? 'Aktif sipariş yok' : 'Geçmiş sipariş yok'}
          </p>
          <p className="mt-1 max-w-[400px] text-[12.5px] text-slate-500">
            {scope === 'operational'
              ? 'Atanmış mağazalarınıza yeni sipariş geldiğinde burada görünecek.'
              : 'Tamamlanan, reddedilen veya iptal edilen siparişler burada listelenir.'}
          </p>
        </div>
      ) : null}

      {!showInitialSpinner && !error && orders.length > 0 ? (
        <div className="grid gap-2.5">
          {orders.map((order) => (
            <StaffOrderRow
              key={order.id}
              order={order}
              storeName={storeNameById.get(order.storeId) ?? order.storeName ?? null}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StaffOrderRow({
  order,
  storeName,
}: {
  order: StaffOrderListItem;
  storeName: string | null;
}) {
  const color = STATUS_COLORS[order.status] ?? 'bg-zinc-50 text-zinc-500 border-zinc-200';
  const label = getOrderStatusLabel(order.status);
  const displayedStore = storeName ?? `Mağaza ${shortenStoreId(order.storeId)}`;
  const customer = order.customerSummary;
  const customerName = customer?.fullName?.trim() || customer?.email || '—';

  return (
    <article className="rounded-[14px] border border-slate-100 bg-white px-4 py-3 transition hover:border-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12px] text-slate-700">
              #{order.id.slice(0, 8)}
            </span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${color}`}
            >
              {label}
            </span>
            {order.isActionable ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                Operasyonel
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-[13.5px] font-semibold text-slate-900">
            {displayedStore}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-3 text-[12px] text-slate-500">
            <span className="truncate">{customerName}</span>
            <span>{order.itemCount} ürün</span>
            <span className="font-semibold text-slate-700">
              {order.totalAmount.toFixed(2)} {order.currencySnapshot}
            </span>
            <span>{formatTime(order.createdAt)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
