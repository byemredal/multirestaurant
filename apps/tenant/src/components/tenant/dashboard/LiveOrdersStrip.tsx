'use client';

import Link from 'next/link';
import type { TenantOrderListItem } from '@/lib/tenant-client';
import { getOrderStatusLabel } from '@/lib/orders/labels';

const STATUS_TONE: Record<string, string> = {
  pending_confirmation: 'border-amber-200 bg-amber-50 text-amber-800',
  confirmed: 'border-[#09479A]/15 bg-[#09479A]/[0.06] text-[#09479A]',
  preparing: 'border-[#09479A]/15 bg-[#09479A]/[0.06] text-[#09479A]',
  ready: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

const ACTIVE_ORDER = ['pending_confirmation', 'confirmed', 'preparing', 'ready'];

function minutesAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60_000));
  if (mins < 1) return 'şimdi';
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  return `${Math.floor(hours / 24)} g önce`;
}

export function LiveOrdersStrip({
  orders,
  loading,
  pulsingIds,
  maxItems = 6,
}: {
  orders: TenantOrderListItem[];
  loading: boolean;
  pulsingIds?: ReadonlySet<string>;
  maxItems?: number;
}) {
  const sorted = [...orders].sort((a, b) => {
    const ai = ACTIVE_ORDER.indexOf(a.status);
    const bi = ACTIVE_ORDER.indexOf(b.status);
    if (ai !== bi) return ai - bi;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const visible = sorted.slice(0, maxItems);
  const pendingCount = orders.filter((o) => o.status === 'pending_confirmation').length;

  return (
    <section className="rounded-[18px] border border-slate-100 bg-white p-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
            Canlı Akış
          </div>
          <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.01em] text-slate-900">
            Aktif Sipariş Şeridi
          </h2>
          <p className="mt-1 text-[12.5px] text-slate-500">
            {orders.length === 0 && !loading
              ? 'Şu an aktif sipariş yok.'
              : `${orders.length} aktif sipariş${pendingCount > 0 ? ` · ${pendingCount} onay bekliyor` : ''}`}
          </p>
        </div>
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#09479A] transition hover:underline"
        >
          Tüm siparişler
          <span aria-hidden>→</span>
        </Link>
      </header>

      {loading && orders.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[112px] animate-pulse rounded-[14px] border border-slate-100 bg-slate-50"
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-slate-200 bg-slate-50/60 py-12 text-center">
          <p className="text-[14px] font-semibold text-slate-900">Sakin saatler</p>
          <p className="mt-1 max-w-[300px] text-[12.5px] text-slate-500">
            Yeni sipariş gelir gelmez burada belirir ve sesli bildirim çalar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((order) => {
            const isPulsing = pulsingIds?.has(order.id) ?? false;
            const tone =
              STATUS_TONE[order.status] ?? 'border-slate-200 bg-slate-50 text-slate-600';
            return (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className={`group flex flex-col rounded-[14px] border bg-white p-4 transition hover:border-[#09479A]/30 hover:shadow-[0_8px_22px_rgba(9,71,154,0.06)] ${
                  isPulsing
                    ? 'animate-pulse border-amber-400 ring-2 ring-amber-300'
                    : 'border-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-slate-400">
                    #{order.id.slice(0, 8)}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${tone}`}
                  >
                    {getOrderStatusLabel(order.status)}
                  </span>
                </div>
                <div className="mt-3 text-[14px] font-semibold tracking-[-0.01em] text-slate-900">
                  {order.storeName}
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2 text-[12px] text-slate-500">
                  <span>{order.itemCount} ürün</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {order.totalAmount.toFixed(2)} {order.currency}
                  </span>
                </div>
                <div className="mt-3 text-[11px] uppercase tracking-[0.12em] text-slate-400">
                  {minutesAgo(order.createdAt)}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
