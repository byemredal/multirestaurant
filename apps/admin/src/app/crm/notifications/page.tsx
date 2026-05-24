'use client';

import AdminShell from '@/components/admin/AdminShell';
import { ComingSoonPage, PageHeader } from '@/components/ui';

export default function CrmNotificationsPage() {
  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'CRM & Growth' }, { label: 'Notifications' }]}
          title="Notifications"
        />
        <ComingSoonPage
          eyebrow="CRM & Growth"
          icon="bell"
          title="Customer notification campaigns"
          description="Design, schedule and measure customer-facing notifications across push, email and SMS — with templates, targeting and delivery analytics."
          plannedFeatures={[
            'Multi-channel composer for push, email and SMS',
            'Audience targeting powered by CRM segments',
            'Reusable, localised message templates',
            'Delivery, open and conversion analytics',
          ]}
          integrations={['CRM segments', 'SendGrid', 'Twilio', 'Push gateway']}
          roadmap={[
            { phase: 'Phase 1', title: 'Template library', description: 'Localised, reusable templates per channel.', eta: 'Q4 2026' },
            { phase: 'Phase 2', title: 'Targeted broadcasts', description: 'Schedule campaigns to CRM-defined audiences.', eta: 'Q1 2027' },
            { phase: 'Phase 3', title: 'Journey automation', description: 'Behaviour-triggered, multi-step notification journeys.', eta: 'Q2 2027' },
          ]}
          preview="table"
        />
      </div>
    </AdminShell>
  );
}
