'use client';

import AdminShell from '@/components/admin/AdminShell';
import { ComingSoonPage, PageHeader } from '@/components/ui';

export default function CrmPage() {
  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'CRM & Growth' }, { label: 'CRM' }]}
          title="CRM"
        />
        <ComingSoonPage
          eyebrow="CRM & Growth"
          icon="heart"
          title="Customer relationship management"
          description="A unified view of every customer — order history, lifetime value, segments and lifecycle stage — built to power retention and growth across the platform."
          plannedFeatures={[
            'Unified customer profiles with full order history',
            'Dynamic segments based on behaviour and value',
            'Lifecycle stages from first order to churn risk',
            'Cohort and retention analytics',
          ]}
          integrations={['Orders', 'Notifications', 'Analytics warehouse', 'SendGrid']}
          roadmap={[
            { phase: 'Phase 1', title: 'Customer profiles', description: 'Consolidated profiles with history and lifetime value.', eta: 'Q3 2026' },
            { phase: 'Phase 2', title: 'Segmentation', description: 'Rule-based and behavioural segments for targeting.', eta: 'Q4 2026' },
            { phase: 'Phase 3', title: 'Lifecycle automation', description: 'Triggered journeys across the customer lifecycle.', eta: 'Q1 2027' },
          ]}
          preview="chart"
        />
      </div>
    </AdminShell>
  );
}
