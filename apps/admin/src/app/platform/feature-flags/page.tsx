'use client';

import { useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  MetricGrid,
  PageHeader,
  SectionCard,
  StatusBadge,
  type Metric,
} from '@/components/ui';
import { Icon } from '@/lib/icons';
import {
  featureFlags,
  platformStatusTone,
  type FeatureFlagRow,
} from '@/lib/mock/platform';

const metrics: Metric[] = [
  { label: 'Total flags', value: '24', icon: 'flag', tone: 'accent', foot: 'across environments' },
  { label: 'Enabled', value: '9', icon: 'check', tone: 'success', foot: 'fully on' },
  { label: 'In rollout', value: '5', icon: 'activity', tone: 'warning', foot: 'partial exposure' },
  { label: 'Stale flags', value: '3', icon: 'clock', tone: 'danger', foot: 'unchanged 90+ days' },
];

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        width: 38,
        height: 22,
        borderRadius: 999,
        border: 0,
        cursor: 'pointer',
        padding: 2,
        background: on ? 'var(--accent)' : 'var(--border-strong)',
        transition: 'background 140ms ease',
      }}
    >
      <span
        style={{
          display: 'block',
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          transform: on ? 'translateX(16px)' : 'translateX(0)',
          transition: 'transform 140ms ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        }}
      />
    </button>
  );
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlagRow[]>(featureFlags);

  const toggle = (id: string) =>
    setFlags((prev) =>
      prev.map((flag) =>
        flag.id === id
          ? {
              ...flag,
              status: flag.status === 'off' ? 'on' : 'off',
              rollout: flag.status === 'off' ? 100 : 0,
            }
          : flag,
      ),
    );

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'Platform' }, { label: 'Feature Flags' }]}
          title="Feature Flags"
          description="Control progressive rollouts and toggle platform capabilities per environment."
          actions={
            <button type="button" className="admin-button admin-button--primary">
              <Icon.plus width={15} height={15} />
              New flag
            </button>
          }
        />

        <MetricGrid metrics={metrics} />

        <SectionCard title="All flags" subtitle="Production & staging" flush>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Flag</th>
                <th>Status</th>
                <th>Rollout</th>
                <th>Environment</th>
                <th>Updated</th>
                <th style={{ textAlign: 'right' }}>Enabled</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.id}>
                  <td>
                    <div className="admin-identity">
                      <span
                        className="admin-identity__logo"
                        style={{
                          background: 'var(--accent-soft)',
                          color: 'var(--accent-hover)',
                        }}
                      >
                        <Icon.flag width={15} height={15} />
                      </span>
                      <div>
                        <div
                          className="admin-table__primary"
                          style={{ fontFamily: 'ui-monospace, monospace' }}
                        >
                          {flag.key}
                        </div>
                        <div className="admin-table__sub">
                          {flag.description}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <StatusBadge
                      label={flag.status}
                      tone={platformStatusTone[flag.status]}
                    />
                  </td>
                  <td>
                    <div className="admin-row" style={{ gap: 8 }}>
                      <div className="admin-progress" style={{ width: 80 }}>
                        <div
                          className="admin-progress__fill"
                          style={{ width: `${flag.rollout}%` }}
                        />
                      </div>
                      <span className="admin-table__num">{flag.rollout}%</span>
                    </div>
                  </td>
                  <td>
                    <span className="admin-tag">{flag.environment}</span>
                  </td>
                  <td>
                    <span className="admin-muted">{flag.updated}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Toggle
                        on={flag.status !== 'off'}
                        onClick={() => toggle(flag.id)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </AdminShell>
  );
}
