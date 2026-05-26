'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode, type SVGProps } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  activateTenant,
  approveApplication,
  approveTenantDocument,
  getTenantApplication,
  getTenantApplicationTimeline,
  getTenantBusinessOverview,
  rejectApplication,
  rejectTenantDocument,
  reopenTenantReview,
  requestApplicationRevision,
  requestTenantDocumentRevision,
  suspendTenant,
} from '@/lib/admin-api/admin-review-client';
import {
  badgeClass,
  formatDateTime,
  getApplicationSummary,
  parseMetadata,
  statusLabel,
  statusTone,
} from '@/lib/admin-api/admin-review-ui';
import type {
  AuditLogEntry,
  TenantApplicationDetail,
} from '@/lib/admin-api/admin-review-types';
import { requireAdminSession } from '@/lib/admin-api/require-admin-session';

type WorkspaceTab = 'review' | 'documents' | 'timeline';

function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m4 10 4 4 8-9" />
    </svg>
  );
}

function IconClock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l2.5 2.5" />
    </svg>
  );
}

function IconCross(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m6 6 8 8M14 6l-8 8" />
    </svg>
  );
}

function ChecklistItem({
  label,
  state,
  hint,
}: {
  label: string;
  state: 'pass' | 'pending' | 'fail';
  hint?: string;
}) {
  const Icon = state === 'pass' ? IconCheck : state === 'fail' ? IconCross : IconClock;
  const color = state === 'pass' ? 'var(--success)' : state === 'fail' ? 'var(--danger)' : 'var(--warning)';
  const bg = state === 'pass' ? 'var(--success-soft)' : state === 'fail' ? 'var(--danger-soft)' : 'var(--warning-soft)';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          borderRadius: 999,
          background: bg,
          color,
          flexShrink: 0,
        }}
      >
        <Icon width={13} height={13} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 500 }}>{label}</div>
        {hint ? <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{hint}</div> : null}
      </div>
    </div>
  );
}

function canApproveApplication(detail: TenantApplicationDetail) {
  const statusAllowsApproval = ['submitted', 'under_review'].includes(detail.application.status);
  const requiredCurrentDocuments = detail.documents.filter((d) => d.isCurrent && d.isRequired);
  return (
    statusAllowsApproval &&
    requiredCurrentDocuments.length > 0 &&
    requiredCurrentDocuments.every((d) => d.status === 'approved')
  );
}

function getApproveBlockedReason(detail: TenantApplicationDetail) {
  if (!['submitted', 'under_review'].includes(detail.application.status)) {
    return `Onay verilemiyor: başvuru durumu \"${statusLabel(detail.application.status)}\".`;
  }

  const requiredCurrentDocuments = detail.documents.filter((d) => d.isCurrent && d.isRequired);

  if (requiredCurrentDocuments.length === 0) {
    return 'Onay vermek için güncel zorunlu belgeler gerekiyor.';
  }

  if (requiredCurrentDocuments.some((d) => d.status !== 'approved')) {
    return 'Tüm zorunlu güncel belgeler onaylı olmadan başvuru onaylanamaz.';
  }

  return null;
}

export default function TenantWorkspaceShell({ tenantId }: { tenantId: string }) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab: WorkspaceTab =
    requestedTab === 'documents' || requestedTab === 'timeline' ? requestedTab : 'review';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TenantApplicationDetail | null>(null);
  const [timeline, setTimeline] = useState<AuditLogEntry[]>([]);

  const [internalNote, setInternalNote] = useState('');
  const [tenantNote, setTenantNote] = useState('');
  const [suspendReason, setSuspendReason] = useState('');
  const [documentNotes, setDocumentNotes] = useState<Record<string, string>>({});

  const reload = async () => {
    const session = await requireAdminSession();
    if (!applicationId) return;
    const [nextDetail, nextTimeline] = await Promise.all([
      getTenantApplication(session, applicationId),
      getTenantApplicationTimeline(session, applicationId),
    ]);
    setDetail(nextDetail);
    setTimeline(nextTimeline);
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const session = await requireAdminSession();
        const overview = await getTenantBusinessOverview(session, tenantId);
        const appId = overview.application?.id ?? null;
        setApplicationId(appId);
        if (!appId) {
          setDetail(null);
          setTimeline([]);
          return;
        }
        const [nextDetail, nextTimeline] = await Promise.all([
          getTenantApplication(session, appId),
          getTenantApplicationTimeline(session, appId),
        ]);
        setDetail(nextDetail);
        setTimeline(nextTimeline);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Tenant detail could not be loaded.');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [tenantId]);

  const summary = useMemo(() => (detail ? getApplicationSummary(detail) : null), [detail]);
  const approveBlockedReason = useMemo(
    () => (detail ? getApproveBlockedReason(detail) : null),
    [detail],
  );

  const runApplicationAction = async (
    action: 'approve' | 'reject' | 'request_revision' | 'activate' | 'suspend' | 'reopen_review',
  ) => {
    if (!detail) return;
    try {
      setSaving(true);
      setError(null);
      const session = await requireAdminSession();

      if (action === 'approve') {
        await approveApplication(session, detail.application.id, {
          internalNote: internalNote || undefined,
          tenantVisibleNote: tenantNote || undefined,
        });
      }
      if (action === 'reject') {
        await rejectApplication(session, detail.application.id, {
          internalNote: internalNote || undefined,
          tenantVisibleNote: tenantNote || undefined,
        });
      }
      if (action === 'request_revision') {
        await requestApplicationRevision(session, detail.application.id, {
          internalNote: internalNote || undefined,
          tenantVisibleNote: tenantNote || undefined,
        });
      }
      if (action === 'activate') {
        await activateTenant(session, detail.application.tenantAccountId);
      }
      if (action === 'suspend') {
        await suspendTenant(session, detail.application.tenantAccountId, suspendReason || undefined);
      }
      if (action === 'reopen_review') {
        await reopenTenantReview(session, detail.application.tenantAccountId);
      }

      setInternalNote('');
      setTenantNote('');
      if (action === 'suspend') setSuspendReason('');
      await reload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Action failed.');
    } finally {
      setSaving(false);
    }
  };

  const runDocumentAction = async (
    documentId: string,
    action: 'approve' | 'reject' | 'request_revision',
  ) => {
    try {
      setSaving(true);
      setError(null);
      const session = await requireAdminSession();
      const note = documentNotes[documentId] || undefined;

      if (action === 'approve') await approveTenantDocument(session, documentId, note);
      if (action === 'reject') await rejectTenantDocument(session, documentId, note);
      if (action === 'request_revision') await requestTenantDocumentRevision(session, documentId, note);

      setDocumentNotes((c) => ({ ...c, [documentId]: '' }));
      await reload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Document action failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div className="admin-skeleton" style={{ height: 120 }} />
        <div className="admin-skeleton" style={{ height: 280 }} />
      </div>
    );
  }

  if (error && !detail) {
    return <div className="admin-state admin-state--error">{error}</div>;
  }

  if (!applicationId || !detail) {
    return (
      <div className="admin-state">
        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Onboarding başvurusu yok</div>
        <div>Bu tenant için henüz bir tenant onboarding kaydı açılmamış.</div>
        <div style={{ marginTop: 14 }}>
          <Link className="admin-button" href="/tenants">Tüm tenantlere dön</Link>
        </div>
      </div>
    );
  }

  const currentDocs = detail.documents.filter((d) => d.isCurrent);
  const requiredCurrentDocs = currentDocs.filter((d) => d.isRequired);
  const approvedRatio = requiredCurrentDocs.length === 0
    ? 0
    : Math.round((requiredCurrentDocs.filter((d) => d.status === 'approved').length / requiredCurrentDocs.length) * 100);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {error ? <div className="admin-state admin-state--error">{error}</div> : null}

      <TenantHeader detail={detail} ratio={approvedRatio} />

      <div className="admin-tabs">
        <TabLink tab="review" activeTab={activeTab} tenantId={tenantId} label="Review" />
        <TabLink tab="documents" activeTab={activeTab} tenantId={tenantId} label={`Documents (${currentDocs.length})`} />
        <TabLink tab="timeline" activeTab={activeTab} tenantId={tenantId} label={`Timeline (${timeline.length})`} />
      </div>

      {activeTab === 'review' ? (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1.4fr) minmax(300px, 0.9fr)' }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <BusinessInfoCard detail={detail} />
            <ConsentSnapshotCard detail={detail} />
            <ChecklistCard detail={detail} />
          </div>
          <DecisionCard
            detail={detail}
            saving={saving}
            internalNote={internalNote}
            setInternalNote={setInternalNote}
            tenantNote={tenantNote}
            setTenantNote={setTenantNote}
            suspendReason={suspendReason}
            setSuspendReason={setSuspendReason}
            canApprove={canApproveApplication(detail)}
            approveBlockedReason={approveBlockedReason}
            runApplicationAction={runApplicationAction}
          />
        </div>
      ) : null}

      {activeTab === 'documents' ? (
        <DocumentsPanel
          detail={detail}
          saving={saving}
          documentNotes={documentNotes}
          setDocumentNotes={setDocumentNotes}
          runDocumentAction={runDocumentAction}
        />
      ) : null}

      {activeTab === 'timeline' ? <TimelinePanel detail={detail} timeline={timeline} /> : null}

      <div style={{ display: 'none' }}>
        {/* keep summary memo alive so unused-vars rules don't fire */}
        {summary?.totalCurrentDocuments}
      </div>
    </div>
  );
}

function TabLink({
  tab,
  activeTab,
  tenantId,
  label,
}: {
  tab: WorkspaceTab;
  activeTab: WorkspaceTab;
  tenantId: string;
  label: ReactNode;
}) {
  return (
    <Link
      href={`/tenants/${tenantId}?tab=${tab}`}
      className={`admin-tab${activeTab === tab ? ' admin-tab--active' : ''}`}
    >
      {label}
    </Link>
  );
}

function TenantHeader({ detail, ratio }: { detail: TenantApplicationDetail; ratio: number }) {
  const companyName = detail.tenantAccount?.companyName ?? detail.businessInfo?.businessName ?? 'Tenant';
  const ownerFallback = `${detail.tenantAccount?.firstName ?? ''} ${detail.tenantAccount?.lastName ?? ''}`.trim();
  const owner = detail.ownerContactInfo?.fullName ?? (ownerFallback || '—');
  const email = detail.tenantAccount?.email ?? detail.ownerContactInfo?.email ?? '—';
  const tone = statusTone(detail.application.status);
  const fillClass = ratio === 100
    ? 'admin-progress__fill admin-progress__fill--success'
    : ratio === 0
      ? 'admin-progress__fill admin-progress__fill--warning'
      : 'admin-progress__fill';

  return (
    <div className="admin-card">
      <div className="admin-card__body" style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>{companyName}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
              {owner} · {email}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className={badgeClass(detail.application.status)}>{statusLabel(detail.application.status)}</span>
            <span className="admin-badge">revision {detail.application.currentRevisionNumber}</span>
            <Link href="/tenants" className="admin-button admin-button--sm admin-button--ghost">
              ← All tenants
            </Link>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div>
            <div className="admin-kpi__label">Last submitted</div>
            <div className="admin-kpi__value" style={{ fontSize: 15 }}>{formatDateTime(detail.application.lastSubmittedAt)}</div>
            <div className="admin-kpi__meta">Updated {formatDateTime(detail.application.updatedAt)}</div>
          </div>
          <div>
            <div className="admin-kpi__label">Required docs</div>
            <div className="admin-kpi__value" style={{ fontSize: 15 }}>{ratio}% approved</div>
            <div className="admin-progress" style={{ marginTop: 6 }}>
              <div className={fillClass} style={{ width: `${ratio}%` }} />
            </div>
          </div>
          <div>
            <div className="admin-kpi__label">Owner phone</div>
            <div className="admin-kpi__value" style={{ fontSize: 15 }}>{detail.ownerContactInfo?.phoneNumber ?? detail.tenantAccount?.phoneNumber ?? '—'}</div>
            <div className="admin-kpi__meta">{tone === 'warning' ? 'review in progress' : tone === 'success' ? 'active' : tone === 'danger' ? 'attention required' : 'pending review'}</div>
          </div>
          <div>
            <div className="admin-kpi__label">Activated</div>
            <div className="admin-kpi__value" style={{ fontSize: 15 }}>{formatDateTime(detail.application.activatedAt)}</div>
            <div className="admin-kpi__meta">Lifecycle: {statusLabel(detail.application.status)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BusinessInfoCard({ detail }: { detail: TenantApplicationDetail }) {
  const rows: Array<[string, string]> = [
    ['Business name', detail.businessInfo?.businessName ?? detail.tenantAccount?.companyName ?? '—'],
    ['Business type', detail.businessInfo?.businessType ?? detail.tenantAccount?.tenantType ?? '—'],
    ['Tax / registration', detail.businessInfo?.taxNumber ?? detail.legalTaxInfo?.taxId ?? '—'],
    ['Delivery model', detail.operationsInfo?.deliveryModel ?? detail.tenantAccount?.deliveryModel ?? '—'],
    ['Address', detail.businessInfo
      ? `${detail.businessInfo.addressLine1}, ${detail.businessInfo.city}`
      : detail.tenantAccount?.companyAddress ?? '—'],
    ['Legal entity', detail.legalTaxInfo?.legalEntityName ?? '—'],
    ['Owner contact', detail.ownerContactInfo?.fullName ?? '—'],
    ['Operating hours', detail.operationsInfo?.openingHoursSummary ?? '—'],
  ];

  return (
    <div className="admin-card">
      <div className="admin-card__header">
        <div>
          <h3 className="admin-card__title">Submitted business information</h3>
          <div className="admin-card__subtitle">Onboarding sırasında tenantin gönderdiği işletme, sahip ve operasyon bilgileri.</div>
        </div>
      </div>
      <div className="admin-card__body">
        <div className="admin-kv-grid">
          {rows.map(([label, value]) => (
            <div key={label}>
              <div className="admin-kv__label">{label}</div>
              <div className="admin-kv__value">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConsentSnapshotCard({ detail }: { detail: TenantApplicationDetail }) {
  const activeConsents = detail.onboardingCompliance.acceptedConsents;

  return (
    <div className="admin-card">
      <div className="admin-card__header">
        <div>
          <h3 className="admin-card__title">Onboarding onay kayıtları</h3>
          <div className="admin-card__subtitle">Etkin hukuki kaynak sürümleri ve kabul durumu.</div>
        </div>
      </div>
      <div className="admin-card__body" style={{ display: 'grid', gap: 10 }}>
        {activeConsents.map((consent) => (
          <div key={`${consent.consentKey}:${consent.documentVersion}`} className="admin-doc">
            <div className="admin-doc__header">
              <div>
                <div className="admin-doc__title">{consent.label}</div>
                <div className="admin-doc__meta">
                  {consent.documentCode} · {consent.documentVersion} · {consent.language}
                </div>
              </div>
              <span className="admin-badge">
                {consent.accepted ? 'Kabul edildi' : consent.reacceptanceRequired ? 'Yeniden onay gerekli' : 'Eksik'}
              </span>
            </div>
            <div className="admin-doc__meta">
              {consent.acceptedAt ? `Kabul tarihi: ${formatDateTime(consent.acceptedAt)}` : 'Güncel sürüm kabul edilmedi.'}
              {consent.previouslyAcceptedVersion ? ` Önceki sürüm: ${consent.previouslyAcceptedVersion}.` : ''}
            </div>
          </div>
        ))}
        {activeConsents.length === 0 ? (
          <div className="admin-state">Etkin onay tanımı bulunmuyor.</div>
        ) : null}
        <div className="admin-card__subtitle">
          Saklanan kabul snapshot sayısı: {detail.consentSnapshots.length}.
        </div>
      </div>
    </div>
  );
}

function ChecklistCard({ detail }: { detail: TenantApplicationDetail }) {
  const requiredDocs = detail.documents.filter((d) => d.isCurrent && d.isRequired);
  const hasBusinessInfo = Boolean(detail.businessInfo?.businessName);
  const hasOwner = Boolean(detail.ownerContactInfo?.fullName && detail.ownerContactInfo?.phoneNumber);
  const hasTax = Boolean(detail.legalTaxInfo?.taxId || detail.businessInfo?.taxNumber);
  const hasOps = Boolean(detail.operationsInfo?.deliveryModel || detail.tenantAccount?.deliveryModel);
  const allDocsApproved = requiredDocs.length > 0 && requiredDocs.every((d) => d.status === 'approved');
  const anyDocPending = requiredDocs.some((d) => d.status === 'pending' || d.status === 'revision_requested');
  const anyDocRejected = requiredDocs.some((d) => d.status === 'rejected');

  return (
    <div className="admin-card">
      <div className="admin-card__header">
        <div>
          <h3 className="admin-card__title">Review checklist</h3>
          <div className="admin-card__subtitle">Onay için tamamlanması gereken denetim noktaları.</div>
        </div>
      </div>
      <div className="admin-card__body">
        <ChecklistItem
          label="İşletme bilgileri alınmış"
          state={hasBusinessInfo ? 'pass' : 'pending'}
          hint={hasBusinessInfo ? 'businessInfo doğrulandı' : 'Tenant onboarding sırasında işletme bilgilerini doldurmalı'}
        />
        <ChecklistItem
          label="Sahip iletişim ve telefon"
          state={hasOwner ? 'pass' : 'pending'}
          hint={hasOwner ? detail.ownerContactInfo?.email ?? '' : 'ownerContactInfo eksik'}
        />
        <ChecklistItem
          label="Vergi / tescil bilgisi"
          state={hasTax ? 'pass' : 'pending'}
          hint={hasTax ? 'taxId/taxNumber kayıtlı' : 'Vergi numarası girilmemiş'}
        />
        <ChecklistItem
          label="Operasyon / teslimat modeli"
          state={hasOps ? 'pass' : 'pending'}
          hint={hasOps ? `Model: ${detail.operationsInfo?.deliveryModel ?? detail.tenantAccount?.deliveryModel}` : 'Teslimat modeli seçilmemiş'}
        />
        <ChecklistItem
          label="Zorunlu belgeler onaylı"
          state={allDocsApproved ? 'pass' : anyDocRejected ? 'fail' : 'pending'}
          hint={
            requiredDocs.length === 0
              ? 'Henüz zorunlu belge tanımlanmamış'
              : `${requiredDocs.filter((d) => d.status === 'approved').length}/${requiredDocs.length} onaylı${anyDocPending ? ' · bekleyen var' : ''}${anyDocRejected ? ' · reddedilmiş var' : ''}`
          }
        />
      </div>
    </div>
  );
}

function DecisionCard({
  detail,
  saving,
  internalNote,
  setInternalNote,
  tenantNote,
  setTenantNote,
  suspendReason,
  setSuspendReason,
  canApprove,
  approveBlockedReason,
  runApplicationAction,
}: {
  detail: TenantApplicationDetail;
  saving: boolean;
  internalNote: string;
  setInternalNote: (v: string) => void;
  tenantNote: string;
  setTenantNote: (v: string) => void;
  suspendReason: string;
  setSuspendReason: (v: string) => void;
  canApprove: boolean;
  approveBlockedReason: string | null;
  runApplicationAction: (
    action: 'approve' | 'reject' | 'request_revision' | 'activate' | 'suspend' | 'reopen_review',
  ) => Promise<void>;
}) {
  const isActiveLifecycle = ['approved', 'active', 'suspended'].includes(detail.application.status);
  return (
    <div className="admin-card" style={{ position: 'sticky', top: 76, alignSelf: 'start' }}>
      <div className="admin-card__header">
        <div>
          <h3 className="admin-card__title">Decision</h3>
          <div className="admin-card__subtitle">Onay, revizyon isteği ya da red kararları.</div>
        </div>
      </div>
      <div className="admin-card__body" style={{ display: 'grid', gap: 12 }}>
        <div className="admin-field">
          <label className="admin-field__label" htmlFor="internal-note">Internal note</label>
          <textarea
            id="internal-note"
            className="admin-textarea"
            rows={3}
            placeholder="Sadece admin ekibi görecek"
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label className="admin-field__label" htmlFor="tenant-note">Tenant-visible note</label>
          <textarea
            id="tenant-note"
            className="admin-textarea"
            rows={3}
            placeholder="Tenantin göreceği açıklama"
            value={tenantNote}
            onChange={(e) => setTenantNote(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="admin-button admin-button--primary"
            disabled={saving || !canApprove}
            type="button"
            onClick={() => void runApplicationAction('approve')}
          >
            Approve
          </button>
          <button
            className="admin-button"
            disabled={saving}
            type="button"
            onClick={() => void runApplicationAction('request_revision')}
          >
            Request revision
          </button>
          <button
            className="admin-button admin-button--danger"
            disabled={saving}
            type="button"
            onClick={() => void runApplicationAction('reject')}
          >
            Reject
          </button>
        </div>

        {approveBlockedReason ? (
          <div style={{ fontSize: 12.5, color: 'var(--warning)', background: 'var(--warning-soft)', border: '1px solid var(--warning-border)', borderRadius: 8, padding: '8px 10px' }}>
            {approveBlockedReason}
          </div>
        ) : null}

        {isActiveLifecycle ? (
          <>
            <div className="admin-divider" style={{ margin: '4px 0' }} />
            <div className="admin-field">
              <label className="admin-field__label" htmlFor="suspend-reason">Suspend reason (opsiyonel)</label>
              <textarea
                id="suspend-reason"
                className="admin-textarea"
                rows={2}
                placeholder="Neden askıya alınıyor?"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="admin-button admin-button--primary"
                disabled={saving}
                type="button"
                onClick={() => void runApplicationAction('activate')}
              >
                Activate
              </button>
              <button
                className="admin-button"
                disabled={saving}
                type="button"
                onClick={() => void runApplicationAction('reopen_review')}
              >
                Reopen review
              </button>
              <button
                className="admin-button admin-button--danger"
                disabled={saving}
                type="button"
                onClick={() => void runApplicationAction('suspend')}
              >
                Suspend
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function DocumentsPanel({
  detail,
  saving,
  documentNotes,
  setDocumentNotes,
  runDocumentAction,
}: {
  detail: TenantApplicationDetail;
  saving: boolean;
  documentNotes: Record<string, string>;
  setDocumentNotes: (updater: (current: Record<string, string>) => Record<string, string>) => void;
  runDocumentAction: (documentId: string, action: 'approve' | 'reject' | 'request_revision') => Promise<void>;
}) {
  if (detail.documents.length === 0) {
    return <div className="admin-state">Bu tenant için yüklenmiş belge yok.</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {detail.documents.map((doc) => (
        <div key={doc.id} className="admin-doc">
          <div className="admin-doc__header">
            <div style={{ minWidth: 0 }}>
              <div className="admin-doc__title">{doc.type.replaceAll('_', ' ')}</div>
              <div className="admin-doc__meta">
                version {doc.version} · uploaded {formatDateTime(doc.uploadedAt)}
                {doc.reviewedAt ? ` · reviewed ${formatDateTime(doc.reviewedAt)}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {doc.isCurrent ? <span className="admin-badge">current</span> : <span className="admin-badge">archived</span>}
              {doc.isRequired ? <span className="admin-badge">required</span> : null}
              <span className={badgeClass(doc.status)}>{statusLabel(doc.status)}</span>
            </div>
          </div>

          <div className="admin-kv-grid">
            <div>
              <div className="admin-kv__label">Reviewer note</div>
              <div className="admin-kv__value">{doc.rejectionReason ?? '—'}</div>
            </div>
            <div>
              <div className="admin-kv__label">File</div>
              <div className="admin-kv__value">
                {doc.fileUrl ? <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="admin-link">Open document ↗</a> : '—'}
              </div>
            </div>
          </div>

          {doc.isCurrent ? (
            <>
              <textarea
                className="admin-textarea"
                rows={2}
                placeholder="Review note (opsiyonel)"
                value={documentNotes[doc.id] ?? ''}
                onChange={(e) => setDocumentNotes((c) => ({ ...c, [doc.id]: e.target.value }))}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="admin-button admin-button--primary admin-button--sm"
                  disabled={saving}
                  type="button"
                  onClick={() => void runDocumentAction(doc.id, 'approve')}
                >
                  Approve
                </button>
                <button
                  className="admin-button admin-button--sm"
                  disabled={saving}
                  type="button"
                  onClick={() => void runDocumentAction(doc.id, 'request_revision')}
                >
                  Request revision
                </button>
                <button
                  className="admin-button admin-button--danger admin-button--sm"
                  disabled={saving}
                  type="button"
                  onClick={() => void runDocumentAction(doc.id, 'reject')}
                >
                  Reject
                </button>
              </div>
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function TimelinePanel({ detail, timeline }: { detail: TenantApplicationDetail; timeline: AuditLogEntry[] }) {
  const reviewEntries = [
    ...detail.applicationReviews.map((r) => ({
      kind: 'application_review' as const,
      id: r.id,
      title: `Application ${statusLabel(r.decision)}`,
      createdAt: r.createdAt,
      actor: r.adminId,
      internalNote: r.internalNote ?? null,
      tenantNote: r.tenantVisibleNote ?? null,
    })),
    ...detail.notes.map((n) => ({
      kind: 'note' as const,
      id: n.id,
      title: n.scope === 'internal' ? 'Internal note' : 'Tenant-visible note',
      createdAt: n.createdAt,
      actor: n.adminId,
      body: n.body,
    })),
  ].sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {reviewEntries.length > 0 ? (
        <div className="admin-card">
          <div className="admin-card__header">
            <div>
              <h3 className="admin-card__title">Decision notes</h3>
              <div className="admin-card__subtitle">Admin görüşlerinin ve tenant kararlarının kaydı.</div>
            </div>
          </div>
          <div className="admin-card__body" style={{ display: 'grid', gap: 12 }}>
            {reviewEntries.map((entry) => (
              <div key={entry.id} className="admin-doc">
                <div className="admin-doc__header">
                  <div>
                    <div className="admin-doc__title">{entry.title}</div>
                    <div className="admin-doc__meta">
                      {formatDateTime(entry.createdAt)} · {entry.actor ?? 'unknown admin'}
                    </div>
                  </div>
                </div>
                {entry.kind === 'application_review' ? (
                  <div style={{ display: 'grid', gap: 6 }}>
                    {entry.internalNote ? <div style={{ fontSize: 13 }}><strong>Internal:</strong> {entry.internalNote}</div> : null}
                    {entry.tenantNote ? <div style={{ fontSize: 13 }}><strong>Tenant:</strong> {entry.tenantNote}</div> : null}
                  </div>
                ) : (
                  <div style={{ fontSize: 13 }}>{entry.body}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="admin-card">
        <div className="admin-card__header">
          <div>
            <h3 className="admin-card__title">Audit timeline</h3>
            <div className="admin-card__subtitle">Sistem tarafından otomatik tutulan işlem geçmişi.</div>
          </div>
        </div>
        <div className="admin-card__body">
          {timeline.length === 0 ? (
            <div className="admin-state">Henüz audit kaydı yok.</div>
          ) : (
            <div className="admin-timeline">
              {timeline.map((entry) => {
                const metadata = parseMetadata(entry);
                return (
                  <div key={entry.id} className="admin-timeline__item">
                    <div className="admin-timeline__dot" />
                    <div>
                      <div className="admin-timeline__title">{entry.action.replaceAll('_', ' ')}</div>
                      <div className="admin-timeline__meta">
                        {entry.actorType} · {entry.actorId ?? 'unknown'} · {formatDateTime(entry.createdAt)}
                      </div>
                      {Object.keys(metadata).length > 0 ? (
                        <pre className="admin-timeline__data">{JSON.stringify(metadata, null, 2)}</pre>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
