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
  type Metric,
} from '@/components/ui';
import { Icon } from '@/lib/icons';
import { menus, statusTone, type MenuRow } from '@/lib/mock/tenants';
import { useTerminology } from '@/lib/terminology/TerminologyProvider';

const metrics: Metric[] = [
  { label: 'Published menus', value: '688', icon: 'menu', tone: 'success', foot: 'live to customers' },
  { label: 'In review', value: '23', icon: 'clock', tone: 'warning', foot: 'awaiting approval' },
  { label: 'Draft menus', value: '41', icon: 'report', tone: 'accent', foot: 'not yet submitted' },
  { label: 'Avg. completeness', value: '91%', icon: 'check', tone: 'accent', foot: 'images & descriptions' },
];

export default function MenusPage() {
  const { term } = useTerminology();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const chips: FilterChip[] = [
    { id: 'all', label: 'All', count: menus.length },
    { id: 'published', label: 'Published', count: menus.filter((m) => m.status === 'published').length },
    { id: 'review', label: 'In review', count: menus.filter((m) => m.status === 'review').length },
    { id: 'draft', label: 'Draft', count: menus.filter((m) => m.status === 'draft').length },
  ];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menus.filter((menu) => {
      if (status !== 'all' && menu.status !== status) return false;
      if (!q) return true;
      return `${menu.store} ${menu.tenant}`.toLowerCase().includes(q);
    });
  }, [search, status]);

  const columns: Column<MenuRow>[] = [
    {
      key: 'menu',
      header: 'Menu',
      render: (row) => (
        <div className="admin-identity">
          <span className="admin-identity__logo">
            <Icon.menu width={16} height={16} />
          </span>
          <div>
            <div className="admin-table__primary">{row.store}</div>
            <div className="admin-table__sub">
              {row.id} · {row.tenant}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      align: 'right',
      render: (row) => <span className="admin-table__num">{row.items}</span>,
    },
    {
      key: 'categories',
      header: 'Categories',
      align: 'right',
      render: (row) => (
        <span className="admin-table__num">{row.categories}</span>
      ),
    },
    {
      key: 'completeness',
      header: 'Completeness',
      render: (row) => (
        <div className="admin-row" style={{ gap: 8 }}>
          <div className="admin-progress" style={{ width: 90 }}>
            <div
              className={`admin-progress__fill${
                row.completeness >= 90
                  ? ' admin-progress__fill--success'
                  : row.completeness >= 60
                  ? ' admin-progress__fill--warning'
                  : ''
              }`}
              style={{ width: `${row.completeness}%` }}
            />
          </div>
          <span className="admin-table__num">{row.completeness}%</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge label={row.status} tone={statusTone[row.status]} />
      ),
    },
    {
      key: 'updated',
      header: 'Updated',
      render: (row) => <span className="admin-muted">{row.updated}</span>,
    },
  ];

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: term('tenant', 'plural') }, { label: 'Menus' }]}
          title="Menus"
          description={`Catalog and content review across every ${term(
            'store',
            'singular',
          ).toLowerCase()} menu.`}
          actions={
            <button type="button" className="admin-button admin-button--primary">
              <Icon.checklist width={15} height={15} />
              Review queue
            </button>
          }
        />

        <MetricGrid metrics={metrics} />

        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search menus by store or tenant…"
          chips={chips}
          activeChip={status}
          onChipChange={setStatus}
        />

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          footer={<span>{rows.length} menus</span>}
        />
      </div>
    </AdminShell>
  );
}
