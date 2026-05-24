'use client';

import AdminShell from '@/components/admin/AdminShell';
import {
  DataTable,
  MetricGrid,
  PageHeader,
  StatusBadge,
  type Column,
  type Metric,
} from '@/components/ui';
import { Icon } from '@/lib/icons';
import {
  regions,
  systemStatusLabel,
  systemStatusTone,
  type RegionRow,
} from '@/lib/mock/system';

const metrics: Metric[] = [
  { label: 'Live regions', value: '3', icon: 'map', tone: 'success', foot: 'fully operational' },
  { label: 'Pilot regions', value: '1', icon: 'activity', tone: 'warning', foot: 'limited rollout' },
  { label: 'Cities covered', value: '21', icon: 'building', tone: 'accent', foot: 'across all regions' },
  { label: 'Planned launches', value: '1', icon: 'plus', tone: 'accent', foot: 'next 2 quarters' },
];

export default function RegionsPage() {
  const columns: Column<RegionRow>[] = [
    {
      key: 'region',
      header: 'Region',
      render: (row) => (
        <div className="admin-identity">
          <span className="admin-identity__logo">
            <Icon.map width={16} height={16} />
          </span>
          <div>
            <div className="admin-table__primary">{row.name}</div>
            <div className="admin-table__sub">{row.country}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'cities',
      header: 'Cities',
      align: 'right',
      render: (row) => <span className="admin-table__num">{row.cities}</span>,
    },
    {
      key: 'stores',
      header: 'Stores',
      align: 'right',
      render: (row) => <span className="admin-table__num">{row.stores}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge
          label={systemStatusLabel[row.status]}
          tone={systemStatusTone[row.status]}
        />
      ),
    },
    {
      key: 'launched',
      header: 'Launched',
      render: (row) => <span className="admin-muted">{row.launched}</span>,
    },
  ];

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'System' }, { label: 'Regions & Cities' }]}
          title="Regions & Cities"
          description="Geographic coverage — the regions and cities where the platform operates."
          actions={
            <button type="button" className="admin-button admin-button--primary">
              <Icon.plus width={15} height={15} />
              Add region
            </button>
          }
        />

        <MetricGrid metrics={metrics} />

        <DataTable
          columns={columns}
          rows={regions}
          rowKey={(row) => row.id}
          footer={<span>{regions.length} regions</span>}
        />
      </div>
    </AdminShell>
  );
}
