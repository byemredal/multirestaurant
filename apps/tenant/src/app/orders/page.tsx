'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import TenantDashboardShell from '@/components/tenant/TenantDashboardShell';
import { useTenantAuth } from '@/lib/auth/tenant-auth-context';
import {
  listTenantOrders,
  updateTenantOrderStatus,
  type TenantOrderListItem,
} from '@/lib/tenant-client';
import { useTenantOrderStream } from '@/lib/realtime/tenant-order-stream-context';
import { usePulseTracker } from '@/lib/realtime/use-pulse-tracker';
import { getOrderStatusLabel } from '@/lib/orders/labels';
import { TestOrderLauncher } from '@/components/tenant/tools/TestOrderLauncher';

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

const ACTIVE_STATUS_ORDER = ['pending_confirmation', 'confirmed', 'preparing', 'ready'];
const HISTORY_STATUSES = ['completed', 'rejected', 'cancelled', 'payment_failed', 'pending_payment'];

const NEXT_PRIMARY_STATUS: Record<string, { status: string; label: string }> = {
  confirmed: { status: 'preparing', label: 'Hazırlamaya başla' },
  preparing: { status: 'ready', label: 'Hazır işaretle' },
  ready: { status: 'completed', label: 'Tamamlandı' },
};

type FilterKey = 'all' | 'pending_confirmation' | 'confirmed' | 'preparing' | 'ready' | 'history';

const FILTER_CHIPS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'pending_confirmation', label: 'Onay Bekleyen' },
  { key: 'confirmed', label: 'Onaylandı' },
  { key: 'preparing', label: 'Hazırlanıyor' },
  { key: 'ready', label: 'Hazır' },
  { key: 'history', label: 'Geçmiş' },
];

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function sortActiveOrders(orders: TenantOrderListItem[]) {
  return [...orders].sort((a, b) => {
    const aIdx = ACTIVE_STATUS_ORDER.indexOf(a.status);
    const bIdx = ACTIVE_STATUS_ORDER.indexOf(b.status);
    if (aIdx !== bIdx) return aIdx - bIdx;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export default function TenantOrdersPage() {
  const testOrderToolsEnabled =
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_ENABLE_TEST_ORDERS === 'true';
  const { session, logout } = useTenantAuth();
  const {
    orders: liveOrders,
    loading: streamLoading,
    refreshing: streamRefreshing,
    error: streamError,
    refresh: streamRefresh,
    newOrderIds,
    markSeen,
    applyLocalStatusChange,
  } = useTenantOrderStream();

  const [history, setHistory] = useState<TenantOrderListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoadedOnce, setHistoryLoadedOnce] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<
    { id: string; type: 'success' | 'error'; message: string } | null
  >(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [testOrderOpen, setTestOrderOpen] = useState(false);
  // Pulse logic — Faz E'de hook'a çıkarıldı; dashboard ile aynı UX.
  const pulsingIds = usePulseTracker(newOrderIds, markSeen);

  const fetchHistory = useCallback(async () => {
    if (!session) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const list = await listTenantOrders(session, 'history');
      setHistory(list ?? []);
      setHistoryLoadedOnce(true);
    } catch {
      setHistoryError('Geçmiş siparişler yüklenemedi.');
    } finally {
      setHistoryLoading(false);
    }
  }, [session]);

  // Initial history fetch — operational kısmı context tarafından çekiliyor.
  useEffect(() => {
    if (session) void fetchHistory();
  }, [session, fetchHistory]);

  async function handleSignOut() {
    await logout();
  }

  async function applyStatus(orderId: string, status: string, reason?: string) {
    if (!session || actionBusyId) return;
    setActionBusyId(orderId);
    setActionFeedback(null);
    try {
      const payload = await updateTenantOrderStatus(session, orderId, status, reason);
      const newStatus = payload.order.status;
      applyLocalStatusChange(orderId, newStatus);
      if (HISTORY_STATUSES.includes(newStatus)) {
        void fetchHistory();
      }
      setActionFeedback({
        id: orderId,
        type: 'success',
        message: `Sipariş durumu: ${getOrderStatusLabel(newStatus)}`,
      });
      setRejectingId(null);
      setRejectReason('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'İşlem başarısız.';
      setActionFeedback({ id: orderId, type: 'error', message });
    } finally {
      setActionBusyId(null);
    }
  }

  async function refreshAll() {
    await Promise.all([streamRefresh(), fetchHistory()]);
  }

  if (!session) return null;

  const activeOrders = sortActiveOrders(liveOrders);
  const historyOrders = history;
  const pendingCount = liveOrders.filter((o) => o.status === 'pending_confirmation').length;
  const preparingCount = liveOrders.filter((o) => o.status === 'preparing').length;
  const readyCount = liveOrders.filter((o) => o.status === 'ready').length;
  const activeTotal = activeOrders.length;

  function getFilteredOrders(): TenantOrderListItem[] {
    if (activeFilter === 'all') return [...activeOrders, ...historyOrders];
    if (activeFilter === 'history') return historyOrders;
    return liveOrders.filter((o) => o.status === activeFilter);
  }

  const filtered = getFilteredOrders();
  // İlk açılış spinner'ı: hiç veri yokken. Background refresh sırasında
  // tam-sayfa spinner gösterme.
  const showInitialSpinner =
    (streamLoading && liveOrders.length === 0) || (historyLoading && !historyLoadedOnce);
  const isRefreshing = streamRefreshing || historyLoading;
  const errorMessage = streamError ?? historyError;

  return (
    <TenantDashboardShell
      currentHref="/orders"
      title="Siparişler"
      description="Restoranınıza gelen aktif siparişleri tek tıkla onaylayın, hazırlayın ve tamamlayın."
      companyName={session.tenant.companyName}
      userName={`${session.tenant.firstName} ${session.tenant.lastName}`}
      onSignOut={handleSignOut}
    >
      {!showInitialSpinner && (liveOrders.length > 0 || historyOrders.length > 0) ? (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="Onay Bekleyen" count={pendingCount} accent="amber" />
          <SummaryCard label="Hazırlanıyor" count={preparingCount} accent="blue" />
          <SummaryCard label="Hazır" count={readyCount} accent="green" />
          <SummaryCard label="Aktif Toplam" count={activeTotal} accent="default" />
        </div>
      ) : null}

      <div className="mb-4 flex items-center gap-2">
        <div className="flex flex-1 gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setActiveFilter(chip.key)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
                activeFilter === chip.key
                  ? 'bg-[#f97316] text-white'
                  : 'border border-[#ece2d2] bg-white text-[#78716c] hover:border-[#f97316] hover:text-[#f97316]'
              }`}
            >
              {chip.label}
              {chip.key === 'pending_confirmation' && pendingCount > 0 ? (
                <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-amber-700">
                  {pendingCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        {testOrderToolsEnabled ? <button
          type="button"
          onClick={() => setTestOrderOpen(true)}
          className="ml-2 shrink-0 rounded-[10px] border border-amber-200 bg-amber-50/60 px-3 py-1.5 text-[12px] font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-50"
          title="Realtime ve dashboard akışını gerçek sipariş ile test et"
        >
          + Test siparişi
        </button> : null}
        <button
          onClick={() => void refreshAll()}
          disabled={isRefreshing}
          className="ml-2 shrink-0 rounded-[10px] border border-[#ece2d2] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#78716c] transition hover:border-[#f97316] hover:text-[#f97316] disabled:opacity-50"
          title="Canlı akış 15 saniyede bir otomatik tazelenir"
        >
          {isRefreshing ? (
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 animate-spin rounded-full border border-[#f97316] border-t-transparent" />
              Yenileniyor
            </span>
          ) : (
            'Yenile'
          )}
        </button>
      </div>

      {testOrderToolsEnabled ? (
        <TestOrderLauncher open={testOrderOpen} onClose={() => setTestOrderOpen(false)} />
      ) : null}

      {showInitialSpinner ? (
        <div className="space-y-2.5" aria-busy="true" aria-live="polite">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[88px] animate-pulse rounded-[14px] border border-slate-100 bg-slate-50"
            />
          ))}
        </div>
      ) : null}

      {!showInitialSpinner && errorMessage ? (
        <div className="flex items-center justify-between rounded-[14px] border border-red-200 bg-red-50 px-5 py-4 text-[14px] text-red-700">
          <span>{errorMessage}</span>
          <button
            onClick={() => void refreshAll()}
            className="ml-4 shrink-0 rounded-[8px] border border-red-300 px-3 py-1 text-[12px] font-semibold text-red-700 transition hover:bg-red-100"
          >
            Tekrar dene
          </button>
        </div>
      ) : null}

      {!showInitialSpinner && !errorMessage && filtered.length === 0 ? (
        <EmptyState filter={activeFilter} />
      ) : null}

      {!showInitialSpinner && !errorMessage && filtered.length > 0 ? (
        <div className="space-y-6">
          {activeFilter === 'all' ? (
            <>
              {activeOrders.length > 0 ? (
                <section>
                  <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.16em] text-[#a8a29e]">
                    Aktif Siparişler ({activeOrders.length})
                  </h2>
                  <OrderList
                    orders={activeOrders}
                    pulsingIds={pulsingIds}
                    actionBusyId={actionBusyId}
                    actionFeedback={actionFeedback}
                    rejectingId={rejectingId}
                    rejectReason={rejectReason}
                    onApprove={(orderId) => void applyStatus(orderId, 'confirmed')}
                    onStartReject={(orderId) => {
                      setRejectingId(orderId);
                      setRejectReason('');
                      setActionFeedback(null);
                    }}
                    onCancelReject={() => {
                      setRejectingId(null);
                      setRejectReason('');
                    }}
                    onConfirmReject={(orderId) =>
                      void applyStatus(orderId, 'rejected', rejectReason.trim())
                    }
                    onChangeReason={setRejectReason}
                    onAdvance={(orderId, status) => void applyStatus(orderId, status)}
                  />
                </section>
              ) : null}
              {historyOrders.length > 0 ? (
                <section>
                  <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.16em] text-[#a8a29e]">
                    Geçmiş
                  </h2>
                  <OrderList orders={historyOrders} readOnly />
                </section>
              ) : null}
            </>
          ) : (
            <OrderList
              orders={filtered}
              readOnly={activeFilter === 'history'}
              pulsingIds={pulsingIds}
              actionBusyId={actionBusyId}
              actionFeedback={actionFeedback}
              rejectingId={rejectingId}
              rejectReason={rejectReason}
              onApprove={(orderId) => void applyStatus(orderId, 'confirmed')}
              onStartReject={(orderId) => {
                setRejectingId(orderId);
                setRejectReason('');
                setActionFeedback(null);
              }}
              onCancelReject={() => {
                setRejectingId(null);
                setRejectReason('');
              }}
              onConfirmReject={(orderId) =>
                void applyStatus(orderId, 'rejected', rejectReason.trim())
              }
              onChangeReason={setRejectReason}
              onAdvance={(orderId, status) => void applyStatus(orderId, status)}
            />
          )}
        </div>
      ) : null}
    </TenantDashboardShell>
  );
}

type OrderActionHandlers = {
  pulsingIds?: Set<string>;
  actionBusyId?: string | null;
  actionFeedback?: { id: string; type: 'success' | 'error'; message: string } | null;
  rejectingId?: string | null;
  rejectReason?: string;
  onApprove?: (orderId: string) => void;
  onStartReject?: (orderId: string) => void;
  onCancelReject?: () => void;
  onConfirmReject?: (orderId: string) => void;
  onChangeReason?: (value: string) => void;
  onAdvance?: (orderId: string, status: string) => void;
  readOnly?: boolean;
};

function OrderList({
  orders,
  ...handlers
}: { orders: TenantOrderListItem[] } & OrderActionHandlers) {
  return (
    <div className="grid gap-2">
      {orders.map((order) => (
        <OrderRow key={order.id} order={order} {...handlers} />
      ))}
    </div>
  );
}

function OrderRow({
  order,
  pulsingIds,
  actionBusyId,
  actionFeedback,
  rejectingId,
  rejectReason,
  onApprove,
  onStartReject,
  onCancelReject,
  onConfirmReject,
  onChangeReason,
  onAdvance,
  readOnly,
}: { order: TenantOrderListItem } & OrderActionHandlers) {
  const color = STATUS_COLORS[order.status] ?? 'bg-zinc-50 text-zinc-500 border-zinc-200';
  const label = getOrderStatusLabel(order.status);
  const isPending = order.status === 'pending_confirmation';
  const isBusy = actionBusyId === order.id;
  const isRejecting = rejectingId === order.id;
  const isPulsing = pulsingIds?.has(order.id) ?? false;
  const feedback = actionFeedback?.id === order.id ? actionFeedback : null;
  const advanceAction = NEXT_PRIMARY_STATUS[order.status];

  return (
    <div
      className={`rounded-[14px] border bg-white px-4 py-3 transition ${
        isPending ? 'border-amber-300 shadow-[0_6px_18px_rgba(245,158,11,0.12)]' : 'border-[#ece2d2]'
      } ${isBusy ? 'opacity-70' : ''} ${
        isPulsing ? 'animate-pulse ring-2 ring-amber-400 ring-offset-2 ring-offset-[#fffbf5]' : ''
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12px] text-[#1c1917]">#{order.id.slice(0, 8)}</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${color}`}>
              {label}
            </span>
            {isPulsing ? (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                YENİ GELDİ
              </span>
            ) : isPending ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                YENİ
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-[13px] font-semibold text-[#1c1917]">{order.storeName}</div>
          <div className="mt-0.5 flex flex-wrap gap-3 text-[12px] text-[#78716c]">
            <span>{order.itemCount} ürün</span>
            <span className="font-semibold text-[#1c1917]">
              {order.totalAmount.toFixed(2)} {order.currency}
            </span>
            <span>{formatTime(order.createdAt)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {!readOnly && isPending ? (
            <>
              <button
                type="button"
                disabled={isBusy || isRejecting}
                onClick={() => onApprove?.(order.id)}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-emerald-600 px-3 py-1.5 text-[12.5px] font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {isBusy ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="m4 10 4 4 8-9" />
                  </svg>
                )}
                Onayla
              </button>
              <button
                type="button"
                disabled={isBusy || isRejecting}
                onClick={() => onStartReject?.(order.id)}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-red-300 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m5 5 10 10M15 5 5 15" />
                </svg>
                Reddet
              </button>
            </>
          ) : null}

          {!readOnly && advanceAction ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onAdvance?.(order.id, advanceAction.status)}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#f97316] px-3 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-[#ea580c] disabled:opacity-50"
            >
              {isBusy ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : null}
              {advanceAction.label}
            </button>
          ) : null}

          <Link
            href={`/orders/${order.id}`}
            className="rounded-[10px] border border-[#fed7aa] bg-[#fff1e6] px-3 py-1.5 text-[12.5px] font-semibold text-[#f97316] transition hover:bg-[#fde2c4]"
          >
            Detay
          </Link>
        </div>
      </div>

      {isRejecting ? (
        <div className="mt-3 rounded-[12px] border border-red-200 bg-red-50 p-3">
          <div className="text-[12.5px] font-semibold text-red-700">Reddetme gerekçesi</div>
          <textarea
            value={rejectReason ?? ''}
            onChange={(event) => onChangeReason?.(event.target.value)}
            placeholder="Müşteriye iletilecek kısa gerekçe yazın..."
            rows={2}
            className="mt-2 w-full resize-none rounded-[10px] border border-red-200 bg-white px-3 py-2 text-[13px] text-[#1c1917] outline-none focus:border-red-400 focus:ring-1 focus:ring-red-300"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isBusy || !rejectReason?.trim()}
              onClick={() => onConfirmReject?.(order.id)}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-red-600 px-3.5 py-1.5 text-[12.5px] font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {isBusy ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : null}
              Reddetmeyi onayla
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={onCancelReject}
              className="rounded-[10px] border border-red-200 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Vazgeç
            </button>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <div
          className={`mt-2 rounded-[10px] px-3 py-2 text-[12.5px] ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  count,
  accent,
}: {
  label: string;
  count: number;
  accent: 'amber' | 'blue' | 'green' | 'default';
}) {
  const cardStyles = {
    amber: 'border-amber-200 bg-amber-50',
    blue: 'border-blue-200 bg-blue-50',
    green: 'border-green-200 bg-green-50',
    default: 'border-[#ece2d2] bg-white',
  };
  const numStyles = {
    amber: 'text-amber-700',
    blue: 'text-blue-700',
    green: 'text-green-700',
    default: 'text-[#1c1917]',
  };
  return (
    <div className={`rounded-[14px] border px-4 py-3 ${cardStyles[accent]}`}>
      <div className={`text-[22px] font-bold leading-none ${numStyles[accent]}`}>{count}</div>
      <div className="mt-1 text-[11px] font-medium text-[#78716c]">{label}</div>
    </div>
  );
}

function EmptyState({ filter }: { filter: FilterKey }) {
  const messages: Record<FilterKey, { title: string; sub: string }> = {
    all: {
      title: 'Henüz sipariş yok',
      sub: 'Müşteriler sipariş verdiğinde burada görünecek.',
    },
    pending_confirmation: {
      title: 'Bekleyen sipariş yok',
      sub: 'Onay bekleyen sipariş bulunmuyor.',
    },
    confirmed: {
      title: 'Onaylanmış sipariş yok',
      sub: 'Onaylanmış aktif sipariş bulunmuyor.',
    },
    preparing: {
      title: 'Hazırlanan sipariş yok',
      sub: 'Şu an hazırlanan sipariş bulunmuyor.',
    },
    ready: {
      title: 'Hazır sipariş yok',
      sub: 'Teslimata hazır sipariş bulunmuyor.',
    },
    history: {
      title: 'Geçmiş sipariş yok',
      sub: 'Tamamlanan, reddedilen veya iptal edilen siparişler burada görünecek.',
    },
  };
  const { title, sub } = messages[filter];
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-[16px] font-semibold text-[#1c1917]">{title}</p>
      <p className="mt-1 text-[13px] text-[#a8a29e]">{sub}</p>
    </div>
  );
}
