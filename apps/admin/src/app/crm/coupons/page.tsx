'use client';

import AdminShell from '@/components/admin/AdminShell';
import { ComingSoonPage, PageHeader } from '@/components/ui';

export default function CrmCouponsPage() {
  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'CRM & Growth' }, { label: 'Coupons' }]}
          title="Coupons"
        />
        <ComingSoonPage
          eyebrow="CRM & Growth"
          icon="ticket"
          title="Coupon management"
          description="Generate, distribute and track coupon codes — single-use, bulk and referral — with fraud controls and full redemption analytics."
          plannedFeatures={[
            'Single-use, multi-use and bulk code generation',
            'Referral and win-back coupon programs',
            'Redemption limits and fraud detection',
            'Per-code and per-campaign redemption analytics',
          ]}
          integrations={['Promotions engine', 'Orders', 'CRM', 'Fraud signals']}
          roadmap={[
            { phase: 'Phase 1', title: 'Code generation', description: 'Create and distribute coupon codes at scale.', eta: 'Q4 2026' },
            { phase: 'Phase 2', title: 'Referral programs', description: 'Two-sided referral coupons with tracking.', eta: 'Q1 2027' },
            { phase: 'Phase 3', title: 'Fraud controls', description: 'Velocity checks and anomaly detection on redemptions.', eta: 'Q2 2027' },
          ]}
          preview="table"
        />
      </div>
    </AdminShell>
  );
}
