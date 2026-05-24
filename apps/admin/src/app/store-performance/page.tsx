'use client';

import AdminShell from '@/components/admin/AdminShell';
import {
  DataTable,
  MetricGrid,
  PageHeader,
  SectionCard,
  type Column,
  type Metric,
} from '@/components/ui';
import { Icon } from '@/lib/icons';
import { storePerformance, type StorePerformanceRow } from '@/lib/mock/tenants';
import { useTerminology } from '@/lib/terminology/TerminologyProvider';

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="admin-spark" style={{ width: 90 }}>
      {data.map((value, index) => (
        <span
          key={index}
          className={value === max ? 'is-peak' : undefined}
          style={{ height: `${Math.round((value / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function AcceptBar({ value }: { value: number }) {
  const tone =
    value >= 96 ? 'success' : value >= 90 ? 'warning' : 'danger';
  return (
    <div className="admin-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
      <div className="admin-progress" style={{ width: 70 }}>
        <div
          className={`admin-progress__fill admin-progress__fill--${tone}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="admin-table__num" style={{ minWidth: 32 }}>
        {value}%
      </span>
    </div>
  );
}

export default function StorePerformancePage() {
  const { term } = useTerminology();
  const storeWord = term('store', 'singular');

  const metrics: Metric[] = [
    { label: 'Avg. accept rate', value: '95.7%', icon: 'check', tone: 'success', trend: { direction: 'up', value: '1.2%' }, foot: 'last 7 days' },
    { label: 'Avg. prep time', value: '19.8 min', icon: 'clock', tone: 'accent', trend: { direction: 'down', value: '0.6 min' }, foot: 'last 7 days' },
    { label: 'Avg. cancel rate', value: '3.2%', icon: 'close', tone: 'warning', trend: { direction: 'flat', value: 'stable' }, foot: 'last 7 days' },
    { label: 'Top performer', value: 'Döner Express', icon: 'sparkles', tone: 'accent', foot: '311 orders today' },
  ];

  const columns: Column<StorePerformanceRow>[] = [
    {
      key: 'store',
      header: storeWord,
      render: (row) => (
        <div className="admin-identity">
          <span className="admin-identity__logo">
            {row.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <div className="admin-table__primary">{row.name}</div>
            <div className="admin-table__sub">{row.tenant}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'trend',
      header: '7-day orders',
      render: (row) => <Sparkline data={row.trend} />,
    },
    {
      key: 'orders',
      header: 'Orders',
      align: 'right',
      render: (row) => <span className="admin-table__num">{row.orders}</span>,
    },
    {
      key: 'revenue',
      header: 'Revenue',
      align: 'right',
      render: (row) => (
        <span className="admin-table__num admin-table__primary">
          {row.revenue}
        </span>
      ),
    },
    {
      key: 'accept',
      header: 'Accept rate',
      align: 'right',
      render: (row) => <AcceptBar value={row.acceptRate} />,
    },
    {
      key: 'prep',
      header: 'Avg. prep',
      align: 'right',
      render: (row) => <span className="admin-muted">{row.avgPrep}</span>,
    },
    {
      key: 'cancel',
      header: 'Cancel %',
      align: 'right',
      render: (row) => (
        <span
          className="admin-table__num"
          style={{
            color: row.cancelRate > 5 ? 'var(--danger)' : 'var(--text-2)',
          }}
        >
          {row.cancelRate}%
        </span>
      ),
    },
  ];

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[
            { label: term('tenant', 'plural') },
            { label: `${storeWord} Performance` },
          ]}
          title={`${storeWord} Performance`}
          description={`Operational scorecard ranking ${term(
            'store',
            'plural',
          ).toLowerCase()} by volume, reliability and efficiency.`}
          actions={
            <>
              <button type="button" className="admin-button">
                <Icon.clock width={15} height={15} />
                Last 7 days
              </button>
              <button type="button" className="admin-button">
                <Icon.download width={15} height={15} />
                Export
              </button>
            </>
          }
        />

        <MetricGrid metrics={metrics} />

        <SectionCard
          title="Performance leaderboard"
          subtitle="Ranked by orders fulfilled today"
          flush
        >
          <DataTable
            columns={columns}
            rows={storePerformance}
            rowKey={(row) => row.id}
          />
        </SectionCard>
      </div>
    </AdminShell>
  );
}
