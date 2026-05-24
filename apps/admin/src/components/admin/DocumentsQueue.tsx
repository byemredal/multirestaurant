'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  approveTenantDocument,
  listTenantDocuments,
  rejectTenantDocument,
  requestTenantDocumentRevision,
} from '@/lib/admin-api/admin-review-client';
import { badgeClass, formatDateTime, statusLabel } from '@/lib/admin-api/admin-review-ui';
import type { DocumentStatus, TenantDocumentQueueEntry } from '@/lib/admin-api/admin-review-types';
import { requireAdminSession } from '@/lib/admin-api/require-admin-session';

type Filter = DocumentStatus | 'all' | 'open';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'open', label: 'Open' },
  { id: 'pending', label: 'Pending' },
  { id: 'revision_requested', label: 'Revision' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

function matchesFilter(entry: TenantDocumentQueueEntry, filter: Filter) {
  if (filter === 'all') return true;
  if (filter === 'open') return ['pending', 'revision_requested'].includes(entry.document.status);
  return entry.document.status === filter;
}

export default function DocumentsQueue() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<TenantDocumentQueueEntry[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('open');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const reload = async () => {
    const session = await requireAdminSession();
    const response = await listTenantDocuments(session);
    setDocuments(response);
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Documents could not be loaded.');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  const counts = useMemo(() => {
    const map: Record<Filter, number> = {
      all: documents.length,
      open: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      revision_requested: 0,
      expired: 0,
    } as Record<Filter, number>;
    for (const e of documents) {
      const s = e.document.status as DocumentStatus;
      if (s in map) map[s] += 1;
      if (s === 'pending' || s === 'revision_requested') map.open += 1;
    }
    return map;
  }, [documents]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents
      .filter((entry) => matchesFilter(entry, filter))
      .filter((entry) => {
        if (!q) return true;
        const hay = [entry.tenantAccount?.companyName, entry.tenantAccount?.email, entry.document.type]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
  }, [documents, filter, search]);

  const runAction = async (documentId: string, action: 'approve' | 'reject' | 'request_revision') => {
    try {
      setSaving(true);
      setError(null);
      const session = await requireAdminSession();
      const note = notes[documentId] || undefined;
      if (action === 'approve') await approveTenantDocument(session, documentId, note);
      if (action === 'reject') await rejectTenantDocument(session, documentId, note);
      if (action === 'request_revision') await requestTenantDocumentRevision(session, documentId, note);
      setNotes((c) => ({ ...c, [documentId]: '' }));
      setOpenId(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Document action failed.');
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
            placeholder="Search company, email or document type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="admin-segment">
          {FILTERS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`admin-segment__option${filter === opt.id ? ' admin-segment__option--active' : ''}`}
              onClick={() => setFilter(opt.id)}
            >
              <span>{opt.label}</span>
              <span className="admin-segment__count">{counts[opt.id] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="admin-skeleton" style={{ height: 76 }} />
          ))}
        </div>
      ) : null}

      {error ? <div className="admin-state admin-state--error">{error}</div> : null}

      {!loading && !error && visible.length === 0 ? (
        <div className="admin-state">Bu filtre için belge bulunamadı.</div>
      ) : null}

      {!loading && !error && visible.length > 0 ? (
        <div className="admin-card admin-card--flat">
          <div className="admin-list">
            {visible.map((entry) => {
              const isOpen = openId === entry.document.id;
              return (
                <div key={entry.document.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : entry.document.id)}
                    className="admin-list-row"
                    style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', borderTop: 0 }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="admin-list-row__title" style={{ textTransform: 'capitalize' }}>
                          {entry.document.type.replaceAll('_', ' ')}
                        </span>
                        {entry.document.isRequired ? <span className="admin-badge">required</span> : null}
                        <span className={badgeClass(entry.document.status)}>{statusLabel(entry.document.status)}</span>
                      </div>
                      <div className="admin-list-row__meta">
                        {entry.tenantAccount?.companyName ?? '—'} · v{entry.document.version} · uploaded {formatDateTime(entry.document.uploadedAt)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                      {entry.fileUrl ? (
                        <a
                          href={entry.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="admin-button admin-button--sm admin-button--ghost"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open ↗
                        </a>
                      ) : null}
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{isOpen ? 'Close' : 'Review'}</span>
                    </div>
                  </button>

                  {isOpen ? (
                    <div style={{ padding: '12px 18px 18px', background: 'var(--surface-muted)', display: 'grid', gap: 10 }}>
                      <div className="admin-kv-grid">
                        <div>
                          <div className="admin-kv__label">Tenant</div>
                          <div className="admin-kv__value">
                            {entry.tenantAccount?.email ?? '—'} · {entry.tenantAccount?.phoneNumber ?? '—'}
                          </div>
                        </div>
                        <div>
                          <div className="admin-kv__label">Reviewer note</div>
                          <div className="admin-kv__value">{entry.document.rejectionReason ?? '—'}</div>
                        </div>
                        <div>
                          <div className="admin-kv__label">Reviewed</div>
                          <div className="admin-kv__value">{formatDateTime(entry.document.reviewedAt)}</div>
                        </div>
                      </div>

                      <textarea
                        className="admin-textarea"
                        rows={2}
                        placeholder="Review note (opsiyonel)"
                        value={notes[entry.document.id] ?? ''}
                        onChange={(e) => setNotes((c) => ({ ...c, [entry.document.id]: e.target.value }))}
                      />

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <button className="admin-button admin-button--primary admin-button--sm" disabled={saving} type="button" onClick={() => void runAction(entry.document.id, 'approve')}>
                          Approve
                        </button>
                        <button className="admin-button admin-button--sm" disabled={saving} type="button" onClick={() => void runAction(entry.document.id, 'request_revision')}>
                          Request revision
                        </button>
                        <button className="admin-button admin-button--danger admin-button--sm" disabled={saving} type="button" onClick={() => void runAction(entry.document.id, 'reject')}>
                          Reject
                        </button>
                        <span style={{ flex: 1 }} />
                        <Link
                          href={`/tenants/${entry.application?.tenantAccountId ?? entry.tenantAccount?.id ?? ''}?tab=documents`}
                          className="admin-button admin-button--sm admin-button--ghost"
                        >
                          Open tenant workspace →
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
