'use client';

import AdminShell from '@/components/admin/AdminShell';
import {
  DataTable,
  MetricGrid,
  PageHeader,
  SectionCard,
  StatusBadge,
  type Column,
  type Metric,
} from '@/components/ui';
import { Icon } from '@/lib/icons';
import { platformStatusTone, webhooks, type WebhookRow } from '@/lib/mock/platform';

const metrics: Metric[] = [
  { label: 'API requests today', value: '4.2M', icon: 'webhook', tone: 'accent', trend: { direction: 'up', value: '7%' }, foot: 'across all keys' },
  { label: 'Webhook success', value: '98.4%', icon: 'check', tone: 'success', foot: 'last 24 hours' },
  { label: 'Failing endpoints', value: '1', icon: 'alert', tone: 'danger', foot: 'needs attention' },
  { label: 'Avg. latency', value: '186 ms', icon: 'activity', tone: 'accent', foot: 'p95 response time' },
];

const apiKeys = [
  { id: 'k1', name: 'Production · server', token: 'lz_live_••••••••4f9c', created: 'Jan 12, 2024', lastUsed: '20s ago' },
  { id: 'k2', name: 'Production · mobile', token: 'lz_live_••••••••a17b', created: 'Mar 4, 2024', lastUsed: '3m ago' },
  { id: 'k3', name: 'Staging · sandbox', token: 'lz_test_••••••••88de', created: 'Mar 4, 2024', lastUsed: '2h ago' },
];

const webhookStatusLabel: Record<string, string> = {
  healthy: 'Healthy',
  failing: 'Failing',
  paused: 'Paused',
};

export default function ApiWebhooksPage() {
  const columns: Column<WebhookRow>[] = [
    {
      key: 'event',
      header: 'Event',
      render: (row) => (
        <div className="admin-identity">
          <span className="admin-identity__logo">
            <Icon.webhook width={16} height={16} />
          </span>
          <div>
            <div
              className="admin-table__primary"
              style={{ fontFamily: 'ui-monospace, monospace' }}
            >
              {row.event}
            </div>
            <div className="admin-table__sub">{row.endpoint}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge
          label={webhookStatusLabel[row.status]}
          tone={platformStatusTone[row.status]}
        />
      ),
    },
    {
      key: 'success',
      header: 'Success rate',
      align: 'right',
      render: (row) => (
        <span
          className="admin-table__num"
          style={{
            color: row.status === 'failing' ? 'var(--danger)' : 'var(--text-2)',
          }}
        >
          {row.successRate}
        </span>
      ),
    },
    {
      key: 'last',
      header: 'Last delivery',
      align: 'right',
      render: (row) => <span className="admin-muted">{row.lastDelivery}</span>,
    },
  ];

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'Platform' }, { label: 'API & Webhooks' }]}
          title="API & Webhooks"
          description="API credentials, webhook subscriptions and delivery health."
          actions={
            <button type="button" className="admin-button admin-button--primary">
              <Icon.plus width={15} height={15} />
              Create API key
            </button>
          }
        />

        <MetricGrid metrics={metrics} />

        <SectionCard title="API keys" subtitle="Active credentials" flush>
          <div className="admin-list">
            {apiKeys.map((key) => (
              <div key={key.id} className="admin-list-row">
                <div className="admin-identity">
                  <span className="admin-identity__logo">
                    <Icon.command width={16} height={16} />
                  </span>
                  <div>
                    <div className="admin-list-row__title">{key.name}</div>
                    <div
                      className="admin-list-row__meta"
                      style={{ fontFamily: 'ui-monospace, monospace' }}
                    >
                      {key.token}
                    </div>
                  </div>
                </div>
                <div className="admin-row">
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Used {key.lastUsed}
                  </span>
                  <button type="button" className="admin-button admin-button--sm">
                    Roll
                  </button>
                  <button
                    type="button"
                    className="admin-button admin-button--sm admin-button--danger"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Webhook subscriptions"
          subtitle="Event delivery endpoints"
          flush
        >
          <DataTable
            columns={columns}
            rows={webhooks}
            rowKey={(row) => row.id}
          />
        </SectionCard>
      </div>
    </AdminShell>
  );
}
