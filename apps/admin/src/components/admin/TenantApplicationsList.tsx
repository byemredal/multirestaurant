'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { listTenantApplications } from '@/lib/admin-api/admin-review-client';
import { requireAdminSession } from '@/lib/admin-api/require-admin-session';
import { badgeClass, formatDateTime, matchesApplicationSearch, statusLabel } from '@/lib/admin-api/admin-review-ui';
import type { ApplicationListEntry, ApplicationStatus } from '@/lib/admin-api/admin-review-types';

type StatusFilter = ApplicationStatus | 'all' | 'open';

const PIPELINE_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'open', label: 'Open queue' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'under_review', label: 'In review' },
  { id: 'revision_required', label: 'Revision' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

function matchesStatusFilter(entry: ApplicationListEntry, filter: StatusFilter) {
  if (filter === 'all') return true;
  if (filter === 'open') {
    return ['submitted', 'under_review', 'revision_required'].includes(entry.application.status);
  }
  return entry.application.status === filter;
}

function calcRisk(entry: ApplicationListEntry) {
  const { documentSummary } = entry;
  const total = documentSummary.totalCurrent || 0;
  const approved = documentSummary.approved || 0;
  const ratio = total === 0 ? 0 : Math.round((approved / total) * 100);
  const flags: string[] = [];

  if (!entry.completeness) flags.push('incomplete data');
  if (documentSummary.revisionRequested > 0) flags.push('revision pending');
  if (documentSummary.pending > 0 && entry.application.status === 'submitted') flags.push('docs not reviewed');

  return { ratio, flags };
}

export default function TenantApplicationsList() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationListEntry[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const session = await requireAdminSession();
        const response = await listTenantApplications(session);
        setApplications(response);
      } catch (nextError) {
        setApplications([]);
        setError(nextError instanceof Error ? nextError.message : 'Applications could not be loaded.');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  const counts = useMemo(() => {
    const map: Record<StatusFilter, number> = {
      all: applications.length,
      open: 0,
      draft: 0,
      submitted: 0,
      under_review: 0,
      revision_required: 0,
      approved: 0,
      rejected: 0,
      active: 0,
      suspended: 0,
    } as Record<StatusFilter, number>;
    for (const entry of applications) {
      const status = entry.application.status as ApplicationStatus;
      if (status in map) {
        map[status] += 1;
      }
      if (['submitted', 'under_review', 'revision_required'].includes(status)) {
        map.open += 1;
      }
    }
    return map;
  }, [applications]);

  const visible = useMemo(() => {
    return applications
      .filter((entry) => matchesStatusFilter(entry, statusFilter))
      .filter((entry) => (search.trim() ? matchesApplicationSearch(entry, search) : true));
  }, [applications, statusFilter, search]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="admin-toolbar">
        <div className="admin-toolbar__search">
          <input
            className="admin-input"
            type="search"
            placeholder="Search company, owner, email, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="admin-segment" role="tablist" aria-label="Pipeline filter">
          {PIPELINE_FILTERS.map((option) => {
            const count = counts[option.id] ?? 0;
            const active = statusFilter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className={`admin-segment__option${active ? ' admin-segment__option--active' : ''}`}
                onClick={() => setStatusFilter(option.id)}
              >
                <span>{option.label}</span>
                <span className="admin-segment__count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="admin-skeleton" style={{ height: 88 }} />
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="admin-state admin-state--error">
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Başvurular yüklenemedi.</div>
          <div>{error}</div>
        </div>
      ) : null}

      {!loading && !error && visible.length === 0 ? (
        <div className="admin-state">
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Eşleşen başvuru yok</div>
          <div>Filtreleri genişletmek için &ldquo;All&rdquo; sekmesine geçebilir veya arama metnini temizleyebilirsiniz.</div>
        </div>
      ) : null}

      {!loading && !error && visible.length > 0 ? (
        <div className="admin-card admin-card--flat" style={{ overflow: 'hidden' }}>
          <div className="admin-list">
            {visible.map((entry) => {
              const risk = calcRisk(entry);
              return (
                <Link
                  key={entry.application.id}
                  href={`/tenants/${entry.application.tenantAccountId}?tab=review`}
                  className="admin-list-row"
                  style={{ alignItems: 'stretch' }}
                >
                  <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="admin-list-row__title">{entry.tenantCompanyName}</span>
                      <span className={badgeClass(entry.application.status)}>{statusLabel(entry.application.status)}</span>
                      {risk.flags.map((flag) => (
                        <span key={flag} className="admin-badge admin-badge--warning admin-badge--dot">{flag}</span>
                      ))}
                    </div>
                    <div className="admin-list-row__meta">
                      {entry.ownerContactName ?? '—'} · {entry.tenantEmail} · {entry.businessCity ?? entry.businessType ?? '—'}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 4, minWidth: 140 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Docs</div>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                      {entry.documentSummary.approved}/{entry.documentSummary.totalCurrent} approved
                    </div>
                    <div className="admin-progress">
                      <div
                        className={
                          risk.ratio === 100
                            ? 'admin-progress__fill admin-progress__fill--success'
                            : risk.ratio === 0
                              ? 'admin-progress__fill admin-progress__fill--warning'
                              : 'admin-progress__fill'
                        }
                        style={{ width: `${risk.ratio}%` }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 4, minWidth: 140, textAlign: 'right' }}>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Submitted</div>
                    <div style={{ fontSize: 13, color: 'var(--text)' }}>{formatDateTime(entry.application.lastSubmittedAt)}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>rev {entry.application.currentRevisionNumber}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
