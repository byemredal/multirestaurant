'use client';

import AdminShell from '@/components/admin/AdminShell';
import { ComingSoonPage, PageHeader } from '@/components/ui';

export default function AiSuggestionsPage() {
  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'AI Center' }, { label: 'AI Suggestions' }]}
          title="AI Suggestions"
        />
        <ComingSoonPage
          eyebrow="AI Center"
          icon="lightbulb"
          title="Proactive AI suggestions"
          description="Surface ranked, explainable recommendations across operations, finance and growth — each with the reasoning and data behind it, ready for a human to act on."
          plannedFeatures={[
            'Ranked suggestions with confidence and impact scoring',
            'Explainable reasoning attached to every suggestion',
            'Accept, dismiss or snooze with feedback capture',
            'Suggestion digest delivered to the right team',
          ]}
          integrations={['Analytics warehouse', 'Notification gateway', 'CRM', 'Slack']}
          roadmap={[
            { phase: 'Phase 1', title: 'Operational nudges', description: 'Suggestions for zone coverage, store availability and queue health.', eta: 'Q4 2026' },
            { phase: 'Phase 2', title: 'Growth suggestions', description: 'Campaign and pricing recommendations driven by demand signals.', eta: 'Q1 2027' },
            { phase: 'Phase 3', title: 'Personalised digests', description: 'Per-role suggestion digests with measurable outcome tracking.', eta: 'Q2 2027' },
          ]}
          preview="chart"
        />
      </div>
    </AdminShell>
  );
}
