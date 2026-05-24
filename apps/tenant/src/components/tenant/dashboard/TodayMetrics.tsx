'use client';

import type { TenantOrderListItem } from '@/lib/tenant-client';

const NON_REVENUE_STATUSES = new Set([
  'rejected',
  'cancelled',
  'payment_failed',
  'pending_payment',
]);

function isFromToday(iso: string, todayStartMs: number, tomorrowStartMs: number) {
  const t = new Date(iso).getTime();
  return t >= todayStartMs && t < tomorrowStartMs;
}

function formatAmount(amount: number) {
  return amount.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function TodayMetrics({
  activeOrders,
  todayHistory,
  loading,
  error,
}: {
  activeOrders: TenantOrderListItem[];
  todayHistory: TenantOrderListItem[];
  loading: boolean;
  error: string | null;
}) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;

  const todayActive = activeOrders.filter((o) =>
    isFromToday(o.createdAt, todayStart, tomorrowStart),
  );
  const todayClosed = todayHistory.filter((o) =>
    isFromToday(o.createdAt, todayStart, tomorrowStart),
  );
  const counted = [...todayActive, ...todayClosed].filter(
    (o) => !NON_REVENUE_STATUSES.has(o.status),
  );

  const revenue = counted.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const orderCount = counted.length;
  const avgBasket = orderCount > 0 ? revenue / orderCount : 0;
  const currency = counted[0]?.currency ?? null;

  if (loading) {
    return (
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[148px] animate-pulse rounded-[18px] border border-slate-100 bg-slate-50"
          />
        ))}
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-[18px] border border-red-200 bg-red-50 p-5 text-[13px] text-red-700">
        Bugünün özeti yüklenemedi: {error}
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <MetricCard
        eyebrow="Bugünün Cirosu"
        value={currency ? formatAmount(revenue) : '—'}
        suffix={currency}
        hint={
          orderCount === 0
            ? 'Henüz hesaba katılan sipariş yok'
            : 'İptal, red ve ödeme başarısız hariç'
        }
        emphasized
      />
      <MetricCard
        eyebrow="Sipariş Sayısı"
        value={orderCount.toString()}
        hint={orderCount === 0 ? 'Bugün başlatılan sipariş yok' : 'Bugün başlatılan'}
      />
      <MetricCard
        eyebrow="Ortalama Sepet"
        value={orderCount > 0 && currency ? formatAmount(avgBasket) : '—'}
        suffix={orderCount > 0 ? currency : null}
        hint={orderCount > 0 ? 'Sipariş başına ortalama' : 'Veri yok'}
      />
    </section>
  );
}

function MetricCard({
  eyebrow,
  value,
  suffix,
  hint,
  emphasized,
}: {
  eyebrow: string;
  value: string;
  suffix?: string | null;
  hint: string;
  emphasized?: boolean;
}) {
  return (
    <div className="rounded-[18px] border border-slate-100 bg-white p-6">
      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
        {eyebrow}
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <div
          className={`text-[40px] font-semibold leading-none tracking-[-0.04em] tabular-nums ${
            emphasized ? 'text-[#09479A]' : 'text-slate-900'
          }`}
        >
          {value}
        </div>
        {suffix ? (
          <div className="text-[14px] font-semibold uppercase tracking-wide text-slate-400">
            {suffix}
          </div>
        ) : null}
      </div>
      <div className="mt-4 border-t border-slate-100 pt-3 text-[11.5px] text-slate-500">
        {hint}
      </div>
    </div>
  );
}
