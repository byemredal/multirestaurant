'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  DataTable,
  Drawer,
  EmptyState,
  SkeletonTable,
  StatusBadge,
  type Column,
} from '@/components/ui';
import { Icon } from '@/lib/icons';
import { useBranding } from '@/lib/branding/BrandingProvider';
import { requireAdminSession } from '@/lib/admin-api/require-admin-session';
import {
  AdminLegalError,
  createLegalDocument,
  listDocumentVersions,
  listLegalDocumentTypes,
  listLegalDocuments,
  publishDocumentVersion,
  updateLegalDocument,
  type AdminLegalDocument,
  type AdminLegalDocumentType,
  type AdminLegalDocumentVersion,
} from '@/lib/admin-api/admin-legal-client';

// Required customer checkout documents (mirrors backend
// REQUIRED_CHECKOUT_DOCUMENT_CODES). Global for now — country-specific policy
// is tracked as tech debt and intentionally NOT changed in this slice.
const REQUIRED_CHECKOUT_CODES: Array<{ typeCode: string; label: string }> = [
  { typeCode: 'distance_sales_contract', label: 'Mesafeli Satış Sözleşmesi' },
  { typeCode: 'pre_information_form', label: 'Ön Bilgilendirme Formu' },
];

// Client-side hint only — the authoritative placeholder guard lives in the API
// (publishVersion / getCheckoutLegalReadiness). This just warns the admin early.
const PLACEHOLDER_HINT = /placeholder|lorem ipsum|taslak|\bdraft\b|test document|\bexample\b|örnek metin|üretime geçmeden önce|\bTODO\b|\bFIXME\b|\bdummy\b|\bsample\b/i;

function looksLikePlaceholder(...values: Array<string | null | undefined>): boolean {
  const haystack = values.filter(Boolean).join('  ');
  return haystack.length > 0 && PLACEHOLDER_HINT.test(haystack);
}

type DrawerState =
  | { kind: 'create' }
  | { kind: 'publish'; doc: AdminLegalDocument }
  | { kind: 'view'; doc: AdminLegalDocument }
  | null;

type CreateForm = {
  typeId: string;
  code: string;
  audience: 'customer' | 'tenant' | 'all';
  isRequired: boolean;
  isActive: boolean;
  createFirstVersion: boolean;
  versionLabel: string;
  title: string;
  body: string;
  bodyFormat: 'markdown' | 'html' | 'plain_text';
};

type PublishForm = {
  versionLabel: string;
  locale: string;
  title: string;
  body: string;
  bodyFormat: 'markdown' | 'html' | 'plain_text';
  effectiveFrom: string;
};

function buildCreateForm(typeId: string): CreateForm {
  return {
    typeId,
    code: '',
    audience: 'customer',
    isRequired: true,
    isActive: true,
    createFirstVersion: true,
    versionLabel: '',
    title: '',
    body: '',
    bodyFormat: 'markdown',
  };
}

function buildPublishForm(locale: string): PublishForm {
  return {
    versionLabel: '',
    locale,
    title: '',
    body: '',
    bodyFormat: 'markdown',
    effectiveFrom: '',
  };
}

const PLACEHOLDER_UI_MESSAGE =
  'Bu metin taslak/placeholder içerik gibi görünüyor. Üretimde yayınlanamaz. Lütfen gerçek hukuki metni girin.';

export default function LegalDocumentsWorkspace() {
  const branding = useBranding();
  const country = branding?.defaultCountry?.trim().toUpperCase() ?? '';
  const defaultLocale = branding?.defaultLanguage?.trim() || 'tr';
  const brandingLoaded = branding !== null;
  const canCreate = Boolean(country);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [types, setTypes] = useState<AdminLegalDocumentType[]>([]);
  const [documents, setDocuments] = useState<AdminLegalDocument[]>([]);

  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('all');
  const [requiredOnly, setRequiredOnly] = useState(false);
  const [search, setSearch] = useState('');

  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [createForm, setCreateForm] = useState<CreateForm>(buildCreateForm(''));
  const [publishForm, setPublishForm] = useState<PublishForm>(buildPublishForm(defaultLocale));
  const [versions, setVersions] = useState<AdminLegalDocumentVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const reload = useCallback(async () => {
    const session = await requireAdminSession();
    const [nextTypes, nextDocs] = await Promise.all([
      listLegalDocumentTypes(session),
      // Country scope: only this installation's customer-facing documents.
      listLegalDocuments(session, {
        audience: 'customer',
        countryCode: country || undefined,
        includeInactive: true,
      }),
    ]);
    setTypes(nextTypes);
    setDocuments(nextDocs);
  }, [country]);

  useEffect(() => {
    if (!brandingLoaded) return;
    let active = true;
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        await reload();
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Veriler yüklenemedi.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [brandingLoaded, reload]);

  const closeDrawer = useCallback(() => {
    setDrawer(null);
    setVersions([]);
  }, []);

  const openCreate = useCallback(() => {
    if (!canCreate) return;
    setCreateForm(buildCreateForm(types[0]?.id ?? ''));
    setError(null);
    setDrawer({ kind: 'create' });
  }, [canCreate, types]);

  const openPublish = useCallback((doc: AdminLegalDocument) => {
    setPublishForm(buildPublishForm(doc.currentVersion?.locale ?? defaultLocale));
    setError(null);
    setDrawer({ kind: 'publish', doc });
  }, [defaultLocale]);

  const openView = useCallback(async (doc: AdminLegalDocument) => {
    setError(null);
    setDrawer({ kind: 'view', doc });
    try {
      setVersionsLoading(true);
      const session = await requireAdminSession();
      setVersions(await listDocumentVersions(session, doc.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sürümler yüklenemedi.');
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  const toggleActive = useCallback(
    async (doc: AdminLegalDocument) => {
      try {
        setBusy(true);
        setError(null);
        const session = await requireAdminSession();
        await updateLegalDocument(session, doc.id, { isActive: !doc.isActive });
        await reload();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Doküman güncellenemedi.');
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  const resolveError = (caught: unknown): string => {
    if (caught instanceof AdminLegalError && caught.code === 'legal_document_placeholder_content') {
      return PLACEHOLDER_UI_MESSAGE;
    }
    return caught instanceof Error ? caught.message : 'İşlem tamamlanamadı.';
  };

  const submitCreate = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!createForm.typeId || !createForm.code.trim()) {
        setError('Belge tipi ve code zorunludur.');
        return;
      }
      try {
        setBusy(true);
        setError(null);
        const session = await requireAdminSession();
        const created = await createLegalDocument(session, {
          typeId: createForm.typeId,
          code: createForm.code.trim(),
          countryCode: country,
          audience: createForm.audience,
          isRequired: createForm.isRequired,
          isActive: createForm.isActive,
        });
        // Optionally publish the first version in the same flow.
        if (
          createForm.createFirstVersion &&
          createForm.versionLabel.trim() &&
          createForm.title.trim() &&
          createForm.body.trim()
        ) {
          await publishDocumentVersion(session, created.id, {
            versionLabel: createForm.versionLabel.trim(),
            locale: defaultLocale,
            title: createForm.title.trim(),
            body: createForm.body,
            bodyFormat: createForm.bodyFormat,
          });
        }
        await reload();
        closeDrawer();
      } catch (caught) {
        setError(resolveError(caught));
      } finally {
        setBusy(false);
      }
    },
    [closeDrawer, country, createForm, defaultLocale, reload],
  );

  const submitPublish = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (drawer?.kind !== 'publish') return;
      if (!publishForm.versionLabel.trim() || !publishForm.title.trim() || !publishForm.body.trim()) {
        setError('Version label, başlık ve metin zorunludur.');
        return;
      }
      try {
        setBusy(true);
        setError(null);
        const session = await requireAdminSession();
        await publishDocumentVersion(session, drawer.doc.id, {
          versionLabel: publishForm.versionLabel.trim(),
          locale: publishForm.locale.trim() || defaultLocale,
          title: publishForm.title.trim(),
          body: publishForm.body,
          bodyFormat: publishForm.bodyFormat,
          effectiveFrom: publishForm.effectiveFrom || undefined,
        });
        await reload();
        closeDrawer();
      } catch (caught) {
        setError(resolveError(caught));
      } finally {
        setBusy(false);
      }
    },
    [closeDrawer, defaultLocale, drawer, publishForm, reload],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return documents.filter((doc) => {
      if (statusFilter === 'active' && !doc.isActive) return false;
      if (requiredOnly && !doc.isRequired) return false;
      if (term) {
        const hay = `${doc.code} ${doc.typeCode ?? ''} ${doc.currentVersion?.title ?? ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [documents, requiredOnly, search, statusFilter]);

  const requiredReadiness = useMemo(
    () =>
      REQUIRED_CHECKOUT_CODES.map((req) => {
        const doc = documents.find((d) => d.typeCode === req.typeCode && d.isActive);
        const version = doc?.currentVersion ?? null;
        const placeholder = version
          ? looksLikePlaceholder(version.title, version.body, version.versionLabel)
          : false;
        return { ...req, published: Boolean(version), placeholder };
      }),
    [documents],
  );
  const allReady = requiredReadiness.every((r) => r.published && !r.placeholder);

  const columns: Column<AdminLegalDocument>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Belge',
        render: (row) => (
          <div>
            <div className="admin-table__primary">{row.currentVersion?.title ?? row.typeCode ?? row.code}</div>
            <div className="admin-table__sub">{row.typeCode ?? '—'}</div>
          </div>
        ),
      },
      { key: 'code', header: 'Code', render: (row) => <code>{row.code}</code> },
      { key: 'country', header: 'Ülke', render: (row) => row.countryCode ?? '—' },
      { key: 'locale', header: 'Dil', render: (row) => row.currentVersion?.locale ?? '—' },
      { key: 'audience', header: 'Audience', render: (row) => row.audience },
      { key: 'required', header: 'Required', render: (row) => (row.isRequired ? 'Evet' : 'Hayır') },
      {
        key: 'active',
        header: 'Aktif',
        render: (row) => (
          <StatusBadge label={row.isActive ? 'Aktif' : 'Pasif'} tone={row.isActive ? 'success' : 'neutral'} />
        ),
      },
      {
        key: 'version',
        header: 'Current version',
        render: (row) =>
          row.currentVersion ? (
            <code>{row.currentVersion.versionLabel}</code>
          ) : (
            <span className="admin-table__sub">yayın yok</span>
          ),
      },
      {
        key: 'publishedAt',
        header: 'Published',
        render: (row) =>
          row.currentVersion ? new Date(row.currentVersion.publishedAt).toLocaleDateString('tr-TR') : '—',
      },
      {
        key: 'placeholder',
        header: 'Placeholder',
        render: (row) =>
          row.currentVersion &&
          looksLikePlaceholder(row.currentVersion.title, row.currentVersion.body, row.currentVersion.versionLabel) ? (
            <StatusBadge label="Taslak?" tone="warning" />
          ) : (
            <span className="admin-table__sub">—</span>
          ),
      },
      {
        key: 'checkout',
        header: 'Checkout',
        render: (row) =>
          REQUIRED_CHECKOUT_CODES.some((r) => r.typeCode === row.typeCode) ? (
            <StatusBadge label="Zorunlu" tone="accent" />
          ) : (
            <span className="admin-table__sub">—</span>
          ),
      },
      {
        key: 'actions',
        header: 'İşlemler',
        align: 'right',
        render: (row) => (
          <div className="admin-row" style={{ gap: 6, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
            <button className="admin-icon-button" type="button" title="Görüntüle" aria-label="Görüntüle" onClick={() => void openView(row)}>
              <Icon.external width={16} height={16} />
            </button>
            <button className="admin-icon-button" type="button" title="Yeni versiyon yayınla" aria-label="Yeni versiyon yayınla" onClick={() => openPublish(row)}>
              <Icon.plus width={16} height={16} />
            </button>
            <button
              className="admin-icon-button"
              type="button"
              disabled={busy}
              title={row.isActive ? 'Pasifleştir' : 'Aktifleştir'}
              aria-label={row.isActive ? 'Pasifleştir' : 'Aktifleştir'}
              onClick={() => void toggleActive(row)}
            >
              <Icon.power width={16} height={16} />
            </button>
          </div>
        ),
      },
    ],
    [busy, openPublish, openView, toggleActive],
  );

  const editingDoc = drawer && drawer.kind !== 'create' ? drawer.doc : null;

  return (
    <div className="admin-stack">
      {/* Checkout readiness card */}
      <div
        className="admin-card"
        style={{
          borderColor: allReady ? '#bbf7d0' : '#fde68a',
          background: allReady ? '#f0fdf4' : '#fffbeb',
        }}
      >
        <div className="admin-card__body">
          <strong>Checkout için gerekli müşteri yasal metinleri{country ? ` (${country} / ${defaultLocale})` : ''}</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
            {requiredReadiness.map((req) => (
              <li key={req.typeCode} className="admin-row" style={{ gap: 8 }}>
                <StatusBadge
                  label={req.placeholder ? 'Taslak içerik' : req.published ? 'Yayında' : 'Eksik'}
                  tone={req.placeholder ? 'warning' : req.published ? 'success' : 'danger'}
                />
                <span>
                  {req.label} <code>({req.typeCode})</code>
                  {!req.published && country
                    ? ` — ${country} / ${defaultLocale} için yayınlanmamış.`
                    : ''}
                  {req.placeholder ? ' — placeholder/taslak görünüyor, üretimde checkout’u bloklar.' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {!brandingLoaded && <div className="admin-state">Platform ülke/dil bilgisi yükleniyor...</div>}
      {brandingLoaded && !canCreate && (
        <div className="admin-card" style={{ borderColor: '#e2b6b6', background: '#fdf2f2' }}>
          <div className="admin-card__body">
            Aktif kurulum profili (ülke) okunamadı. Yeni yasal metin oluşturmak için platform kurulumunun
            tamamlanmış olması gerekir.
          </div>
        </div>
      )}
      {error && <div className="admin-state">{error}</div>}

      {/* Filters + create */}
      <div className="admin-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div className="admin-row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <span className="admin-tag" title="Tek ülkeli platform — ülke kurulum profilinden gelir">
            Ülke: {country || '—'}
          </span>
          <select
            className="admin-input"
            style={{ width: 'auto' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'active' | 'all')}
          >
            <option value="all">Tüm durumlar</option>
            <option value="active">Sadece aktif</option>
          </select>
          <label className="admin-row" style={{ gap: 6 }}>
            <input type="checkbox" checked={requiredOnly} onChange={(e) => setRequiredOnly(e.target.checked)} />
            <span>Sadece zorunlu</span>
          </label>
          <input
            className="admin-input"
            style={{ width: 220 }}
            placeholder="Ara (code, tip, başlık)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="admin-button admin-button--primary"
          disabled={!canCreate || busy}
          onClick={openCreate}
          title={!canCreate ? 'Platform kurulum profili gerekli' : undefined}
        >
          <Icon.plus width={16} height={16} />
          Yeni Yasal Metin
        </button>
      </div>

      {loading ? (
        <SkeletonTable rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="shield"
          title="Bu ülke/dil için müşteri yasal metni yok."
          description={country ? `${country} için henüz bir müşteri yasal metni tanımlanmadı.` : undefined}
          action={
            canCreate ? (
              <button type="button" className="admin-button admin-button--primary" onClick={openCreate}>
                İlk yasal metni oluştur
              </button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(row) => row.id}
          onRowClick={(row) => void openView(row)}
          footer={<span>{filtered.length} yasal metin</span>}
        />
      )}

      {/* Create drawer */}
      <Drawer
        open={drawer?.kind === 'create'}
        onClose={closeDrawer}
        title="Yeni Yasal Metin"
        subtitle={country ? `${country} / ${defaultLocale}` : undefined}
        footer={
          <>
            <button type="submit" form="legal-create-form" className="admin-button admin-button--primary" disabled={busy}>
              {busy ? 'Kaydediliyor...' : 'Oluştur'}
            </button>
            <button type="button" className="admin-button" disabled={busy} onClick={closeDrawer}>
              İptal
            </button>
          </>
        }
      >
        <form id="legal-create-form" className="admin-stack" onSubmit={submitCreate} style={{ gap: 12 }}>
          <Field label="Belge tipi">
            <select
              className="admin-input"
              value={createForm.typeId}
              onChange={(e) => setCreateForm((f) => ({ ...f, typeId: e.target.value }))}
              required
            >
              <option value="" disabled>
                Seçin
              </option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName} ({t.code})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Code (benzersiz)">
            <input
              className="admin-input"
              placeholder="tr-distance-sales-contract"
              value={createForm.code}
              onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))}
              required
            />
          </Field>
          <Field label="Audience">
            <select
              className="admin-input"
              value={createForm.audience}
              onChange={(e) => setCreateForm((f) => ({ ...f, audience: e.target.value as CreateForm['audience'] }))}
            >
              <option value="customer">customer</option>
              <option value="tenant">tenant</option>
              <option value="all">all</option>
            </select>
          </Field>
          <div className="admin-row">
            <label className="admin-row" style={{ gap: 8 }}>
              <input type="checkbox" checked={createForm.isRequired} onChange={(e) => setCreateForm((f) => ({ ...f, isRequired: e.target.checked }))} />
              <span>Zorunlu</span>
            </label>
            <label className="admin-row" style={{ gap: 8 }}>
              <input type="checkbox" checked={createForm.isActive} onChange={(e) => setCreateForm((f) => ({ ...f, isActive: e.target.checked }))} />
              <span>Aktif</span>
            </label>
          </div>

          <label className="admin-row" style={{ gap: 8 }}>
            <input type="checkbox" checked={createForm.createFirstVersion} onChange={(e) => setCreateForm((f) => ({ ...f, createFirstVersion: e.target.checked }))} />
            <span>İlk versiyonu da yayınla</span>
          </label>

          {createForm.createFirstVersion && (
            <>
              <Field label="Version label">
                <input className="admin-input" placeholder="2026-06-01-v1" value={createForm.versionLabel} onChange={(e) => setCreateForm((f) => ({ ...f, versionLabel: e.target.value }))} />
              </Field>
              <Field label="Başlık">
                <input className="admin-input" value={createForm.title} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} />
              </Field>
              <Field label="Metin (body)">
                <textarea className="admin-textarea" rows={8} value={createForm.body} onChange={(e) => setCreateForm((f) => ({ ...f, body: e.target.value }))} />
              </Field>
              {looksLikePlaceholder(createForm.title, createForm.body, createForm.versionLabel) && (
                <div className="admin-card" style={{ borderColor: '#f0ca73', background: '#fff9ed' }}>
                  <div className="admin-card__body">{PLACEHOLDER_UI_MESSAGE}</div>
                </div>
              )}
            </>
          )}
        </form>
      </Drawer>

      {/* Publish drawer */}
      <Drawer
        open={drawer?.kind === 'publish'}
        onClose={closeDrawer}
        title="Yeni Versiyon Yayınla"
        subtitle={editingDoc?.code}
        footer={
          <>
            <button type="submit" form="legal-publish-form" className="admin-button admin-button--primary" disabled={busy}>
              {busy ? 'Yayınlanıyor...' : 'Yayınla'}
            </button>
            <button type="button" className="admin-button" disabled={busy} onClick={closeDrawer}>
              İptal
            </button>
          </>
        }
      >
        <form id="legal-publish-form" className="admin-stack" onSubmit={submitPublish} style={{ gap: 12 }}>
          <Field label="Version label">
            <input className="admin-input" placeholder="2026-06-01-v1" value={publishForm.versionLabel} onChange={(e) => setPublishForm((f) => ({ ...f, versionLabel: e.target.value }))} required />
          </Field>
          <Field label="Dil (locale)">
            <input className="admin-input" value={publishForm.locale} onChange={(e) => setPublishForm((f) => ({ ...f, locale: e.target.value }))} required />
          </Field>
          <Field label="Başlık">
            <input className="admin-input" value={publishForm.title} onChange={(e) => setPublishForm((f) => ({ ...f, title: e.target.value }))} required />
          </Field>
          <Field label="Metin (body)">
            <textarea className="admin-textarea" rows={10} value={publishForm.body} onChange={(e) => setPublishForm((f) => ({ ...f, body: e.target.value }))} required />
          </Field>
          <Field label="Yürürlük tarihi (opsiyonel)">
            <input className="admin-input" type="date" value={publishForm.effectiveFrom} onChange={(e) => setPublishForm((f) => ({ ...f, effectiveFrom: e.target.value }))} />
          </Field>
          {looksLikePlaceholder(publishForm.title, publishForm.body, publishForm.versionLabel) && (
            <div className="admin-card" style={{ borderColor: '#f0ca73', background: '#fff9ed' }}>
              <div className="admin-card__body">{PLACEHOLDER_UI_MESSAGE}</div>
            </div>
          )}
        </form>
      </Drawer>

      {/* View drawer */}
      <Drawer
        open={drawer?.kind === 'view'}
        onClose={closeDrawer}
        title={editingDoc?.currentVersion?.title ?? editingDoc?.code ?? 'Yasal metin'}
        subtitle={editingDoc ? `${editingDoc.countryCode ?? '—'} · ${editingDoc.typeCode ?? '—'} · ${editingDoc.audience}` : undefined}
        footer={
          editingDoc ? (
            <button type="button" className="admin-button admin-button--primary" onClick={() => openPublish(editingDoc)}>
              Yeni versiyon yayınla
            </button>
          ) : undefined
        }
      >
        {editingDoc && (
          <div className="admin-stack" style={{ gap: 12 }}>
            {REQUIRED_CHECKOUT_CODES.some((r) => r.typeCode === editingDoc.typeCode) && (
              <StatusBadge label="Checkout için zorunlu belge" tone="accent" />
            )}
            {editingDoc.currentVersion ? (
              <>
                <div className="admin-kv-grid">
                  <Kv label="Current version">{editingDoc.currentVersion.versionLabel}</Kv>
                  <Kv label="Dil">{editingDoc.currentVersion.locale}</Kv>
                  <Kv label="Yayın">{new Date(editingDoc.currentVersion.publishedAt).toLocaleString('tr-TR')}</Kv>
                  <Kv label="Format">{editingDoc.currentVersion.bodyFormat}</Kv>
                </div>
                {looksLikePlaceholder(editingDoc.currentVersion.title, editingDoc.currentVersion.body) && (
                  <div className="admin-card" style={{ borderColor: '#f0ca73', background: '#fff9ed' }}>
                    <div className="admin-card__body">{PLACEHOLDER_UI_MESSAGE}</div>
                  </div>
                )}
                <Field label="İçerik">
                  <textarea className="admin-textarea" rows={12} readOnly value={editingDoc.currentVersion.body} />
                </Field>
              </>
            ) : (
              <div className="admin-state">Bu belgenin yayınlanmış güncel versiyonu yok.</div>
            )}
            <div>
              <div className="admin-field__label" style={{ marginBottom: 6 }}>
                Versiyon geçmişi
              </div>
              {versionsLoading ? (
                <div className="admin-state">Yükleniyor...</div>
              ) : versions.length === 0 ? (
                <div className="admin-state">Henüz versiyon yok.</div>
              ) : (
                <div className="admin-list">
                  {versions.map((v) => (
                    <div key={v.id} className="admin-list-row">
                      <div>
                        <div className="admin-list-row__title">
                          <code>{v.versionLabel}</code> · {v.locale}
                        </div>
                        <div className="admin-list-row__meta">{v.title}</div>
                      </div>
                      <StatusBadge label={v.supersededAt ? 'Superseded' : 'Aktif'} tone={v.supersededAt ? 'neutral' : 'success'} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="admin-field">
      <span className="admin-field__label">{label}</span>
      {children}
    </label>
  );
}

function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="admin-kv__label">{label}</div>
      <div className="admin-kv__value">{children}</div>
    </div>
  );
}
