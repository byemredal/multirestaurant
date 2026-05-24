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
import {
  couriers,
  opsStatusLabel,
  opsStatusTone,
  type CourierRow,
} from '@/lib/mock/operations';

const metrics: Metric[] = [
  { label: 'Couriers online', value: '184', icon: 'truck', tone: 'success', trend: { direction: 'up', value: '11' }, foot: 'across all zones' },
  { label: 'Avg. delivery time', value: '31 min', icon: 'clock', tone: 'accent', trend: { direction: 'down', value: '2 min' }, foot: 'today' },
  { label: 'On-time rate', value: '93.6%', icon: 'check', tone: 'success', foot: 'within promised ETA' },
  { label: 'Unassigned orders', value: '12', icon: 'alert', tone: 'warning', foot: 'awaiting a courier' },
];

const zoneLoad = [
  { zone: 'Berlin-Mitte', load: 92, couriers: 38 },
  { zone: 'Frankfurt-Centre', load: 88, couriers: 31 },
  { zone: 'Berlin-Kreuzberg', load: 64, couriers: 24 },
  { zone: 'Munich-Schwabing', load: 51, couriers: 19 },
  { zone: 'Stuttgart-West', load: 43, couriers: 14 },
];

export default function DeliveryPage() {
  const columns: Column<CourierRow>[] = [
    {
      key: 'courier',
      header: 'Courier',
      render: (row) => (
        <div className="admin-identity">
          <span className="admin-identity__logo">
            {row.name
              .split(' ')
              .map((p) => p[0])
              .join('')}
          </span>
          <div>
            <div className="admin-table__primary">{row.name}</div>
            <div className="admin-table__sub">{row.id}</div>
          </div>
        </div>
      ),
    },
    { key: 'zone', header: 'Zone', render: (row) => row.zone },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge
          label={opsStatusLabel[row.status]}
          tone={opsStatusTone[row.status]}
        />
      ),
    },
    {
      key: 'active',
      header: 'Active orders',
      align: 'right',
      render: (row) => (
        <span className="admin-table__num">{row.activeOrders}</span>
      ),
    },
    {
      key: 'completed',
      header: 'Completed today',
      align: 'right',
      render: (row) => (
        <span className="admin-table__num">{row.completed}</span>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      align: 'right',
      render: (row) => <span className="admin-table__num">{row.rating}</span>,
    },
  ];

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'Operations' }, { label: 'Delivery Operations' }]}
          title="Delivery Operations"
          description="Courier fleet, zone load and live delivery performance."
          actions={
            <button type="button" className="admin-button admin-button--primary">
              <Icon.map width={15} height={15} />
              Open dispatch map
            </button>
          }
        />

        <MetricGrid metrics={metrics} />

        <div className="admin-split admin-split--wide-left">
          <SectionCard title="Courier fleet" subtitle="Currently signed-in couriers" flush>
            <DataTable
              columns={columns}
              rows={couriers}
              rowKey={(row) => row.id}
            />
          </SectionCard>

          <SectionCard title="Zone load" subtitle="Demand vs. courier capacity">
            <div className="admin-stack" style={{ gap: 14 }}>
              {zoneLoad.map((zone) => (
                <div key={zone.zone}>
                  <div className="admin-spread" style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {zone.zone}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {zone.couriers} couriers
                    </span>
                  </div>
                  <div className="admin-progress">
                    <div
                      className={`admin-progress__fill${
                        zone.load >= 85
                          ? ''
                          : zone.load >= 60
                          ? ' admin-progress__fill--warning'
                          : ' admin-progress__fill--success'
                      }`}
                      style={{ width: `${zone.load}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </AdminShell>
  );
}
