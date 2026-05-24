'use client';

import AdminShell from '@/components/admin/AdminShell';
import { PageHeader, SectionCard } from '@/components/ui';
import { Icon } from '@/lib/icons';
import { permissionGroups } from '@/lib/mock/platform';

export default function PermissionsPage() {
  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'Platform' }, { label: 'Permissions' }]}
          title="Permissions"
          description="Capability matrix mapping operational actions to the roles allowed to perform them."
          actions={
            <button type="button" className="admin-button">
              <Icon.download width={15} height={15} />
              Export matrix
            </button>
          }
        />

        {permissionGroups.map((group) => (
          <SectionCard
            key={group.id}
            title={group.domain}
            subtitle={group.description}
            flush
          >
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th>Granted to roles</th>
                </tr>
              </thead>
              <tbody>
                {group.capabilities.map((capability) => (
                  <tr key={capability.label}>
                    <td>
                      <div className="admin-row" style={{ gap: 8 }}>
                        <span
                          className="admin-feature-list__check"
                          style={{ width: 22, height: 22 }}
                        >
                          <Icon.check width={13} height={13} />
                        </span>
                        <span className="admin-table__primary">
                          {capability.label}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="admin-row" style={{ gap: 6 }}>
                        {capability.roles.map((role) => (
                          <span key={role} className="admin-tag">
                            <Icon.shield width={12} height={12} />
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        ))}
      </div>
    </AdminShell>
  );
}
