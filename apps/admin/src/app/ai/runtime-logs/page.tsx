'use client';

import AdminShell from '@/components/admin/AdminShell';
import { ComingSoonPage, PageHeader } from '@/components/ui';

export default function AiRuntimeLogsPage() {
  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'AI Center' }, { label: 'AI Runtime Logs' }]}
          title="AI Runtime Logs"
        />
        <ComingSoonPage
          eyebrow="AI Center"
          icon="terminal"
          title="AI runtime logs"
          description="A complete, auditable trace of every AI invocation — prompts, tool calls, outputs, latency and cost — so the platform's AI behaviour is fully observable."
          plannedFeatures={[
            'Per-invocation traces with prompt and tool-call detail',
            'Latency, token usage and cost breakdown',
            'Error and guardrail-block inspection',
            'Searchable, exportable runtime history',
          ]}
          integrations={['Observability pipeline', 'Audit log', 'Datadog', 'Cost analytics']}
          roadmap={[
            { phase: 'Phase 1', title: 'Invocation logging', description: 'Capture every AI call with structured metadata.', eta: 'Q3 2026' },
            { phase: 'Phase 2', title: 'Trace explorer', description: 'Drill into a single trace step-by-step, including tool calls.', eta: 'Q4 2026' },
            { phase: 'Phase 3', title: 'Cost & quality dashboards', description: 'Aggregate dashboards for spend, latency and output quality.', eta: 'Q1 2027' },
          ]}
          preview="table"
        />
      </div>
    </AdminShell>
  );
}
