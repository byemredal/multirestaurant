'use client';

import AdminShell from '@/components/admin/AdminShell';
import { PageHeader, SectionCard, StatusBadge } from '@/components/ui';
import { Icon } from '@/lib/icons';
import { serviceTypes, systemStatusLabel, systemStatusTone } from '@/lib/mock/system';

const serviceIcon = ['truck', 'bag', 'store', 'megaphone'] as const;

export default function ServiceTypesPage() {
  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'System' }, { label: 'Service Types' }]}
          title="Service Types"
          description="Fulfilment models available to stores — delivery, pickup, dine-in and more."
          actions={
            <button type="button" className="admin-button admin-button--primary">
              <Icon.plus width={15} height={15} />
              Add service type
            </button>
          }
        />

        <div className="admin-roadmap">
          {serviceTypes.map((service, index) => {
            const ServiceIcon = Icon[serviceIcon[index % serviceIcon.length]];
            return (
              <article key={service.id} className="admin-roadmap__card">
                <div className="admin-spread">
                  <span
                    className="admin-identity__logo"
                    style={{
                      width: 38,
                      height: 38,
                      background: 'var(--accent-soft)',
                      color: 'var(--accent-hover)',
                    }}
                  >
                    <ServiceIcon width={19} height={19} />
                  </span>
                  <StatusBadge
                    label={systemStatusLabel[service.status]}
                    tone={systemStatusTone[service.status]}
                  />
                </div>
                <h3 className="admin-roadmap__card-title" style={{ marginTop: 14 }}>
                  {service.name}
                </h3>
                <p className="admin-roadmap__card-desc">{service.description}</p>
                <div
                  className="admin-spread"
                  style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}
                >
                  <span>{service.stores} stores</span>
                  <span>SLA · {service.slaTarget}</span>
                </div>
              </article>
            );
          })}
        </div>

        <SectionCard
          title="Fulfilment policy"
          subtitle="Defaults applied to every new store"
        >
          <div className="admin-kv-grid">
            <div>
              <div className="admin-kv__label">Default service type</div>
              <div className="admin-kv__value">Delivery</div>
            </div>
            <div>
              <div className="admin-kv__label">Pickup auto-enabled</div>
              <div className="admin-kv__value">Yes — for all new stores</div>
            </div>
            <div>
              <div className="admin-kv__label">Dine-in approval</div>
              <div className="admin-kv__value">Requires manual review</div>
            </div>
          </div>
        </SectionCard>
      </div>
    </AdminShell>
  );
}
