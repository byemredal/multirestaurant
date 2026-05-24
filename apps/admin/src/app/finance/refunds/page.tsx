'use client';

import { useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  DataTable,
  Drawer,
  DrawerField,
  MetricGrid,
  PageHeader,
  StatusBadge,
  Tabs,
  type Column,
  type Metric,
} from '@/components/ui';
import {
  financeStatusLabel,
  financeStatusTone,
  refunds,
  type RefundRow,
} from '@/lib/mock/finance';

const metrics: Metric[] = [
  { label: 'Refunds this month', value: '€18,470', icon: 'refund', tone: 'danger', trend: { direction: 'down', value: '3.1%' }, foot: '0.77% of GMV' },
  { label: 'Pending review', value: '2', icon: 'clock', tone: 'warning', foot: 'above auto-approve limit' },
  { label: 'Auto-approved', value: '64%', icon: 'check', tone: 'success', foot: 'under €20 threshold' },
  { label: 'Avg. resolution', value: '4.2 h', icon: 'activity', tone: 'accent', foot: 'request to decision' },
];

export default function RefundsPage() {
  const [tab, setTab] = useState('pending');
  const [selected, setSelected] = useState<RefundRow | null>(null);

  const counts = useMemo(
    () => ({
      pending: refunds.filter((r) => r.status === 'requested').length,
      resolved: refunds.filter((r) => r.status !== 'requested').length,
      all: refunds.length,
    }),
    [],
  );

  const rows = useMemo(() => {
    if (tab === 'pending') return refunds.filter((r) => r.status === 'requested');
    if (tab === 'resolved') return refunds.filter((r) => r.status !== 'requested');
    return refunds;
  }, [tab]);

  const columns: Column<RefundRow>[] = [
    {
      key: 'refund',
      header: 'Refund',
      render: (row) => (
        <div>
          <div className="admin-table__primary">{row.id}</div>
          <div className="admin-table__sub">Order #{row.order}</div>
        </div>
      ),
    },
    { key: 'customer', header: 'Customer', render: (row) => row.customer },
    { key: 'store', header: 'Store', render: (row) => row.store },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => <span className="admin-tag">{row.reason}</span>,
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
  ];

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'Finance' }, { label: 'Refunds' }]}
          title="Refunds"
          description="Review refund requests, approve high-value cases and track resolution times."
        />

        <MetricGrid metrics={metrics} />

        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'pending', label: 'Needs review', count: counts.pending },
            { id: 'resolved', label: 'Resolved', count: counts.resolved },
            { id: 'all', label: 'All', count: counts.all },
          ]}
        />

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          onRowClick={(row) => setSelected(row)}
          empty="No refunds in this state."
          footer={<span>{rows.length} refund requests</span>}
        />
      </div>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Refund ${selected.id}` : ''}
        subtitle={selected ? `Order #${selected.order}` : ''}
        footer={
          <>
            <button type="button" className="admin-button admin-button--primary">
              Approve refund
            </button>
            <button type="button" className="admin-button admin-button--danger">
              Reject
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
              <DrawerField label="Customer">{selected.customer}</DrawerField>
              <DrawerField label="Store">{selected.store}</DrawerField>
              <DrawerField label="Amount">{selected.amount}</DrawerField>
              <DrawerField label="Reason">{selected.reason}</DrawerField>
              <DrawerField label="Requested">{selected.date}</DrawerField>
              <DrawerField label="Order">#{selected.order}</DrawerField>
            </div>
          </>
        )}
      </Drawer>
    </AdminShell>
  );
}
