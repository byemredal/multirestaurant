'use client';

import { useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  DataTable,
  FilterBar,
  PageHeader,
  type Column,
  type FilterChip,
} from '@/components/ui';
import { Icon } from '@/lib/icons';
import { auditLogs, type AuditLogRow } from '@/lib/mock/platform';

const categoryTag: Record<string, string> = {
  auth: 'Authentication',
  finance: 'Finance',
  config: 'Configuration',
  tenant: 'Tenant',
};

export default function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const chips: FilterChip[] = [
    { id: 'all', label: 'All', count: auditLogs.length },
    { id: 'auth', label: 'Auth', count: auditLogs.filter((l) => l.category === 'auth').length },
    { id: 'finance', label: 'Finance', count: auditLogs.filter((l) => l.category === 'finance').length },
    { id: 'config', label: 'Config', count: auditLogs.filter((l) => l.category === 'config').length },
    { id: 'tenant', label: 'Tenant', count: auditLogs.filter((l) => l.category === 'tenant').length },
  ];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return auditLogs.filter((log) => {
      if (category !== 'all' && log.category !== category) return false;
      if (!q) return true;
      return `${log.actor} ${log.action} ${log.target}`
        .toLowerCase()
        .includes(q);
    });
  }, [search, category]);

  const columns: Column<AuditLogRow>[] = [
    {
      key: 'event',
      header: 'Event',
      render: (row) => (
        <div className="admin-identity">
          <span className="admin-identity__logo">
            <Icon.logs width={16} height={16} />
          </span>
          <div>
            <div className="admin-table__primary">{row.action}</div>
            <div className="admin-table__sub">Target: {row.target}</div>
          </div>
        </div>
      ),
    },
    { key: 'actor', header: 'Actor', render: (row) => row.actor },
    {
      key: 'category',
      header: 'Category',
      render: (row) => (
        <span className="admin-tag">{categoryTag[row.category]}</span>
      ),
    },
    {
      key: 'ip',
      header: 'IP address',
      render: (row) => (
        <span
          className="admin-muted"
          style={{ fontFamily: 'ui-monospace, monospace' }}
        >
          {row.ip}
        </span>
      ),
    },
    {
      key: 'time',
      header: 'Timestamp',
      align: 'right',
      render: (row) => <span className="admin-muted">{row.time}</span>,
    },
  ];

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'Platform' }, { label: 'Audit Logs' }]}
          title="Audit Logs"
          description="An immutable record of every privileged action taken in the admin console."
          actions={
            <button type="button" className="admin-button">
              <Icon.download width={15} height={15} />
              Export
            </button>
          }
        />

        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search by actor, action or target…"
          chips={chips}
          activeChip={category}
          onChipChange={setCategory}
        />

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          footer={<span>{rows.length} log entries</span>}
        />
      </div>
    </AdminShell>
  );
}
