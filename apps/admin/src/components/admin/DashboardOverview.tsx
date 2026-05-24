'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { listTenantApplications, listTenantDocuments } from '@/lib/admin-api/admin-review-client';
import { badgeClass, formatDateTime, statusLabel } from '@/lib/admin-api/admin-review-ui';
import type { ApplicationListEntry, TenantDocumentQueueEntry } from '@/lib/admin-api/admin-review-types';
import { requireAdminSession } from '@/lib/admin-api/require-admin-session';

function countByStatus(applications: ApplicationListEntry[], statuses: string[]) {
  return applications.filter((entry) => statuses.includes(entry.application.status)).length;
}

export default function DashboardOverview() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationListEntry[]>([]);
  const [documents, setDocuments] = useState<TenantDocumentQueueEntry[]>([]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const session = await requireAdminSession();
        const [a, d] = await Promise.all([listTenantApplications(session), listTenantDocuments(session)]);
        setApplications(a);
        setDocuments(d);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Dashboard could not be loaded.');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  const pendingApplications = useMemo(
    () =>
      applications
        .filter((entry) => ['submitted', 'under_review', 'revision_required'].includes(entry.application.status))
        .sort((a, b) => (a.application.updatedAt > b.application.updatedAt ? -1 : 1)),
    [applications],
  );

  const pendingDocuments = useMemo(
    () =>
      documents
        .filter((entry) => ['pending', 'revision_requested'].includes(entry.document.status))
        .sort((a, b) => (a.document.uploadedAt > b.document.uploadedAt ? -1 : 1)),
    [documents],
  );

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div className="admin-kpi-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="admin-skeleton" style={{ height: 92 }} />
          ))}
        </div>
        <div className="admin-skeleton" style={{ height: 240 }} />
      </div>
    );
  }

  if (error) {
    return <div className="admin-state admin-state--error">{error}</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="admin-kpi-grid">
        <Kpi label="Pending review" value={countByStatus(applications, ['submitted', 'under_review'])} meta="Awaiting decision" />
        <Kpi label="Revision asked" value={countByStatus(applications, ['revision_required'])} meta="Tenant action required" />
        <Kpi label="Active tenants" value={countByStatus(applications, ['active'])} meta="Live on platform" />
        <Kpi label="Suspended" value={countByStatus(applications, ['suspended'])} meta="Operational hold" />
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
        <div className="admin-card">
          <div className="admin-card__header">
            <div>
              <h3 className="admin-card__title">Pending applications</h3>
              <div className="admin-card__subtitle">İncelenmeyi bekleyen tenant başvuruları.</div>
            </div>
            <Link className="admin-button admin-button--sm" href="/tenant-applications">Open queue →</Link>
          </div>
          {pendingApplications.length === 0 ? (
            <div className="admin-card__body">
              <div className="admin-state">Şu an inceleme bekleyen başvuru yok.</div>
            </div>
          ) : (
            <div className="admin-list">
              {pendingApplications.slice(0, 5).map((entry) => (
                <Link
                  key={entry.application.id}
                  href={`/tenants/${entry.application.tenantAccountId}?tab=review`}
                  className="admin-list-row"
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="admin-list-row__title">{entry.tenantCompanyName}</div>
                    <div className="admin-list-row__meta">
                      {entry.ownerContactName ?? entry.tenantEmail} · {entry.documentSummary.approved}/{entry.documentSummary.totalCurrent} docs approved
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span className={badgeClass(entry.application.status)}>{statusLabel(entry.application.status)}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{formatDateTime(entry.application.updatedAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="admin-card">
          <div className="admin-card__header">
            <div>
              <h3 className="admin-card__title">Documents queue</h3>
              <div className="admin-card__subtitle">İnceleme bekleyen belgeler.</div>
            </div>
            <Link className="admin-button admin-button--sm" href="/documents">Open queue →</Link>
          </div>
          {pendingDocuments.length === 0 ? (
            <div className="admin-card__body">
              <div className="admin-state">Sırada bekleyen belge yok.</div>
            </div>
          ) : (
            <div className="admin-list">
              {pendingDocuments.slice(0, 5).map((entry) => (
                <Link
                  key={entry.document.id}
                  href={`/tenants/${entry.application?.tenantAccountId ?? entry.tenantAccount?.id ?? ''}?tab=documents`}
                  className="admin-list-row"
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="admin-list-row__title" style={{ textTransform: 'capitalize' }}>
                      {entry.document.type.replaceAll('_', ' ')}
                    </div>
                    <div className="admin-list-row__meta">{entry.tenantAccount?.companyName ?? '—'}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span className={badgeClass(entry.document.status)}>{statusLabel(entry.document.status)}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{formatDateTime(entry.document.uploadedAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, meta }: { label: string; value: number; meta: string }) {
  return (
    <div className="admin-kpi">
      <div className="admin-kpi__label">{label}</div>
      <div className="admin-kpi__value">{value}</div>
      <div className="admin-kpi__meta">{meta}</div>
    </div>
  );
}
