'use client';

import AdminShell from '@/components/admin/AdminShell';
import { ComingSoonPage, PageHeader } from '@/components/ui';

export default function AiAssistantsPage() {
  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'AI Center' }, { label: 'AI Assistants' }]}
          title="AI Assistants"
        />
        <ComingSoonPage
          eyebrow="AI Center"
          icon="sparkles"
          title="Operational AI assistants"
          description="Purpose-built assistants that help your team triage incidents, answer tenant questions and summarise operational data — directly inside the admin console."
          plannedFeatures={[
            'Incident triage assistant with suggested next steps',
            'Tenant support copilot trained on platform policy',
            'Natural-language querying of orders and finance data',
            'Inline summaries on every detail drawer',
          ]}
          integrations={['Anthropic Claude', 'Internal knowledge base', 'Audit log', 'Slack']}
          roadmap={[
            { phase: 'Phase 1', title: 'Read-only copilot', description: 'A sidebar assistant that can answer questions about platform data without taking actions.', eta: 'Q3 2026' },
            { phase: 'Phase 2', title: 'Assisted workflows', description: 'Assistants draft responses and actions for a human to review and approve.', eta: 'Q4 2026' },
            { phase: 'Phase 3', title: 'Domain assistants', description: 'Specialised assistants for finance, operations and onboarding teams.', eta: 'Q1 2027' },
          ]}
          preview="chart"
        />
      </div>
    </AdminShell>
  );
}
