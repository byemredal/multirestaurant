'use client';

import { useMemo } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { PageHeader, SectionCard } from '@/components/ui';
import { Icon } from '@/lib/icons';
import { systemConfig } from '@/lib/mock/system';

export default function SystemConfigurationPage() {
  const groups = useMemo(() => {
    const map = new Map<string, typeof systemConfig>();
    systemConfig.forEach((entry) => {
      const list = map.get(entry.group) ?? [];
      list.push(entry);
      map.set(entry.group, list);
    });
    return Array.from(map.entries());
  }, []);

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'System' }, { label: 'System Configuration' }]}
          title="System Configuration"
          description="Platform-wide operational settings. Changes here affect every tenant and store."
          actions={
            <button type="button" className="admin-button">
              <Icon.logs width={15} height={15} />
              View change history
            </button>
          }
        />

        {groups.map(([group, entries]) => (
          <SectionCard key={group} title={group} flush>
            <div className="admin-list">
              {entries.map((entry) => (
                <div key={entry.id} className="admin-list-row">
                  <div>
                    <div className="admin-list-row__title">{entry.label}</div>
                    <div className="admin-list-row__meta">
                      Current value:{' '}
                      <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>
                        {entry.value}
                      </span>
                    </div>
                  </div>
                  <div className="admin-row">
                    {entry.editable ? (
                      <button
                        type="button"
                        className="admin-button admin-button--sm"
                      >
                        <Icon.settings width={14} height={14} />
                        Edit
                      </button>
                    ) : (
                      <span className="admin-tag">
                        <Icon.shield width={12} height={12} />
                        Locked
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        ))}
      </div>
    </AdminShell>
  );
}
