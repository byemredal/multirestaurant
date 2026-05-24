'use client';

import { useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { MetricGrid, PageHeader, StatusBadge, type Metric } from '@/components/ui';
import { Icon } from '@/lib/icons';
import { integrations, platformStatusTone } from '@/lib/mock/platform';

const metrics: Metric[] = [
  { label: 'Connected', value: '6', icon: 'plug', tone: 'success', foot: 'active integrations' },
  { label: 'Needs attention', value: '1', icon: 'alert', tone: 'danger', foot: 'connection error' },
  { label: 'Available', value: '2', icon: 'plus', tone: 'accent', foot: 'ready to connect' },
  { label: 'Categories', value: '6', icon: 'layers', tone: 'accent', foot: 'integration types' },
];

const categories = ['All', 'Payments', 'Notifications', 'Logistics', 'Observability', 'Internal', 'Accounting'];

const statusLabel: Record<string, string> = {
  connected: 'Connected',
  error: 'Connection error',
  available: 'Available',
};

export default function IntegrationsPage() {
  const [category, setCategory] = useState('All');

  const visible = useMemo(
    () =>
      category === 'All'
        ? integrations
        : integrations.filter((i) => i.category === category),
    [category],
  );

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'Platform' }, { label: 'Integrations' }]}
          title="Integrations"
          description="Third-party services connected to the platform — payments, notifications, logistics and more."
          actions={
            <button type="button" className="admin-button admin-button--primary">
              <Icon.plus width={15} height={15} />
              Browse marketplace
            </button>
          }
        />

        <MetricGrid metrics={metrics} />

        <div className="admin-row" style={{ gap: 6 }}>
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              className={`admin-chip${
                category === item ? ' admin-chip--active' : ''
              }`}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="admin-roadmap">
          {visible.map((integration) => {
            const IntIcon = Icon[integration.icon];
            return (
              <article key={integration.id} className="admin-roadmap__card">
                <div className="admin-spread">
                  <div className="admin-row" style={{ gap: 10 }}>
                    <span
                      className="admin-identity__logo"
                      style={{
                        width: 38,
                        height: 38,
                        background: 'var(--surface-muted)',
                      }}
                    >
                      <IntIcon width={19} height={19} />
                    </span>
                    <div>
                      <div style={{ fontSize: 14.5, fontWeight: 600 }}>
                        {integration.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {integration.category}
                      </div>
                    </div>
                  </div>
                  <StatusBadge
                    label={statusLabel[integration.status]}
                    tone={platformStatusTone[integration.status]}
                  />
                </div>
                <p className="admin-roadmap__card-desc" style={{ marginTop: 12 }}>
                  {integration.detail}
                </p>
                <div style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    className={`admin-button admin-button--sm${
                      integration.status === 'available'
                        ? ' admin-button--primary'
                        : ''
                    }`}
                  >
                    {integration.status === 'available'
                      ? 'Connect'
                      : integration.status === 'error'
                      ? 'Fix connection'
                      : 'Manage'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}
