'use client';

import { useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  DataTable,
  Drawer,
  DrawerField,
  MetricGrid,
  PageHeader,
  StatusBadge,
  Tabs,
  type BadgeTone,
  type Column,
  type Metric,
} from '@/components/ui';
import { Icon } from '@/lib/icons';

type Severity = 'critical' | 'high' | 'medium' | 'low';
type IncidentStatus = 'open' | 'acknowledged' | 'resolved';

type Incident = {
  id: string;
  title: string;
  service: string;
  severity: Severity;
  status: IncidentStatus;
  opened: string;
  owner: string;
  summary: string;
};

const incidents: Incident[] = [
  { id: 'INC-3041', title: 'SMS notification provider degraded', service: 'Notification gateway', severity: 'critical', status: 'open', opened: 'May 18, 11:56', owner: 'Devon Aric', summary: 'Twilio SMS delivery success dropped below 60%. Failover to secondary provider triggered; order status messages may be delayed.' },
  { id: 'INC-3040', title: 'Elevated payment failures on 3DS challenge', service: 'Payments — Stripe', severity: 'high', status: 'acknowledged', opened: 'May 18, 12:24', owner: 'Clara Mendel', summary: '37 failed authorizations in the last hour, concentrated on 3D Secure challenge step. Investigating with provider.' },
  { id: 'INC-3039', title: 'Order processing queue backlog', service: 'Order pipeline', severity: 'medium', status: 'open', opened: 'May 18, 12:10', owner: 'Unassigned', summary: 'Queue depth above 1,900 jobs; processing latency ~90s above baseline during the midday peak.' },
  { id: 'INC-3038', title: 'Unusual login pattern flagged', service: 'Authentication', severity: 'low', status: 'acknowledged', opened: 'May 18, 11:30', owner: 'Priya Nair', summary: 'Repeated failed logins for tenant account “Pasta Mancini” from an unrecognised IP range. Account temporarily rate-limited.' },
  { id: 'INC-3035', title: 'Webhook payout.settled delivery failures', service: 'Webhooks', severity: 'high', status: 'resolved', opened: 'May 17, 22:14', owner: 'Devon Aric', summary: 'Internal finance endpoint returned 5xx for 28 minutes. Endpoint recovered; failed events replayed successfully.' },
  { id: 'INC-3034', title: 'Search index staleness', service: 'Search & discovery', severity: 'medium', status: 'resolved', opened: 'May 17, 16:02', owner: 'Hans Krüger', summary: 'Index refresh job stalled; menu changes took up to 9 minutes to appear. Job restarted and freshness restored.' },
];

const severityTone: Record<Severity, BadgeTone> = {
  critical: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'accent',
};

const statusTone: Record<IncidentStatus, BadgeTone> = {
  open: 'danger',
  acknowledged: 'warning',
  resolved: 'success',
};

const metrics: Metric[] = [
  { label: 'Open incidents', value: '4', icon: 'alert', tone: 'danger', foot: '1 critical · 2 high' },
  { label: 'Mean time to ack', value: '6 min', icon: 'clock', tone: 'accent', trend: { direction: 'down', value: '18%' }, foot: 'last 7 days' },
  { label: 'Mean time to resolve', value: '54 min', icon: 'check', tone: 'success', trend: { direction: 'down', value: '9%' }, foot: 'last 7 days' },
  { label: 'Incidents this week', value: '17', icon: 'activity', tone: 'warning', trend: { direction: 'up', value: '4' }, foot: 'vs. last week' },
];

export default function AlertsPage() {
  const [tab, setTab] = useState<IncidentStatus | 'all'>('open');
  const [selected, setSelected] = useState<Incident | null>(null);

  const counts = useMemo(
    () => ({
      all: incidents.length,
      open: incidents.filter((i) => i.status === 'open').length,
      acknowledged: incidents.filter((i) => i.status === 'acknowledged').length,
      resolved: incidents.filter((i) => i.status === 'resolved').length,
    }),
    [],
  );

  const rows = useMemo(
    () => (tab === 'all' ? incidents : incidents.filter((i) => i.status === tab)),
    [tab],
  );

  const columns: Column<Incident>[] = [
    {
      key: 'incident',
      header: 'Incident',
      render: (row) => (
        <div className="admin-identity">
          <span
            className="admin-identity__logo"
            style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
          >
            <Icon.alert width={16} height={16} />
          </span>
          <div>
            <div className="admin-table__primary">{row.title}</div>
            <div className="admin-table__sub">
              {row.id} · {row.service}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (row) => (
        <StatusBadge label={row.severity} tone={severityTone[row.severity]} />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge label={row.status} tone={statusTone[row.status]} />
      ),
    },
    { key: 'owner', header: 'Owner', render: (row) => row.owner },
    {
      key: 'opened',
      header: 'Opened',
      render: (row) => <span className="admin-muted">{row.opened}</span>,
    },
  ];

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'Overview' }, { label: 'Alerts & Incidents' }]}
          title="Alerts & Incidents"
          description="Track, triage and resolve operational incidents across every platform service."
          actions={
            <button type="button" className="admin-button admin-button--primary">
              <Icon.plus width={15} height={15} />
              Declare incident
            </button>
          }
        />

        <MetricGrid metrics={metrics} />

        <Tabs
          active={tab}
          onChange={(id) => setTab(id as IncidentStatus | 'all')}
          tabs={[
            { id: 'open', label: 'Open', count: counts.open },
            { id: 'acknowledged', label: 'Acknowledged', count: counts.acknowledged },
            { id: 'resolved', label: 'Resolved', count: counts.resolved },
            { id: 'all', label: 'All', count: counts.all },
          ]}
        />

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          onRowClick={(row) => setSelected(row)}
          empty="No incidents in this state. "
          footer={<span>{rows.length} incidents</span>}
        />
      </div>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title ?? ''}
        subtitle={selected ? `${selected.id} · ${selected.service}` : ''}
        footer={
          <>
            <button type="button" className="admin-button admin-button--primary">
              Acknowledge
            </button>
            <button type="button" className="admin-button">
              Assign owner
            </button>
            <button type="button" className="admin-button admin-button--danger">
              Resolve
            </button>
          </>
        }
      >
        {selected && (
          <>
            <div className="admin-row">
              <StatusBadge
                label={selected.severity}
                tone={severityTone[selected.severity]}
              />
              <StatusBadge
                label={selected.status}
                tone={statusTone[selected.status]}
              />
            </div>
            <div className="admin-kv-grid">
              <DrawerField label="Service">{selected.service}</DrawerField>
              <DrawerField label="Owner">{selected.owner}</DrawerField>
              <DrawerField label="Opened">{selected.opened}</DrawerField>
              <DrawerField label="Incident ID">{selected.id}</DrawerField>
            </div>
            <div>
              <div className="admin-kv__label">Summary</div>
              <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.6 }}>
                {selected.summary}
              </p>
            </div>
          </>
        )}
      </Drawer>
    </AdminShell>
  );
}
