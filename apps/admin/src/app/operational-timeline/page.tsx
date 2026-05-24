'use client';

import { useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { PageHeader, SectionCard, Timeline } from '@/components/ui';
import { Icon } from '@/lib/icons';
import { opsTimeline } from '@/lib/mock/operations';

const filters = [
  { id: 'all', label: 'All events' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'operational', label: 'Operational' },
];

export default function OperationalTimelinePage() {
  const [filter, setFilter] = useState('all');

  const entries = useMemo(() => {
    if (filter === 'incidents') {
      return opsTimeline.filter(
        (e) => e.tone === 'danger' || e.tone === 'warning',
      );
    }
    if (filter === 'operational') {
      return opsTimeline.filter(
        (e) => e.tone !== 'danger' && e.tone !== 'warning',
      );
    }
    return opsTimeline;
  }, [filter]);

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'Operations' }, { label: 'Operational Timeline' }]}
          title="Operational Timeline"
          description="A chronological record of every operationally significant event across the platform."
          actions={
            <button type="button" className="admin-button">
              <Icon.download width={15} height={15} />
              Export log
            </button>
          }
        />

        <SectionCard
          title="Today — May 18, 2026"
          subtitle={`${entries.length} events`}
          actions={
            <div className="admin-row" style={{ gap: 6 }}>
              {filters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`admin-chip${
                    filter === item.id ? ' admin-chip--active' : ''
                  }`}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          }
        >
          <Timeline
            entries={entries.map((e) => ({
              id: e.id,
              title: e.title,
              meta: e.meta,
              icon: e.icon,
              tone: e.tone,
            }))}
          />
        </SectionCard>
      </div>
    </AdminShell>
  );
}
