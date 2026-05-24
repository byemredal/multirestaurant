'use client';

import AdminShell from '@/components/admin/AdminShell';
import { ComingSoonPage, PageHeader } from '@/components/ui';

export default function AiActionsPage() {
  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'AI Center' }, { label: 'AI Actions' }]}
          title="AI Actions"
        />
        <ComingSoonPage
          eyebrow="AI Center"
          icon="bolt"
          title="Automated AI actions"
          description="Define safe, scoped actions the platform can take automatically — re-routing orders, pausing zones or flagging anomalies — each governed by guardrails and approval policy."
          plannedFeatures={[
            'Action catalog with per-action permission scopes',
            'Guardrails: value limits, rate limits and dry-run mode',
            'Trigger builder based on operational events',
            'Full action history with one-click rollback',
          ]}
          integrations={['Workflow engine', 'Feature flags', 'Audit log', 'Webhooks']}
          roadmap={[
            { phase: 'Phase 1', title: 'Action catalog', description: 'A registry of well-defined, reversible actions with strict scopes.', eta: 'Q4 2026' },
            { phase: 'Phase 2', title: 'Event triggers', description: 'Connect actions to operational events with configurable conditions.', eta: 'Q1 2027' },
            { phase: 'Phase 3', title: 'Autonomous mode', description: 'Opt-in autonomous execution for low-risk, high-confidence actions.', eta: 'Q2 2027' },
          ]}
          preview="table"
        />
      </div>
    </AdminShell>
  );
}
