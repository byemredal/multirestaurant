'use client';

import { useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  DataTable,
  FilterBar,
  MetricGrid,
  PageHeader,
  SectionCard,
  StatusBadge,
  type Column,
  type FilterChip,
  type Metric,
} from '@/components/ui';
import { Icon } from '@/lib/icons';
import {
  platformStatusTone,
  platformUsers,
  type PlatformUserRow,
} from '@/lib/mock/platform';
import { adminRoleList } from '@/lib/rbac/roles';

const metrics: Metric[] = [
  { label: 'Platform users', value: '38', icon: 'users', tone: 'accent', foot: 'admin & tenant accounts' },
  { label: 'Active now', value: '12', icon: 'activity', tone: 'success', foot: 'signed in today' },
  { label: 'Pending invites', value: '3', icon: 'inbox', tone: 'warning', foot: 'awaiting acceptance' },
  { label: 'Roles defined', value: '6', icon: 'shield', tone: 'accent', foot: 'across all scopes' },
];

export default function UsersRolesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const chips: FilterChip[] = [
    { id: 'all', label: 'All', count: platformUsers.length },
    { id: 'active', label: 'Active', count: platformUsers.filter((u) => u.status === 'active').length },
    { id: 'invited', label: 'Invited', count: platformUsers.filter((u) => u.status === 'invited').length },
    { id: 'disabled', label: 'Disabled', count: platformUsers.filter((u) => u.status === 'disabled').length },
  ];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return platformUsers.filter((user) => {
      if (status !== 'all' && user.status !== status) return false;
      if (!q) return true;
      return `${user.name} ${user.email} ${user.role}`
        .toLowerCase()
        .includes(q);
    });
  }, [search, status]);

  const columns: Column<PlatformUserRow>[] = [
    {
      key: 'user',
      header: 'User',
      render: (row) => (
        <div className="admin-identity">
          <span className="admin-avatar app-avatar" style={{ borderRadius: 8 }}>
            {row.name
              .split(' ')
              .map((p) => p[0])
              .join('')}
          </span>
          <div>
            <div className="admin-table__primary">{row.name}</div>
            <div className="admin-table__sub">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => <span className="admin-tag">{row.role}</span>,
    },
    { key: 'scope', header: 'Scope', render: (row) => row.scope },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge label={row.status} tone={platformStatusTone[row.status]} />
      ),
    },
    {
      key: 'lastActive',
      header: 'Last active',
      render: (row) => <span className="admin-muted">{row.lastActive}</span>,
    },
  ];

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'Platform' }, { label: 'Users & Roles' }]}
          title="Users & Roles"
          description="Manage admin and tenant accounts, their roles and access scope."
          actions={
            <button type="button" className="admin-button admin-button--primary">
              <Icon.plus width={15} height={15} />
              Invite user
            </button>
          }
        />

        <MetricGrid metrics={metrics} />

        <SectionCard
          title="Role definitions"
          subtitle="Access boundaries available across the platform"
        >
          <div className="admin-roadmap">
            {adminRoleList.map((role) => (
              <div key={role.id} className="admin-roadmap__card">
                <div className="admin-row" style={{ gap: 8 }}>
                  <span
                    className="admin-identity__logo"
                    style={{
                      width: 28,
                      height: 28,
                      background: 'var(--accent-soft)',
                      color: 'var(--accent-hover)',
                    }}
                  >
                    <Icon.shield width={15} height={15} />
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {role.label}
                  </span>
                </div>
                <p className="admin-roadmap__card-desc" style={{ marginTop: 8 }}>
                  {role.description}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search users by name, email or role…"
          chips={chips}
          activeChip={status}
          onChipChange={setStatus}
        />

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          footer={<span>{rows.length} users</span>}
        />
      </div>
    </AdminShell>
  );
}
