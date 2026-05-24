'use client';

import { useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  DataTable,
  Drawer,
  DrawerField,
  MetricGrid,
  PageHeader,
  StatusBadge,
  type Column,
  type Metric,
} from '@/components/ui';
import { Icon } from '@/lib/icons';
import {
  financeStatusLabel,
  financeStatusTone,
  payouts,
  type PayoutRow,
} from '@/lib/mock/finance';

const metrics: Metric[] = [
  { label: 'Awaiting approval', value: '€96,210', icon: 'payout', tone: 'warning', foot: '1 batch · 184 stores' },
  { label: 'Processing', value: '€14,720', icon: 'clock', tone: 'accent', foot: '1 batch in transit' },
  { label: 'Paid this month', value: '€512,840', icon: 'check', tone: 'success', trend: { direction: 'up', value: '6.8%' }, foot: 'across 14 batches' },
  { label: 'On hold', value: '€2,640', icon: 'alert', tone: 'danger', foot: 'compliance review' },
];

export default function PayoutsPage() {
  const [selected, setSelected] = useState<PayoutRow | null>(null);

  const columns: Column<PayoutRow>[] = [
    {
      key: 'batch',
      header: 'Payout batch',
      render: (row) => (
        <div className="admin-identity">
          <span
            className="admin-identity__logo"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent-hover)' }}
          >
            <Icon.payout width={16} height={16} />
          </span>
          <div>
            <div className="admin-table__primary">{row.id}</div>
            <div className="admin-table__sub">{row.tenant}</div>
          </div>
        </div>
      ),
    },
    { key: 'period', header: 'Period', render: (row) => row.period },
    {
      key: 'stores',
      header: 'Stores',
      align: 'right',
      render: (row) => <span className="admin-table__num">{row.stores}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (row) => (
        <span className="admin-table__num admin-table__primary">
          {row.amount}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge
          label={financeStatusLabel[row.status]}
          tone={financeStatusTone[row.status]}
        />
      ),
    },
    {
      key: 'scheduled',
      header: 'Scheduled',
      render: (row) => <span className="admin-muted">{row.scheduled}</span>,
    },
  ];

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'Finance' }, { label: 'Payouts' }]}
          title="Payouts"
          description="Review and approve settlement batches sent to tenants and stores."
          actions={
            <button type="button" className="admin-button admin-button--primary">
              <Icon.check width={15} height={15} />
              Approve next batch
            </button>
          }
        />

        <MetricGrid metrics={metrics} />

        <DataTable
          columns={columns}
          rows={payouts}
          rowKey={(row) => row.id}
          onRowClick={(row) => setSelected(row)}
          footer={<span>{payouts.length} payout batches</span>}
        />
      </div>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Payout ${selected.id}` : ''}
        subtitle={selected?.tenant}
        footer={
          <>
            <button type="button" className="admin-button admin-button--primary">
              Approve payout
            </button>
            <button type="button" className="admin-button admin-button--danger">
              Place on hold
            </button>
          </>
        }
      >
        {selected && (
          <>
            <StatusBadge
              label={financeStatusLabel[selected.status]}
              tone={financeStatusTone[selected.status]}
            />
            <div className="admin-kv-grid">
              <DrawerField label="Period">{selected.period}</DrawerField>
              <DrawerField label="Stores included">{selected.stores}</DrawerField>
              <DrawerField label="Total amount">{selected.amount}</DrawerField>
              <DrawerField label="Scheduled date">
                {selected.scheduled}
              </DrawerField>
            </div>
            <div className="admin-state" style={{ textAlign: 'left' }}>
              Approving releases funds to {selected.stores} stores via SEPA
              transfer. This action is recorded in the audit log.
            </div>
          </>
        )}
      </Drawer>
    </AdminShell>
  );
}
