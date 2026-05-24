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
  serviceZones,
  opsStatusLabel,
  opsStatusTone,
  type ServiceZoneRow,
} from '@/lib/mock/operations';

const metrics: Metric[] = [
  { label: 'Active zones', value: '47', icon: 'map', tone: 'success', foot: 'accepting orders' },
  { label: 'Paused zones', value: '3', icon: 'clock', tone: 'warning', foot: 'temporarily closed' },
  { label: 'Avg. coverage', value: '86%', icon: 'truck', tone: 'accent', foot: 'courier availability' },
  { label: 'High-demand zones', value: '8', icon: 'activity', tone: 'warning', foot: 'extended ETAs' },
];

export default function ServiceAvailabilityPage() {
  const columns: Column<ServiceZoneRow>[] = [
    {
      key: 'zone',
      header: 'Zone',
      render: (row) => (
        <div className="admin-identity">
          <span className="admin-identity__logo">
            <Icon.map width={16} height={16} />
          </span>
          <div>
            <div className="admin-table__primary">{row.zone}</div>
            <div className="admin-table__sub">
              {row.id} · {row.city}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'state',
      header: 'Service state',
      render: (row) => (
        <StatusBadge
          label={opsStatusLabel[row.state]}
          tone={opsStatusTone[row.state]}
        />
      ),
    },
    {
      key: 'stores',
      header: 'Stores online',
      render: (row) => row.storesOnline,
    },
    {
      key: 'coverage',
      header: 'Courier coverage',
      render: (row) => (
        <div className="admin-row" style={{ gap: 8 }}>
          <div className="admin-progress" style={{ width: 90 }}>
            <div
              className={`admin-progress__fill${
                row.coverage >= 80
                  ? ' admin-progress__fill--success'
                  : row.coverage >= 65
                  ? ' admin-progress__fill--warning'
                  : ''
              }`}
              style={{ width: `${row.coverage}%` }}
            />
          </div>
          <span className="admin-table__num">{row.coverage}%</span>
        </div>
      ),
    },
    {
      key: 'wait',
      header: 'Avg. wait',
      align: 'right',
      render: (row) => <span className="admin-muted">{row.avgWait}</span>,
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (row) => (
        <button type="button" className="admin-button admin-button--sm">
          {row.state === 'paused' ? 'Resume' : 'Pause'}
        </button>
      ),
    },
  ];

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'Operations' }, { label: 'Service Availability' }]}
          title="Service Availability"
          description="Monitor and control which delivery zones are open for orders."
          actions={
            <button type="button" className="admin-button admin-button--danger">
              <Icon.alert width={15} height={15} />
              Emergency pause
            </button>
          }
        />

        <MetricGrid metrics={metrics} />

        <DataTable
          columns={columns}
          rows={serviceZones}
          rowKey={(row) => row.id}
          footer={<span>{serviceZones.length} zones monitored</span>}
        />
      </div>
    </AdminShell>
  );
}
