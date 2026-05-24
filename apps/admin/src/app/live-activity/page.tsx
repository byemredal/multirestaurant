'use client';

import { useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { MetricGrid, PageHeader, SectionCard, type Metric } from '@/components/ui';
import { Icon, type IconName } from '@/lib/icons';

type Category = 'orders' | 'stores' | 'finance' | 'delivery' | 'system';

type ActivityEvent = {
  id: string;
  title: string;
  meta: string;
  time: string;
  icon: IconName;
  category: Category;
};

const events: ActivityEvent[] = [
  { id: 'e1', title: 'Order #LZ-92481 placed · Burger District — Mitte', meta: '€42.80 · Delivery · Jonas Weber', time: '12:48:21', icon: 'bag', category: 'orders' },
  { id: 'e2', title: 'Courier Kemal Y. accepted order #LZ-92479', meta: 'Zone Berlin-Mitte', time: '12:47:55', icon: 'truck', category: 'delivery' },
  { id: 'e3', title: 'Store “Sushi Komachi — Schwabing” reopened', meta: 'Manual reopen · store manager', time: '12:46:10', icon: 'store', category: 'stores' },
  { id: 'e4', title: 'Payment captured for order #LZ-92474', meta: '€18.40 · Apple Pay', time: '12:44:02', icon: 'card', category: 'finance' },
  { id: 'e5', title: 'Webhook order.updated delivered', meta: '186 ms · 200 OK', time: '12:43:30', icon: 'webhook', category: 'system' },
  { id: 'e6', title: 'Refund issued for order #LZ-92402', meta: '€18.50 · Missing item', time: '12:41:18', icon: 'refund', category: 'finance' },
  { id: 'e7', title: 'Order #LZ-92468 delivered', meta: '38 min delivery time · Curry House', time: '12:39:44', icon: 'check', category: 'orders' },
  { id: 'e8', title: 'High demand detected — Frankfurt-Centre', meta: 'ETAs extended by 12 min', time: '12:36:09', icon: 'activity', category: 'system' },
  { id: 'e9', title: 'Courier Hannah R. went available', meta: 'Zone Berlin-Kreuzberg', time: '12:34:51', icon: 'truck', category: 'delivery' },
  { id: 'e10', title: 'Menu updated — Curry House — Mitte', meta: '2 items marked unavailable', time: '12:31:27', icon: 'menu', category: 'stores' },
  { id: 'e11', title: 'Order #LZ-92462 cancelled by customer', meta: '€12.90 · refunded automatically', time: '12:28:03', icon: 'close', category: 'orders' },
  { id: 'e12', title: 'Payout batch PB-2271 settled', meta: '€128,400 · 211 stores', time: '12:24:40', icon: 'payout', category: 'finance' },
  { id: 'e13', title: 'Feature flag dynamic-delivery-fee at 60%', meta: 'Rollout increased by Emre Dal', time: '12:19:12', icon: 'flag', category: 'system' },
  { id: 'e14', title: 'Store “Pasta Mancini — Altstadt” went offline', meta: 'Auto-paused · low courier coverage', time: '12:14:55', icon: 'store', category: 'stores' },
];

const metrics: Metric[] = [
  { label: 'Events / minute', value: '312', icon: 'activity', tone: 'accent', trend: { direction: 'up', value: '6%' }, foot: 'rolling 5 min' },
  { label: 'Active sessions', value: '8,940', icon: 'users', tone: 'success', foot: 'customers online' },
  { label: 'Orders / minute', value: '21', icon: 'bag', tone: 'accent', trend: { direction: 'up', value: '3%' }, foot: 'rolling 5 min' },
  { label: 'Stream lag', value: '0.4 s', icon: 'clock', tone: 'success', foot: 'event pipeline' },
];

const filters: { id: Category | 'all'; label: string }[] = [
  { id: 'all', label: 'All events' },
  { id: 'orders', label: 'Orders' },
  { id: 'stores', label: 'Stores' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'finance', label: 'Finance' },
  { id: 'system', label: 'System' },
];

export default function LiveActivityPage() {
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [paused, setPaused] = useState(false);

  const visible = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => e.category === filter)),
    [filter],
  );

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'Overview' }, { label: 'Live Activity' }]}
          title="Live Activity"
          description="A real-time stream of every operational event happening across the platform."
          actions={
            <button
              type="button"
              className={`admin-button${paused ? '' : ' admin-button--primary'}`}
              onClick={() => setPaused((v) => !v)}
            >
              <Icon.activity width={15} height={15} />
              {paused ? 'Resume stream' : 'Live'}
            </button>
          }
        />

        <MetricGrid metrics={metrics} />

        <SectionCard
          title="Event stream"
          subtitle={`${visible.length} events${paused ? ' · paused' : ' · streaming'}`}
          actions={
            <div className="admin-row" style={{ gap: 6 }}>
              {filters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`admin-chip${
                    filter === item.id ? ' admin-chip--active' : ''
                  }`}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          }
        >
          <div>
            {visible.map((event) => {
              const EventIcon = Icon[event.icon];
              return (
                <div key={event.id} className="admin-feed-item">
                  <span className="admin-feed-item__icon">
                    <EventIcon width={15} height={15} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="admin-feed-item__title">{event.title}</div>
                    <div className="admin-feed-item__meta">{event.meta}</div>
                  </div>
                  <span className="admin-feed-item__time">{event.time}</span>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </AdminShell>
  );
}
