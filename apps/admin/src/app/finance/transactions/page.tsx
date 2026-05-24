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
} from '@/components/ui';
import { Icon } from '@/lib/icons';
import {
  financeMetrics,
  financeStatusLabel,
  financeStatusTone,
  transactions,
  type TransactionRow,
} from '@/lib/mock/finance';

export default function TransactionsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const chips: FilterChip[] = [
    { id: 'all', label: 'All', count: transactions.length },
    { id: 'settled', label: 'Settled', count: transactions.filter((t) => t.status === 'settled').length },
    { id: 'pending', label: 'Pending', count: transactions.filter((t) => t.status === 'pending').length },
    { id: 'processing', label: 'Processing', count: transactions.filter((t) => t.status === 'processing').length },
    { id: 'failed', label: 'Failed', count: transactions.filter((t) => t.status === 'failed').length },
  ];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((txn) => {
      if (status !== 'all' && txn.status !== status) return false;
      if (!q) return true;
      return `${txn.id} ${txn.store} ${txn.type}`.toLowerCase().includes(q);
    });
  }, [search, status]);

  const columns: Column<TransactionRow>[] = [
    {
      key: 'txn',
      header: 'Transaction',
      render: (row) => (
        <div>
          <div className="admin-table__primary">{row.id}</div>
          <div className="admin-table__sub">{row.store}</div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => <span className="admin-tag">{row.type}</span>,
    },
    { key: 'method', header: 'Method', render: (row) => row.method },
    {
      key: 'gross',
      header: 'Gross',
      align: 'right',
      render: (row) => <span className="admin-table__num">{row.gross}</span>,
    },
    {
      key: 'fee',
      header: 'Fee',
      align: 'right',
      render: (row) => (
        <span className="admin-table__num admin-muted">{row.fee}</span>
      ),
    },
    {
      key: 'net',
      header: 'Net',
      align: 'right',
      render: (row) => (
        <span className="admin-table__num admin-table__primary">{row.net}</span>
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
      key: 'date',
      header: 'Date',
      render: (row) => <span className="admin-muted">{row.date}</span>,
    },
  ];

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'Finance' }, { label: 'Transactions' }]}
          title="Transactions"
          description="Every money movement on the platform — order payments, refunds, payouts and adjustments."
          actions={
            <button type="button" className="admin-button">
              <Icon.download width={15} height={15} />
              Export ledger
            </button>
          }
        />

        <MetricGrid metrics={financeMetrics} />

        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search by transaction ID, store or type…"
          chips={chips}
          activeChip={status}
          onChipChange={setStatus}
        />

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          footer={<span>{rows.length} transactions</span>}
        />
      </div>
    </AdminShell>
  );
}
