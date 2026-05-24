'use client';

import { useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  DataTable,
  FilterBar,
  MetricGrid,
  PageHeader,
  StatusBadge,
  type Column,
  type FilterChip,
  type Metric,
} from '@/components/ui';
import { Icon } from '@/lib/icons';
import { campaigns, statusTone, type CampaignRow } from '@/lib/mock/tenants';

const metrics: Metric[] = [
  { label: 'Live campaigns', value: '2', icon: 'megaphone', tone: 'success', foot: 'running now' },
  { label: 'Scheduled', value: '1', icon: 'clock', tone: 'accent', foot: 'upcoming' },
  { label: 'Total redemptions', value: '19.0k', icon: 'ticket', tone: 'accent', trend: { direction: 'up', value: '14%' }, foot: 'this month' },
  { label: 'Reach', value: '248k', icon: 'users', tone: 'accent', foot: 'unique customers' },
];

export default function CampaignsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const chips: FilterChip[] = [
    { id: 'all', label: 'All', count: campaigns.length },
    { id: 'live', label: 'Live', count: campaigns.filter((c) => c.status === 'live').length },
    { id: 'scheduled', label: 'Scheduled', count: campaigns.filter((c) => c.status === 'scheduled').length },
    { id: 'paused', label: 'Paused', count: campaigns.filter((c) => c.status === 'paused').length },
    { id: 'ended', label: 'Ended', count: campaigns.filter((c) => c.status === 'ended').length },
  ];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter((campaign) => {
      if (status !== 'all' && campaign.status !== status) return false;
      if (!q) return true;
      return `${campaign.name} ${campaign.scope} ${campaign.type}`
        .toLowerCase()
        .includes(q);
    });
  }, [search, status]);

  const columns: Column<CampaignRow>[] = [
    {
      key: 'campaign',
      header: 'Campaign',
      render: (row) => (
        <div className="admin-identity">
          <span
            className="admin-identity__logo"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent-hover)' }}
          >
            <Icon.megaphone width={16} height={16} />
          </span>
          <div>
            <div className="admin-table__primary">{row.name}</div>
            <div className="admin-table__sub">
              {row.id} · {row.scope}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => <span className="admin-tag">{row.type}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge label={row.status} tone={statusTone[row.status]} />
      ),
    },
    {
      key: 'reach',
      header: 'Reach',
      align: 'right',
      render: (row) => <span className="admin-table__num">{row.reach}</span>,
    },
    {
      key: 'redemptions',
      header: 'Redemptions',
      align: 'right',
      render: (row) => (
        <span className="admin-table__num admin-table__primary">
          {row.redemptions.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'window',
      header: 'Window',
      render: (row) => <span className="admin-muted">{row.window}</span>,
    },
  ];

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'Tenants' }, { label: 'Campaigns' }]}
          title="Campaigns"
          description="Platform and tenant-level promotions, their reach and redemption performance."
          actions={
            <button type="button" className="admin-button admin-button--primary">
              <Icon.plus width={15} height={15} />
              New campaign
            </button>
          }
        />

        <MetricGrid metrics={metrics} />

        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search campaigns…"
          chips={chips}
          activeChip={status}
          onChipChange={setStatus}
        />

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          footer={<span>{rows.length} campaigns</span>}
        />
      </div>
    </AdminShell>
  );
}
