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
import { commissions, type CommissionRow } from '@/lib/mock/finance';
import { useTerminology } from '@/lib/terminology/TerminologyProvider';

const metrics: Metric[] = [
  { label: 'Commission revenue', value: '€312,840', icon: 'percent', tone: 'success', trend: { direction: 'up', value: '9.4%' }, foot: 'this month' },
  { label: 'Avg. effective rate', value: '13.8%', icon: 'chart', tone: 'accent', foot: 'blended across plans' },
  { label: 'Highest contributor', value: 'Döner Express', icon: 'sparkles', tone: 'accent', foot: '€52,640 this month' },
  { label: 'Active rate plans', value: '3', icon: 'layers', tone: 'accent', foot: 'Starter · Growth · Scale' },
];

const plans = [
  { name: 'Starter', rate: '18.0%', desc: 'Single-store tenants, no monthly fee', tenants: 1 },
  { name: 'Growth', rate: '15.0%', desc: 'Up to 10 stores, priority support', tenants: 2 },
  { name: 'Scale', rate: '12.0%', desc: 'Unlimited stores, dedicated manager', tenants: 2 },
];

export default function CommissionsPage() {
  const { term } = useTerminology();

  const columns: Column<CommissionRow>[] = [
    {
      key: 'tenant',
      header: term('tenant', 'singular'),
      render: (row) => (
        <div className="admin-identity">
          <span className="admin-identity__logo">
            {row.tenant.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <div className="admin-table__primary">{row.tenant}</div>
            <div className="admin-table__sub">Since {row.effective}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (row) => <span className="admin-tag">{row.plan}</span>,
    },
    {
      key: 'rate',
      header: 'Rate',
      align: 'right',
      render: (row) => (
        <span className="admin-table__num admin-table__primary">{row.rate}</span>
      ),
    },
    {
      key: 'orders',
      header: 'Orders',
      align: 'right',
      render: (row) => (
        <span className="admin-table__num">
          {row.orders.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'earned',
      header: 'Commission earned',
      align: 'right',
      render: (row) => (
        <span className="admin-table__num admin-table__primary">
          {row.commissionEarned}
        </span>
      ),
    },
  ];

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'Finance' }, { label: 'Commissions' }]}
          title="Commissions"
          description={`Commission rate plans and per-${term(
            'tenant',
            'singular',
          ).toLowerCase()} platform earnings.`}
          actions={
            <button type="button" className="admin-button admin-button--primary">
              <Icon.plus width={15} height={15} />
              New rate plan
            </button>
          }
        />

        <MetricGrid metrics={metrics} />

        <SectionCard title="Rate plans" subtitle="Active commission tiers">
          <div className="admin-roadmap">
            {plans.map((plan) => (
              <div key={plan.name} className="admin-roadmap__card">
                <div className="admin-spread">
                  <span className="admin-roadmap__card-title" style={{ margin: 0 }}>
                    {plan.name}
                  </span>
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: 'var(--accent-hover)',
                    }}
                  >
                    {plan.rate}
                  </span>
                </div>
                <p className="admin-roadmap__card-desc" style={{ marginTop: 6 }}>
                  {plan.desc}
                </p>
                <div className="admin-roadmap__eta">
                  <Icon.building width={13} height={13} />
                  {plan.tenants} {term('tenant', 'plural').toLowerCase()} on this plan
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title={`Commission by ${term('tenant', 'singular').toLowerCase()}`}
          subtitle="Current billing period"
          flush
        >
          <DataTable
            columns={columns}
            rows={commissions}
            rowKey={(row) => row.id}
          />
        </SectionCard>
      </div>
    </AdminShell>
  );
}
