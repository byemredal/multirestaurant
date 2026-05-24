'use client';

import AdminShell from '@/components/admin/AdminShell';
import {
  BarChart,
  DataTable,
  MetricGrid,
  PageHeader,
  SectionCard,
  type Column,
  type Metric,
} from '@/components/ui';
import { Icon } from '@/lib/icons';
import { financialReports, revenueByMonth } from '@/lib/mock/finance';

const metrics: Metric[] = [
  { label: 'GMV — last 6 months', value: '€12.55M', icon: 'card', tone: 'accent', trend: { direction: 'up', value: '32%' }, foot: 'Dec – May' },
  { label: 'Net revenue', value: '€1.74M', icon: 'percent', tone: 'success', foot: 'commission + fees' },
  { label: 'Refund ratio', value: '0.81%', icon: 'refund', tone: 'warning', foot: 'of GMV' },
  { label: 'Reports available', value: '14', icon: 'report', tone: 'accent', foot: 'last 90 days' },
];

type ReportRow = (typeof financialReports)[number];

export default function FinancialReportsPage() {
  const columns: Column<ReportRow>[] = [
    {
      key: 'report',
      header: 'Report',
      render: (row) => (
        <div className="admin-identity">
          <span className="admin-identity__logo">
            <Icon.report width={16} height={16} />
          </span>
          <div>
            <div className="admin-table__primary">{row.name}</div>
            <div className="admin-table__sub">{row.period}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'format',
      header: 'Format',
      render: (row) => <span className="admin-tag">{row.format}</span>,
    },
    {
      key: 'generated',
      header: 'Generated',
      render: (row) => <span className="admin-muted">{row.generated}</span>,
    },
    {
      key: 'size',
      header: 'Size',
      align: 'right',
      render: (row) => <span className="admin-muted">{row.size}</span>,
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: () => (
        <button type="button" className="admin-button admin-button--sm">
          <Icon.download width={14} height={14} />
          Download
        </button>
      ),
    },
  ];

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'Finance' }, { label: 'Financial Reports' }]}
          title="Financial Reports"
          description="Settlement statements, tax summaries and exportable financial ledgers."
          actions={
            <button type="button" className="admin-button admin-button--primary">
              <Icon.plus width={15} height={15} />
              Generate report
            </button>
          }
        />

        <MetricGrid metrics={metrics} />

        <SectionCard
          title="Gross merchandise value"
          subtitle="Monthly GMV trend"
        >
          <BarChart
            data={revenueByMonth}
            valueFormatter={(value) => `€${(value / 1_000_000).toFixed(2)}M`}
          />
        </SectionCard>

        <SectionCard
          title="Generated reports"
          subtitle="Ready to download"
          flush
        >
          <DataTable
            columns={columns}
            rows={financialReports}
            rowKey={(row) => row.id}
          />
        </SectionCard>
      </div>
    </AdminShell>
  );
}
