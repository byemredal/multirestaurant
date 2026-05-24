'use client';

import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import {
  BarChart,
  MetricGrid,
  PageHeader,
  SectionCard,
  StatusBadge,
  type BadgeTone,
} from '@/components/ui';
import { Icon } from '@/lib/icons';
import {
  dashboardAlerts,
  dashboardMetrics,
  liveFeed,
  operationalHealth,
  orderVolumeByHour,
  pendingActions,
  type HealthState,
} from '@/lib/mock/dashboard';

const healthDot: Record<HealthState, string> = {
  ok: 'admin-status-dot admin-status-dot--ok',
  warn: 'admin-status-dot admin-status-dot--warn',
  down: 'admin-status-dot admin-status-dot--down',
};

const severityTone: Record<string, BadgeTone> = {
  critical: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'accent',
};

export default function DashboardPage() {
  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          title="Genel Bakış"
          description="Sipariş hacmi, operasyonel sağlık ve bekleyen aksiyonlar dahil olmak üzere platformunuzun genel durumunu görüntüleyin."
          actions={
            <>
              <button type="button" className="admin-button">
                <Icon.download width={15} height={15} />
                Dışa aktar
              </button>
              <button type="button" className="admin-button admin-button--primary">
                <Icon.activity width={15} height={15} />
                Canlı etkinlikler
              </button>
            </>
          }
        />

        <MetricGrid metrics={dashboardMetrics} />

        <div className="admin-split admin-split--wide-left">
          <SectionCard
            title="Sipariş hacmi"
            subtitle="Orders placed per 2-hour window"
            actions={
              <span className="admin-badge admin-badge--success admin-badge--dot">
                Peak 20:00
              </span>
            }
          >
            <BarChart
              data={orderVolumeByHour}
              valueFormatter={(value) => `${value} orders`}
            />
          </SectionCard>

          <SectionCard
            title="Operasyonel sağlık"
            subtitle="Tüm sistemler nominal çalışıyor, ancak bazı gecikmeler yaşanıyor."
            flush
          >
            <div style={{ padding: '4px 18px 12px' }}>
              {operationalHealth.map((service) => (
                <div key={service.id} className="admin-health-row">
                  <span
                    className={healthDot[service.state]}
                    style={{ position: 'relative' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {service.name}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                      {service.detail}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color:
                        service.state === 'down'
                          ? 'var(--danger)'
                          : service.state === 'warn'
                          ? 'var(--warning)'
                          : 'var(--text-2)',
                    }}
                  >
                    {service.metric}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="admin-split admin-split--wide-right">
          <SectionCard
            title="Bekleyen aksiyonlar"
            subtitle="Admin ekibine yönlendirilen öğeler"
            flush
          >
            <div className="admin-list">
              {pendingActions.map((action) => {
                const ActionIcon = Icon[action.icon];
                return (
                  <Link
                    key={action.id}
                    href={action.href}
                    className="admin-list-row"
                  >
                    <div className="admin-identity">
                      <span className="admin-identity__logo">
                        <ActionIcon width={16} height={16} />
                      </span>
                      <div>
                        <div className="admin-list-row__title">
                          {action.title}
                        </div>
                        <div className="admin-list-row__meta">
                          {action.meta}
                        </div>
                      </div>
                    </div>
                    <div className="admin-row">
                      <StatusBadge label={action.tag} tone={action.tone} dot={false} />
                      <Icon.chevronRight
                        width={16}
                        height={16}
                        style={{ color: 'var(--muted-2)' }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            title="Canlı etkinlik"
            subtitle="En son platform olayları"
            actions={
              <Link href="/live-activity" className="admin-link" style={{ fontSize: 12.5 }}>
                Tümünü görüntüle
              </Link>
            }
          >
            <div>
              {liveFeed.slice(0, 6).map((event) => {
                const EventIcon = Icon[event.icon];
                return (
                  <div key={event.id} className="admin-feed-item">
                    <span className="admin-feed-item__icon">
                      <EventIcon width={15} height={15} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="admin-feed-item__title">{event.title}</div>
                      <div className="admin-feed-item__meta">{event.meta}</div>
                    </div>
                    <span className="admin-feed-item__time">{event.time}</span>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Uyarılar ve olaylar"
          subtitle="Gecikmeler, başarısız ödemeler ve şüpheli etkinlikler"
          actions={
            <Link href="/alerts" className="admin-button admin-button--sm">
              Olay panosu
            </Link>
          }
          flush
        >
          <div className="admin-list">
            {dashboardAlerts.map((alert) => (
              <div key={alert.id} className="admin-list-row">
                <div className="admin-identity">
                  <span
                    className="admin-identity__logo"
                    style={{
                      background: 'var(--danger-soft)',
                      color: 'var(--danger)',
                    }}
                  >
                    <Icon.alert width={16} height={16} />
                  </span>
                  <div>
                    <div className="admin-list-row__title">{alert.title}</div>
                    <div className="admin-list-row__meta">{alert.meta}</div>
                  </div>
                </div>
                <div className="admin-row">
                  <StatusBadge
                    label={alert.severity}
                    tone={severityTone[alert.severity]}
                  />
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {alert.time} ago
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </AdminShell>
  );
}
