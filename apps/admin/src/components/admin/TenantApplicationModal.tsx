'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
  resendPasswordSetupLink,
  suspendTenant,
} from '@/lib/admin-api/admin-review-client';
import {
  badgeClass,
  formatDateTime,
  parseMetadata,
  statusLabel,
} from '@/lib/admin-api/admin-review-ui';
import type {
  ApplicationListEntry,
  AuditLogEntry,
  TenantApplicationDetail,
} from '@/lib/admin-api/admin-review-types';
import { requireAdminSession } from '@/lib/admin-api/require-admin-session';

type ModalTab = 'review' | 'documents' | 'timeline';

type Props = {
  entry: ApplicationListEntry;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
};

function canApprove(detail: TenantApplicationDetail) {
  const statusAllowsApproval = ['submitted', 'under_review'].includes(detail.application.status);
  const requiredCurrentDocuments = detail.documents.filter((d) => d.isCurrent && d.isRequired);
  return (
    statusAllowsApproval &&
    requiredCurrentDocuments.length > 0 &&
    requiredCurrentDocuments.every((d) => d.status === 'approved')
  );
}

function approveBlockedReason(detail: TenantApplicationDetail) {
  if (!['submitted', 'under_review'].includes(detail.application.status)) {
    return `Onay verilemiyor: başvuru durumu "${statusLabel(detail.application.status)}".`;
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

export default function TenantApplicationModal({ entry, onClose, onChanged }: Props) {
  const tenantId = entry.application.tenantAccountId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ModalTab>('review');

  const [applicationId, setApplicationId] = useState<string | null>(entry.application.id ?? null);
  const [detail, setDetail] = useState<TenantApplicationDetail | null>(null);
  const [timeline, setTimeline] = useState<AuditLogEntry[]>([]);

  const [internalNote, setInternalNote] = useState('');
  const [tenantNote, setTenantNote] = useState('');
  const [suspendReason, setSuspendReason] = useState('');
  const [documentNotes, setDocumentNotes] = useState<Record<string, string>>({});
  const [approveNotice, setApproveNotice] = useState<{
    deliveryStatus: 'queued' | 'sent' | 'failed' | 'unavailable';
    deliveryErrorCode: string | null;
    sentToEmail: string | null;
    tokenIssued: boolean;
    debugLink?: string | null;
  } | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const session = await requireAdminSession();
        const overview = await getTenantBusinessOverview(session, tenantId);
        const appId = overview.application?.id ?? entry.application.id ?? null;
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
        setError(nextError instanceof Error ? nextError.message : 'Tenant detayları yüklenemedi.');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [tenantId, entry.application.id]);

  const reload = async () => {
    if (!applicationId) return;
    const session = await requireAdminSession();
    const [nextDetail, nextTimeline] = await Promise.all([
      getTenantApplication(session, applicationId),
      getTenantApplicationTimeline(session, applicationId),
    ]);
    setDetail(nextDetail);
    setTimeline(nextTimeline);
  };

  const runResendPasswordSetup = async () => {
    if (!detail) return;
    try {
      setSaving(true);
      setError(null);
      const session = await requireAdminSession();
      const result = await resendPasswordSetupLink(session, detail.application.id);
      if (result.passwordSetup) {
        setApproveNotice(result.passwordSetup);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Şifre bağlantısı yeniden gönderilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const runApplicationAction = async (
    action: 'approve' | 'reject' | 'request_revision' | 'activate' | 'suspend' | 'reopen_review',
  ) => {
    if (!detail) return;
    try {
      setSaving(true);
      setError(null);
      const session = await requireAdminSession();

      if (action === 'approve') {
        const result = await approveApplication(session, detail.application.id, {
          internalNote: internalNote || undefined,
          tenantVisibleNote: tenantNote || undefined,
        });
        // Surface the post-approval password setup delivery result so the
        // admin knows whether the partner actually received the magic link
        // (and never assumes success when the e-mail transport is a stub).
        if (result.passwordSetup) {
          setApproveNotice(result.passwordSetup);
        }
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
      await onChanged();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'İşlem başarısız.');
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
      await onChanged();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Belge işlemi başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const requiredCurrentDocs = useMemo(
    () => (detail ? detail.documents.filter((d) => d.isCurrent && d.isRequired) : []),
    [detail],
  );
  const currentDocs = useMemo(
    () => (detail ? detail.documents.filter((d) => d.isCurrent) : []),
    [detail],
  );
  const approvedRatio = useMemo(() => {
    if (requiredCurrentDocs.length === 0) return 0;
    return Math.round(
      (requiredCurrentDocs.filter((d) => d.status === 'approved').length / requiredCurrentDocs.length) * 100,
    );
  }, [requiredCurrentDocs]);

  const blockedReason = detail ? approveBlockedReason(detail) : null;
  const canApproveApplication = detail ? canApprove(detail) : false;
  const isActiveLifecycle = detail
    ? ['approved', 'active', 'suspended'].includes(detail.application.status)
    : false;

  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <header className="admin-modal__header">
          <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div className="admin-modal__title">{entry.tenantCompanyName}</div>
              <div className="admin-modal__subtitle">
                {entry.ownerContactName ?? '—'} · {entry.tenantEmail} · {entry.businessCity ?? '—'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className={badgeClass(entry.application.status)}>
                {statusLabel(entry.application.status)}
              </span>
              {detail ? (
                <span className="admin-badge">revision {detail.application.currentRevisionNumber}</span>
              ) : null}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {applicationId ? (
              <Link
                href={`/tenants/${tenantId}?tab=review`}
                className="admin-button admin-button--sm admin-button--ghost"
                onClick={onClose}
              >
                Tam ekran ↗
              </Link>
            ) : null}
            <button
              type="button"
              aria-label="Kapat"
              className="admin-modal__close"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </header>

        <div className="admin-modal__tabs admin-tabs">
          <TabButton active={tab === 'review'} onClick={() => setTab('review')} label="Review" />
          <TabButton
            active={tab === 'documents'}
            onClick={() => setTab('documents')}
            label={`Documents (${currentDocs.length})`}
          />
          <TabButton
            active={tab === 'timeline'}
            onClick={() => setTab('timeline')}
            label={`Timeline (${timeline.length})`}
          />
        </div>

        <div className="admin-modal__body">
          {error ? <div className="admin-state admin-state--error" style={{ marginBottom: 14 }}>{error}</div> : null}

          {approveNotice ? (
            <div
              role="status"
              className="admin-state"
              style={{
                marginBottom: 14,
                borderLeft: '3px solid var(--accent)',
                background:
                  approveNotice.deliveryStatus === 'sent' || approveNotice.deliveryStatus === 'queued'
                    ? 'var(--success-soft, #ecfdf3)'
                    : 'var(--warning-soft, #fff7ed)',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                {approveNotice.deliveryStatus === 'sent'
                  ? 'Şifre belirleme bağlantısı gönderildi'
                  : approveNotice.deliveryStatus === 'queued'
                  ? 'Şifre belirleme bağlantısı sıraya alındı'
                  : approveNotice.deliveryStatus === 'unavailable'
                  ? 'Şifre belirleme bağlantısı üretildi ama e-posta sağlayıcısı yapılandırılmadı'
                  : 'Şifre belirleme bağlantısı gönderilemedi'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                {approveNotice.sentToEmail ? (
                  <>
                    Alıcı: <strong>{approveNotice.sentToEmail}</strong>
                    <br />
                  </>
                ) : null}
                {approveNotice.deliveryStatus === 'unavailable' ? (
                  <span>
                    Operatör EMAIL_TRANSPORT ortam değişkenini gerçek bir sağlayıcıya
                    bağlayana kadar partnerin e-postası gönderilmedi. Bağlantı yine
                    de DB&apos;de aktif; doğrudan partnerle paylaşabilirsiniz.
                  </span>
                ) : null}
                {approveNotice.deliveryStatus === 'failed' && approveNotice.deliveryErrorCode ? (
                  <span>Hata kodu: <code>{approveNotice.deliveryErrorCode}</code></span>
                ) : null}
                {approveNotice.debugLink ? (
                  <>
                    <br />
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      (development) Bağlantı:{' '}
                      <a href={approveNotice.debugLink} target="_blank" rel="noreferrer">
                        {approveNotice.debugLink}
                      </a>
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          {loading ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <div className="admin-skeleton" style={{ height: 120 }} />
              <div className="admin-skeleton" style={{ height: 240 }} />
            </div>
          ) : !detail ? (
            <div className="admin-state">
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Onboarding başvurusu yok</div>
              <div>Bu tenant için henüz bir tenant onboarding kaydı açılmamış.</div>
            </div>
          ) : tab === 'review' ? (
            <div style={{ display: 'grid', gap: 16 }}>
              <SummaryStrip
                detail={detail}
                ratio={approvedRatio}
                requiredCount={requiredCurrentDocs.length}
                requiredApproved={requiredCurrentDocs.filter((d) => d.status === 'approved').length}
              />
              <BusinessInfoSection detail={detail} />
              <ConsentSnapshotsSection detail={detail} />
              <DecisionSection
                detail={detail}
                saving={saving}
                canApproveApplication={canApproveApplication}
                blockedReason={blockedReason}
                isActiveLifecycle={isActiveLifecycle}
                internalNote={internalNote}
                setInternalNote={setInternalNote}
                tenantNote={tenantNote}
                setTenantNote={setTenantNote}
                suspendReason={suspendReason}
                setSuspendReason={setSuspendReason}
                runApplicationAction={runApplicationAction}
                runResendPasswordSetup={runResendPasswordSetup}
              />
            </div>
          ) : tab === 'documents' ? (
            <DocumentsSection
              detail={detail}
              saving={saving}
              documentNotes={documentNotes}
              setDocumentNotes={setDocumentNotes}
              runDocumentAction={runDocumentAction}
            />
          ) : (
            <TimelineSection detail={detail} timeline={timeline} />
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: ReactNode }) {
  return (
    <button
      type="button"
      className={`admin-tab${active ? ' admin-tab--active' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function SummaryStrip({
  detail,
  ratio,
  requiredCount,
  requiredApproved,
}: {
  detail: TenantApplicationDetail;
  ratio: number;
  requiredCount: number;
  requiredApproved: number;
}) {
  const ownerFallback = `${detail.tenantAccount?.firstName ?? ''} ${detail.tenantAccount?.lastName ?? ''}`.trim();
  const owner = detail.ownerContactInfo?.fullName ?? (ownerFallback || '—');
  const phone = detail.ownerContactInfo?.phoneNumber ?? detail.tenantAccount?.phoneNumber ?? '—';
  const fillClass =
    ratio === 100
      ? 'admin-progress__fill admin-progress__fill--success'
      : ratio === 0
        ? 'admin-progress__fill admin-progress__fill--warning'
        : 'admin-progress__fill';

  return (
    <div className="admin-card" style={{ boxShadow: 'none' }}>
      <div className="admin-card__body" style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <div>
          <div className="admin-kpi__label">Sahip</div>
          <div className="admin-kpi__value" style={{ fontSize: 15 }}>{owner}</div>
          <div className="admin-kpi__meta">{phone}</div>
        </div>
        <div>
          <div className="admin-kpi__label">Son gönderim</div>
          <div className="admin-kpi__value" style={{ fontSize: 15 }}>
            {formatDateTime(detail.application.lastSubmittedAt)}
          </div>
          <div className="admin-kpi__meta">Güncelleme {formatDateTime(detail.application.updatedAt)}</div>
        </div>
        <div>
          <div className="admin-kpi__label">Zorunlu belgeler</div>
          <div className="admin-kpi__value" style={{ fontSize: 15 }}>
            {requiredApproved}/{requiredCount} onaylı · {ratio}%
          </div>
          <div className="admin-progress" style={{ marginTop: 6 }}>
            <div className={fillClass} style={{ width: `${ratio}%` }} />
          </div>
        </div>
        <div>
          <div className="admin-kpi__label">Aktivasyon</div>
          <div className="admin-kpi__value" style={{ fontSize: 15 }}>
            {formatDateTime(detail.application.activatedAt)}
          </div>
          <div className="admin-kpi__meta">Lifecycle: {statusLabel(detail.application.status)}</div>
        </div>
      </div>
    </div>
  );
}

function BusinessInfoSection({ detail }: { detail: TenantApplicationDetail }) {
  const business: Array<[string, string]> = [
    ['İşletme adı', detail.businessInfo?.businessName ?? detail.tenantAccount?.companyName ?? '—'],
    ['İşletme tipi', detail.businessInfo?.businessType ?? detail.tenantAccount?.tenantType ?? '—'],
    ['Vergi / kayıt', detail.businessInfo?.taxNumber ?? detail.legalTaxInfo?.taxId ?? '—'],
    ['Adres', detail.businessInfo
      ? [detail.businessInfo.addressLine1, detail.businessInfo.addressLine2, detail.businessInfo.city, detail.businessInfo.postalCode, detail.businessInfo.country]
          .filter(Boolean)
          .join(', ')
      : detail.tenantAccount?.companyAddress ?? '—'],
  ];

  const legal: Array<[string, string]> = [
    ['Legal entity', detail.legalTaxInfo?.legalEntityName ?? '—'],
    ['Tax ID', detail.legalTaxInfo?.taxId ?? '—'],
    ['VAT ID', detail.legalTaxInfo?.vatId ?? '—'],
    ['Kayıt ülkesi', detail.legalTaxInfo?.registrationCountry ?? '—'],
    ['Kayıtlı adres', detail.legalTaxInfo?.registeredAddress ?? '—'],
  ];

  const owner: Array<[string, string]> = [
    ['Sahip', detail.ownerContactInfo?.fullName ?? '—'],
    ['E-posta', detail.ownerContactInfo?.email ?? detail.tenantAccount?.email ?? '—'],
    ['Telefon', detail.ownerContactInfo?.phoneNumber ?? detail.tenantAccount?.phoneNumber ?? '—'],
    ['Rol', detail.ownerContactInfo?.roleTitle ?? '—'],
    [
      'Pay (%)',
      detail.ownerContactInfo?.ownershipPercentage != null
        ? String(detail.ownerContactInfo.ownershipPercentage)
        : '—',
    ],
  ];

  const ops: Array<[string, string]> = [
    ['Ana şehir', detail.operationsInfo?.primaryCity ?? '—'],
    ['Posta kodu', detail.operationsInfo?.primaryPostalCode ?? '—'],
    ['Teslimat modeli', detail.operationsInfo?.deliveryModel ?? detail.tenantAccount?.deliveryModel ?? '—'],
    [
      'Pickup',
      detail.operationsInfo?.supportsPickup == null
        ? '—'
        : detail.operationsInfo.supportsPickup
          ? 'Evet'
          : 'Hayır',
    ],
    ['Çalışma saatleri', detail.operationsInfo?.openingHoursSummary ?? '—'],
    [
      'Tahmini go-live',
      detail.operationsInfo?.estimatedGoLiveDate
        ? formatDateTime(detail.operationsInfo.estimatedGoLiveDate)
        : '—',
    ],
  ];

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <InfoBlock title="İşletme bilgileri" rows={business} />
      <InfoBlock title="Sahip / iletişim" rows={owner} />
      <InfoBlock title="Operasyon" rows={ops} />
      <InfoBlock title="Vergi / hukuki" rows={legal} />
    </div>
  );
}

function ConsentSnapshotsSection({ detail }: { detail: TenantApplicationDetail }) {
  const activeConsents = detail.onboardingCompliance.acceptedConsents;

  return (
    <div className="admin-card">
      <div className="admin-card__header">
        <div>
          <h3 className="admin-card__title">Onboarding onay kayıtları</h3>
          <div className="admin-card__subtitle">
            Etkin onay sürümleri ve başvuruda saklanan kabul snapshot kayıtları.
          </div>
        </div>
      </div>
      <div className="admin-card__body" style={{ display: 'grid', gap: 10 }}>
        {activeConsents.map((consent) => (
          <div key={`${consent.consentKey}:${consent.documentVersion}`} className="admin-doc">
            <div className="admin-doc__header">
              <div>
                <div className="admin-doc__title">{consent.label}</div>
                <div className="admin-doc__meta">
                  {consent.consentKey} · {consent.documentCode} · {consent.documentVersion} · {consent.language}
                </div>
              </div>
              <span className={`admin-badge${consent.accepted ? ' admin-badge--success' : ''}`}>
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
          <div className="admin-state">Bu ülke ve dil için etkin onay tanımı bulunmuyor.</div>
        ) : null}
        {detail.consentSnapshots.length > 0 ? (
          <div className="admin-card__subtitle">
            Geçmiş kabul snapshot sayısı: {detail.consentSnapshots.length}. Eski sürümler denetim izi olarak korunur.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InfoBlock({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div className="admin-card">
      <div className="admin-card__header">
        <h3 className="admin-card__title">{title}</h3>
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

function DecisionSection({
  detail,
  saving,
  canApproveApplication,
  blockedReason,
  isActiveLifecycle,
  internalNote,
  setInternalNote,
  tenantNote,
  setTenantNote,
  suspendReason,
  setSuspendReason,
  runApplicationAction,
  runResendPasswordSetup,
}: {
  detail: TenantApplicationDetail;
  saving: boolean;
  canApproveApplication: boolean;
  blockedReason: string | null;
  isActiveLifecycle: boolean;
  internalNote: string;
  setInternalNote: (v: string) => void;
  tenantNote: string;
  setTenantNote: (v: string) => void;
  suspendReason: string;
  setSuspendReason: (v: string) => void;
  runApplicationAction: (
    action: 'approve' | 'reject' | 'request_revision' | 'activate' | 'suspend' | 'reopen_review',
  ) => Promise<void>;
  runResendPasswordSetup: () => Promise<void>;
}) {
  const canResendPasswordSetup = ['approved', 'active'].includes(detail.application.status);
  return (
    <div className="admin-card">
      <div className="admin-card__header">
        <div>
          <h3 className="admin-card__title">Karar</h3>
          <div className="admin-card__subtitle">Onay, revizyon isteği ya da red kararını kaydedin.</div>
        </div>
      </div>
      <div className="admin-card__body" style={{ display: 'grid', gap: 12 }}>
        <div className="admin-field">
          <label className="admin-field__label" htmlFor="modal-internal-note">Internal note</label>
          <textarea
            id="modal-internal-note"
            className="admin-textarea"
            rows={3}
            placeholder="Sadece admin ekibi görür"
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label className="admin-field__label" htmlFor="modal-tenant-note">Tenant-visible note</label>
          <textarea
            id="modal-tenant-note"
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
            disabled={saving || !canApproveApplication}
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

        {blockedReason ? (
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--warning)',
              background: 'var(--warning-soft)',
              border: '1px solid var(--warning-border)',
              borderRadius: 8,
              padding: '8px 10px',
            }}
          >
            {blockedReason}
          </div>
        ) : null}

        {canResendPasswordSetup ? (
          <>
            <div className="admin-divider" style={{ margin: '4px 0' }} />
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                Şifre belirleme bağlantısı partnere ulaşmadıysa yeniden gönderebilirsiniz.
                Yeni bağlantı 24 saat geçerli olur ve önceki bağlantıyı geçersiz kılar.
              </div>
              <div>
                <button
                  className="admin-button admin-button--sm"
                  disabled={saving}
                  type="button"
                  onClick={() => void runResendPasswordSetup()}
                >
                  Şifre bağlantısını yeniden gönder
                </button>
              </div>
            </div>
          </>
        ) : null}

        {isActiveLifecycle ? (
          <>
            <div className="admin-divider" style={{ margin: '4px 0' }} />
            <div className="admin-field">
              <label className="admin-field__label" htmlFor="modal-suspend-reason">Suspend reason (opsiyonel)</label>
              <textarea
                id="modal-suspend-reason"
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
                disabled={saving || detail.application.status === 'active'}
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
                disabled={saving || detail.application.status !== 'active'}
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

function DocumentsSection({
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
              {doc.isCurrent ? (
                <span className="admin-badge">current</span>
              ) : (
                <span className="admin-badge">archived</span>
              )}
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
              <div className="admin-kv__label">Dosya</div>
              <div className="admin-kv__value">
                {doc.fileUrl ? (
                  <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="admin-link">
                    Belgeyi aç ↗
                  </a>
                ) : (
                  '—'
                )}
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

function TimelineSection({
  detail,
  timeline,
}: {
  detail: TenantApplicationDetail;
  timeline: AuditLogEntry[];
}) {
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
              <h3 className="admin-card__title">Karar notları</h3>
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
                    {entry.internalNote ? (
                      <div style={{ fontSize: 13 }}>
                        <strong>Internal:</strong> {entry.internalNote}
                      </div>
                    ) : null}
                    {entry.tenantNote ? (
                      <div style={{ fontSize: 13 }}>
                        <strong>Tenant:</strong> {entry.tenantNote}
                      </div>
                    ) : null}
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
