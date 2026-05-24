'use client';

import Link from 'next/link';
import type { TenantOrderListItem } from '@/lib/tenant-client';
import { getOrderStatusLabel } from '@/lib/orders/labels';

const STATUS_TONE: Record<string, string> = {
  pending_confirmation: 'bg-amber-500',
  confirmed: 'bg-[#09479A]',
  preparing: 'bg-[#09479A]',
  ready: 'bg-emerald-500',
  completed: 'bg-slate-400',
  rejected: 'bg-red-500',
  cancelled: 'bg-slate-400',
  payment_failed: 'bg-red-400',
  pending_payment: 'bg-amber-400',
};

function timeAgo(iso: string | null) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  const diffMin = Math.max(0, Math.floor((Date.now() - t) / 60_000));
  if (diffMin < 1) return 'az önce';
  if (diffMin < 60) return `${diffMin} dk önce`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h} sa önce`;
  return `${Math.floor(h / 24)} g önce`;
}

export function RecentActivityFeed({
  orders,
  loading,
  maxItems = 8,
}: {
  orders: TenantOrderListItem[];
  loading: boolean;
  maxItems?: number;
}) {
  const sorted = [...orders].sort((a, b) => {
    const aTs = new Date(a.lastStatusChangedAt ?? a.createdAt).getTime();
    const bTs = new Date(b.lastStatusChangedAt ?? b.createdAt).getTime();
    return bTs - aTs;
  });
  const visible = sorted.slice(0, maxItems);

  return (
    <section className="rounded-[18px] border border-slate-100 bg-white p-6">
      <header className="mb-4 flex items-end justify-between border-b border-slate-100 pb-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
            Akış
          </div>
          <h3 className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-slate-900">
            Son Aktivite
          </h3>
        </div>
        <Link
          href="/orders"
          className="text-[12px] font-semibold text-[#09479A] transition hover:underline"
        >
          Tümü →
        </Link>
      </header>

      {loading && visible.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-[10px] bg-slate-50" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-slate-200 bg-slate-50/60 py-8 text-center text-[12.5px] text-slate-500">
          Bugün için henüz aktivite yok.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {visible.map((order) => {
            const tone = STATUS_TONE[order.status] ?? 'bg-slate-400';
            const stamp = order.lastStatusChangedAt ?? order.createdAt;
            return (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex items-center gap-3 py-3 transition hover:bg-slate-50/60"
                >
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${tone}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold tracking-[-0.005em] text-slate-900">
                        {getOrderStatusLabel(order.status)} · {order.storeName}
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(stamp)}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5 text-[11.5px] text-slate-500">
                      <span className="font-mono">#{order.id.slice(0, 8)}</span>
                      <span aria-hidden>·</span>
                      <span>{order.itemCount} ürün</span>
                      <span aria-hidden>·</span>
                      <span className="font-semibold tabular-nums text-slate-900">
                        {order.totalAmount.toFixed(2)} {order.currency}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
