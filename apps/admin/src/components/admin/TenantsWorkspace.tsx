'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { activateTenant, listTenants, reopenTenantReview, suspendTenant } from '@/lib/admin-api/admin-review-client';
import { badgeClass, formatDateTime, matchesApplicationSearch, statusLabel } from '@/lib/admin-api/admin-review-ui';
import type { ApplicationListEntry, ApplicationStatus } from '@/lib/admin-api/admin-review-types';
import { requireAdminSession } from '@/lib/admin-api/require-admin-session';
import TenantApplicationModal from './TenantApplicationModal';

type StatusFilter = ApplicationStatus | 'all';

const FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'approved', label: 'Approved' },
  { id: 'under_review', label: 'In review' },
  { id: 'revision_required', label: 'Revision' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'rejected', label: 'Rejected' },
];

export default function TenantsWorkspace() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<ApplicationListEntry[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [suspendReasons, setSuspendReasons] = useState<Record<string, string>>({});
  const [actionTargetId, setActionTargetId] = useState<string | null>(null);
  const [modalEntry, setModalEntry] = useState<ApplicationListEntry | null>(null);

  const reload = async () => {
    const session = await requireAdminSession();
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    const response = await listTenants(session, params.toString());
    setTenants(response);
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Tenants could not be loaded.');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [statusFilter]);

  const visible = useMemo(() => {
    if (!search.trim()) return tenants;
    return tenants.filter((entry) => matchesApplicationSearch(entry, search));
  }, [tenants, search]);

  const runTenantAction = async (entry: ApplicationListEntry, action: 'activate' | 'suspend' | 'reopen_review') => {
    try {
      setSaving(true);
      setError(null);
      const session = await requireAdminSession();
      if (action === 'activate') {
        await activateTenant(session, entry.application.tenantAccountId);
      }
      if (action === 'suspend') {
        await suspendTenant(session, entry.application.tenantAccountId, suspendReasons[entry.application.tenantAccountId] || undefined);
      }
      if (action === 'reopen_review') {
        await reopenTenantReview(session, entry.application.tenantAccountId);
      }
      setActionTargetId(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tenant action failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="admin-toolbar">
        <div className="admin-toolbar__search">
          <input
            className="admin-input"
            type="search"
            placeholder="Search company, owner, email or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="admin-segment">
          {FILTERS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`admin-segment__option${statusFilter === opt.id ? ' admin-segment__option--active' : ''}`}
              onClick={() => setStatusFilter(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="admin-skeleton" style={{ height: 76 }} />
          ))}
        </div>
      ) : null}

      {error ? <div className="admin-state admin-state--error">{error}</div> : null}

      {!loading && !error && visible.length === 0 ? (
        <div className="admin-state">Bu kriterlere uyan tenant bulunamadı.</div>
      ) : null}

      {modalEntry ? (
        <TenantApplicationModal
          entry={modalEntry}
          onClose={() => setModalEntry(null)}
          onChanged={async () => {
            await reload();
          }}
        />
      ) : null}

      {!loading && !error && visible.length > 0 ? (
        <div className="admin-card admin-card--flat">
          <div className="admin-list">
            {visible.map((entry) => {
              const isOpen = actionTargetId === entry.application.tenantAccountId;
              const lifecycleAllowsActivate = ['approved', 'suspended'].includes(entry.application.status);
              const lifecycleAllowsSuspend = ['active'].includes(entry.application.status);
              const lifecycleAllowsReopen = ['approved', 'active', 'rejected'].includes(entry.application.status);
              return (
                <div key={entry.application.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="admin-list-row" style={{ borderTop: 0 }}>
                    <Link
                      href={`/tenants/${entry.application.tenantAccountId}?tab=review`}
                      style={{ minWidth: 0, flex: 1, display: 'block' }}
                    >
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="admin-list-row__title">{entry.tenantCompanyName}</span>
                        <span className={badgeClass(entry.application.status)}>{statusLabel(entry.application.status)}</span>
                      </div>
                      <div className="admin-list-row__meta">
                        {entry.ownerContactName ?? '—'} · {entry.tenantEmail} · {entry.businessCity ?? '—'}
                      </div>
                    </Link>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>
                        <div>Updated</div>
                        <div style={{ color: 'var(--text-2)', fontWeight: 500 }}>{formatDateTime(entry.application.updatedAt)}</div>
                      </div>
                      <button
                        type="button"
                        className="admin-button admin-button--primary admin-button--sm"
                        onClick={() => setModalEntry(entry)}
                      >
                        Manage
                      </button>
                      <button
                        type="button"
                        className="admin-button admin-button--sm"
                        onClick={() => setActionTargetId(isOpen ? null : entry.application.tenantAccountId)}
                      >
                        {isOpen ? 'Close' : 'Quick actions'}
                      </button>
                    </div>
                  </div>

                  {isOpen ? (
                    <div style={{ padding: '12px 18px 18px', background: 'var(--surface-muted)', display: 'grid', gap: 10 }}>
                      <div className="admin-kv-grid">
                        <div>
                          <div className="admin-kv__label">Owner phone</div>
                          <div className="admin-kv__value">{entry.ownerContactPhone ?? '—'}</div>
                        </div>
                        <div>
                          <div className="admin-kv__label">Business type</div>
                          <div className="admin-kv__value">{entry.businessType ?? '—'}</div>
                        </div>
                        <div>
                          <div className="admin-kv__label">Documents</div>
                          <div className="admin-kv__value">
                            {entry.documentSummary.approved}/{entry.documentSummary.totalCurrent} approved
                          </div>
                        </div>
                      </div>

                      {lifecycleAllowsSuspend ? (
                        <textarea
                          className="admin-textarea"
                          rows={2}
                          placeholder="Suspend reason (opsiyonel)"
                          value={suspendReasons[entry.application.tenantAccountId] ?? ''}
                          onChange={(e) => setSuspendReasons((c) => ({ ...c, [entry.application.tenantAccountId]: e.target.value }))}
                        />
                      ) : null}

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {lifecycleAllowsActivate ? (
                          <button
                            className="admin-button admin-button--primary admin-button--sm"
                            disabled={saving}
                            type="button"
                            onClick={() => void runTenantAction(entry, 'activate')}
                          >
                            Activate
                          </button>
                        ) : null}
                        {lifecycleAllowsReopen ? (
                          <button
                            className="admin-button admin-button--sm"
                            disabled={saving}
                            type="button"
                            onClick={() => void runTenantAction(entry, 'reopen_review')}
                          >
                            Reopen review
                          </button>
                        ) : null}
                        {lifecycleAllowsSuspend ? (
                          <button
                            className="admin-button admin-button--danger admin-button--sm"
                            disabled={saving}
                            type="button"
                            onClick={() => void runTenantAction(entry, 'suspend')}
                          >
                            Suspend
                          </button>
                        ) : null}
                        <span style={{ flex: 1 }} />
                        <Link
                          href={`/tenants/${entry.application.tenantAccountId}?tab=review`}
                          className="admin-button admin-button--sm admin-button--ghost"
                        >
                          Open review →
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
