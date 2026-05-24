'use client';

import AdminShell from '@/components/admin/AdminShell';
import { ComingSoonPage, PageHeader } from '@/components/ui';

export default function AiApprovalsPage() {
  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'AI Center' }, { label: 'AI Approval Queue' }]}
          title="AI Approval Queue"
        />
        <ComingSoonPage
          eyebrow="AI Center"
          icon="checklist"
          title="AI approval queue"
          description="A human-in-the-loop queue where every AI-proposed action waits for review. Approve, edit or reject — nothing executes without a person's sign-off."
          plannedFeatures={[
            'Unified queue of all AI-proposed actions',
            'Side-by-side proposed change and current state',
            'Approve, edit-then-approve or reject with a reason',
            'Escalation rules and SLA timers per action type',
          ]}
          integrations={['AI Actions', 'Permissions', 'Audit log', 'Notification gateway']}
          roadmap={[
            { phase: 'Phase 1', title: 'Review queue', description: 'A single queue for proposed actions with full context.', eta: 'Q4 2026' },
            { phase: 'Phase 2', title: 'Policy routing', description: 'Route approvals to the right role based on action and risk.', eta: 'Q1 2027' },
            { phase: 'Phase 3', title: 'Confidence-based auto-approve', description: 'Optionally auto-approve high-confidence, low-risk proposals.', eta: 'Q2 2027' },
          ]}
          preview="table"
        />
      </div>
    </AdminShell>
  );
}
