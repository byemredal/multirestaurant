'use client';

import AdminShell from '@/components/admin/AdminShell';
import { ComingSoonPage, PageHeader } from '@/components/ui';

export default function CrmPromotionsPage() {
  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'CRM & Growth' }, { label: 'Promotions' }]}
          title="Promotions"
        />
        <ComingSoonPage
          eyebrow="CRM & Growth"
          icon="gift"
          title="Promotions engine"
          description="A flexible promotions engine for platform-funded and tenant-funded offers — with budgets, eligibility rules and real-time performance tracking."
          plannedFeatures={[
            'Rule-based eligibility and stacking control',
            'Platform vs. tenant funding split',
            'Budget caps with automatic pausing',
            'Real-time uplift and margin reporting',
          ]}
          integrations={['Orders', 'Finance', 'CRM segments', 'Campaigns']}
          roadmap={[
            { phase: 'Phase 1', title: 'Offer builder', description: 'Create promotions with eligibility and funding rules.', eta: 'Q4 2026' },
            { phase: 'Phase 2', title: 'Budget governance', description: 'Caps, alerts and automatic pausing on overspend.', eta: 'Q1 2027' },
            { phase: 'Phase 3', title: 'Performance optimisation', description: 'Uplift attribution and recommended adjustments.', eta: 'Q2 2027' },
          ]}
          preview="chart"
        />
      </div>
    </AdminShell>
  );
}
