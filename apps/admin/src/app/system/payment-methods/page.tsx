'use client';

import AdminShell from '@/components/admin/AdminShell';
import {
  DataTable,
  PageHeader,
  SectionCard,
  StatusBadge,
  type Column,
} from '@/components/ui';
import { Icon } from '@/lib/icons';
import {
  paymentMethods,
  systemStatusLabel,
  systemStatusTone,
  type PaymentMethodRow,
} from '@/lib/mock/system';

export default function PaymentMethodsPage() {
  const columns: Column<PaymentMethodRow>[] = [
    {
      key: 'method',
      header: 'Payment method',
      render: (row) => (
        <div className="admin-identity">
          <span className="admin-identity__logo">
            <Icon.card width={16} height={16} />
          </span>
          <div>
            <div className="admin-table__primary">{row.name}</div>
            <div className="admin-table__sub">via {row.provider}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'fee',
      header: 'Processing fee',
      render: (row) => <span className="admin-muted">{row.fee}</span>,
    },
    {
      key: 'share',
      header: 'Volume share',
      render: (row) => (
        <div className="admin-row" style={{ gap: 8 }}>
          <div className="admin-progress" style={{ width: 90 }}>
            <div
              className="admin-progress__fill"
              style={{ width: row.share }}
            />
          </div>
          <span className="admin-table__num">{row.share}</span>
        </div>
      ),
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
      key: 'action',
      header: '',
      align: 'right',
      render: (row) => (
        <button type="button" className="admin-button admin-button--sm">
          {row.status === 'enabled' ? 'Disable' : 'Enable'}
        </button>
      ),
    },
  ];

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'System' }, { label: 'Payment Methods' }]}
          title="Payment Methods"
          description="Configure which payment methods customers can use at checkout."
          actions={
            <button type="button" className="admin-button admin-button--primary">
              <Icon.plus width={15} height={15} />
              Add method
            </button>
          }
        />

        <SectionCard
          title="Available methods"
          subtitle="Volume share is calculated over the last 30 days"
          flush
        >
          <DataTable
            columns={columns}
            rows={paymentMethods}
            rowKey={(row) => row.id}
          />
        </SectionCard>
      </div>
    </AdminShell>
  );
}
