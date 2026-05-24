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
  locales,
  systemStatusLabel,
  systemStatusTone,
  type LocaleRow,
} from '@/lib/mock/system';

export default function LocalizationPage() {
  const columns: Column<LocaleRow>[] = [
    {
      key: 'language',
      header: 'Language',
      render: (row) => (
        <div className="admin-identity">
          <span className="admin-identity__logo">
            <Icon.globe width={16} height={16} />
          </span>
          <div>
            <div className="admin-table__primary">{row.language}</div>
            <div className="admin-table__sub">{row.code}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'coverage',
      header: 'Translation coverage',
      render: (row) => (
        <div className="admin-row" style={{ gap: 8 }}>
          <div className="admin-progress" style={{ width: 110 }}>
            <div
              className={`admin-progress__fill${
                row.coverage >= 95
                  ? ' admin-progress__fill--success'
                  : row.coverage >= 60
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
      key: 'strings',
      header: 'Strings',
      render: (row) => <span className="admin-muted">{row.strings}</span>,
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
      render: () => (
        <button type="button" className="admin-button admin-button--sm">
          Manage strings
        </button>
      ),
    },
  ];

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'System' }, { label: 'Localization' }]}
          title="Localization"
          description="Manage supported languages and translation coverage across the platform."
          actions={
            <button type="button" className="admin-button admin-button--primary">
              <Icon.plus width={15} height={15} />
              Add language
            </button>
          }
        />

        <SectionCard
          title="Supported languages"
          subtitle="5 languages · German is the source locale"
          flush
        >
          <DataTable
            columns={columns}
            rows={locales}
            rowKey={(row) => row.id}
          />
        </SectionCard>
      </div>
    </AdminShell>
  );
}
