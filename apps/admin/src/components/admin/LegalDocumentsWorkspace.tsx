'use client';

import { useEffect, useMemo, useState } from 'react';
import { requireAdminSession } from '@/lib/admin-api/require-admin-session';
import {
  createLegalDocument,
  listDocumentVersions,
  listLegalDocumentTypes,
  listLegalDocuments,
  publishDocumentVersion,
  supersedeVersion,
  updateLegalDocument,
  type AdminLegalDocument,
  type AdminLegalDocumentType,
  type AdminLegalDocumentVersion,
} from '@/lib/admin-api/admin-legal-client';

type CreateForm = {
  typeId: string;
  code: string;
  audience: 'customer' | 'tenant' | 'all';
};

type PublishForm = {
  versionLabel: string;
  locale: string;
  title: string;
  body: string;
};

const emptyPublishForm: PublishForm = {
  versionLabel: '',
  locale: 'tr',
  title: '',
  body: '',
};

export default function LegalDocumentsWorkspace() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [types, setTypes] = useState<AdminLegalDocumentType[]>([]);
  const [documents, setDocuments] = useState<AdminLegalDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    typeId: '',
    code: '',
    audience: 'customer',
  });
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [versions, setVersions] = useState<AdminLegalDocumentVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [publishForm, setPublishForm] = useState<PublishForm>(emptyPublishForm);
  const [supersedeCurrent, setSupersedeCurrent] = useState(true);

  const refresh = async () => {
    const session = await requireAdminSession();
    const [t, d] = await Promise.all([
      listLegalDocumentTypes(session),
      listLegalDocuments(session),
    ]);
    setTypes(t);
    setDocuments(d);
    if (t.length > 0 && !createForm.typeId) {
      setCreateForm((prev) => ({ ...prev, typeId: t[0]!.id }));
    }
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Veriler yüklenemedi.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedDocId) {
      setVersions([]);
      return;
    }
    (async () => {
      try {
        setVersionsLoading(true);
        const session = await requireAdminSession();
        const list = await listDocumentVersions(session, selectedDocId);
        setVersions(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Sürümler yüklenemedi.');
      } finally {
        setVersionsLoading(false);
      }
    })();
  }, [selectedDocId]);

  const handleCreate = async () => {
    if (!createForm.typeId || !createForm.code.trim()) {
      setError('Type ve code zorunlu.');
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const session = await requireAdminSession();
      await createLegalDocument(session, {
        typeId: createForm.typeId,
        code: createForm.code.trim(),
        audience: createForm.audience,
      });
      setCreateForm((prev) => ({ ...prev, code: '' }));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Doküman oluşturulamadı.');
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedDocId) return;
    if (
      !publishForm.versionLabel.trim() ||
      !publishForm.title.trim() ||
      !publishForm.body.trim()
    ) {
      setError('Version label, title ve body zorunlu.');
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const session = await requireAdminSession();
      await publishDocumentVersion(session, selectedDocId, {
        versionLabel: publishForm.versionLabel.trim(),
        locale: publishForm.locale.trim() || 'tr',
        title: publishForm.title.trim(),
        body: publishForm.body,
        bodyFormat: 'markdown',
        supersedeCurrent,
      });
      setPublishForm(emptyPublishForm);
      const session2 = await requireAdminSession();
      const v = await listDocumentVersions(session2, selectedDocId);
      setVersions(v);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sürüm yayınlanamadı.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (doc: AdminLegalDocument) => {
    try {
      setBusy(true);
      setError(null);
      const session = await requireAdminSession();
      await updateLegalDocument(session, doc.id, { isActive: !doc.isActive });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Doküman güncellenemedi.');
    } finally {
      setBusy(false);
    }
  };

  const handleSupersede = async (versionId: string) => {
    if (!selectedDocId) return;
    if (!window.confirm('Bu sürümü supersede etmek istediğinize emin misiniz?')) return;
    try {
      setBusy(true);
      setError(null);
      const session = await requireAdminSession();
      await supersedeVersion(session, versionId);
      const v = await listDocumentVersions(session, selectedDocId);
      setVersions(v);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Supersede başarısız.');
    } finally {
      setBusy(false);
    }
  };

  const selectedDoc = useMemo(
    () => documents.find((d) => d.id === selectedDocId) ?? null,
    [documents, selectedDocId],
  );

  const requiredCheckoutDocs = useMemo(() => {
    const required: { typeCode: string; label: string }[] = [
      { typeCode: 'distance_sales_contract', label: 'Mesafeli satış sözleşmesi' },
      { typeCode: 'pre_information_form', label: 'Ön bilgilendirme formu' },
    ];
    return required.map((req) => {
      const doc = documents.find(
        (d) => d.typeCode === req.typeCode && d.isActive,
      );
      return { ...req, published: Boolean(doc?.currentVersion) };
    });
  }, [documents]);
  const allRequiredPublished = requiredCheckoutDocs.every((d) => d.published);

  if (loading) {
    return <p style={{ color: '#71717a' }}>Yükleniyor…</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {error && (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: '#fef2f2',
            color: '#b91c1c',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Checkout required-docs status */}
      <section
        style={{
          padding: 20,
          borderRadius: 16,
          background: allRequiredPublished ? '#f0fdf4' : '#fffbeb',
          border: `1px solid ${allRequiredPublished ? '#bbf7d0' : '#fde68a'}`,
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 16 }}>
          Checkout için gerekli yasal belgeler
        </h3>
        {!allRequiredPublished && (
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#92400e' }}>
            Mesafeli satış sözleşmesi ve ön bilgilendirme formu yayınlanmalı.
          </p>
        )}
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
          {requiredCheckoutDocs.map((doc) => (
            <li
              key={doc.typeCode}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
            >
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  color: doc.published ? '#166534' : '#b91c1c',
                  background: doc.published ? '#dcfce7' : '#fee2e2',
                }}
              >
                {doc.published ? 'Yayında' : 'Eksik – yayınlanmalı'}
              </span>
              <span>
                {doc.label} <code style={{ color: '#71717a' }}>({doc.typeCode})</code>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Create new document */}
      <section
        style={{
          padding: 20,
          borderRadius: 16,
          background: '#fff',
          border: '1px solid #e4e4e7',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>
          Yeni Platform Legal Document
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr auto',
            gap: 12,
            alignItems: 'end',
          }}
        >
          <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
            <span style={{ color: '#71717a' }}>Type</span>
            <select
              value={createForm.typeId}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, typeId: e.target.value }))
              }
              style={{ padding: 8, borderRadius: 8, border: '1px solid #e4e4e7' }}
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName} ({t.code})
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
            <span style={{ color: '#71717a' }}>Code</span>
            <input
              value={createForm.code}
              placeholder="platform-terms-of-service"
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, code: e.target.value }))
              }
              style={{ padding: 8, borderRadius: 8, border: '1px solid #e4e4e7' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
            <span style={{ color: '#71717a' }}>Audience</span>
            <select
              value={createForm.audience}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  audience: e.target.value as CreateForm['audience'],
                }))
              }
              style={{ padding: 8, borderRadius: 8, border: '1px solid #e4e4e7' }}
            >
              <option value="customer">customer</option>
              <option value="tenant">tenant</option>
              <option value="all">all</option>
            </select>
          </label>
          <button
            onClick={handleCreate}
            disabled={busy}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: '#084799',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.5 : 1,
            }}
          >
            Oluştur
          </button>
        </div>
      </section>

      {/* Documents list + version manager */}
      <section
        style={{
          padding: 20,
          borderRadius: 16,
          background: '#fff',
          border: '1px solid #e4e4e7',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>
          Documents ({documents.length})
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#71717a' }}>
              <th style={{ padding: 8 }}>Code</th>
              <th style={{ padding: 8 }}>Type</th>
              <th style={{ padding: 8 }}>Audience</th>
              <th style={{ padding: 8 }}>Required</th>
              <th style={{ padding: 8 }}>Current Version</th>
              <th style={{ padding: 8 }}>Active</th>
              <th style={{ padding: 8 }} />
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr
                key={doc.id}
                style={{
                  borderTop: '1px solid #f4f4f5',
                  background: selectedDocId === doc.id ? '#eef4fb' : 'transparent',
                }}
              >
                <td style={{ padding: 8, fontFamily: 'monospace' }}>{doc.code}</td>
                <td style={{ padding: 8 }}>{doc.typeCode}</td>
                <td style={{ padding: 8 }}>{doc.audience}</td>
                <td style={{ padding: 8 }}>{doc.isRequired ? '✓' : '—'}</td>
                <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 12 }}>
                  {doc.currentVersion?.versionLabel ?? '— (yayın yok)'}
                </td>
                <td style={{ padding: 8 }}>
                  <button
                    onClick={() => handleToggleActive(doc)}
                    disabled={busy}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      border: '1px solid #084799',
                      background: doc.isActive ? '#084799' : '#fff',
                      color: doc.isActive ? '#fff' : '#084799',
                      fontSize: 11,
                      cursor: busy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {doc.isActive ? 'Aktif' : 'Pasif'}
                  </button>
                </td>
                <td style={{ padding: 8, textAlign: 'right' }}>
                  <button
                    onClick={() =>
                      setSelectedDocId(selectedDocId === doc.id ? null : doc.id)
                    }
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: '1px solid #084799',
                      background: '#fff',
                      color: '#084799',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {selectedDocId === doc.id ? 'Kapat' : 'Sürümler'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Selected doc: versions + publish form */}
      {selectedDoc && (
        <section
          style={{
            padding: 20,
            borderRadius: 16,
            background: '#fff',
            border: '1px solid #e4e4e7',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 4, fontSize: 16 }}>
            Sürümler — {selectedDoc.code}
          </h3>
          <p style={{ marginTop: 0, color: '#71717a', fontSize: 12 }}>
            {selectedDoc.typeCode} · {selectedDoc.audience}
          </p>

          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: '#f9fafb',
              margin: '12px 0',
            }}
          >
            <h4 style={{ marginTop: 0, marginBottom: 8, fontSize: 14 }}>
              Yeni sürüm yayınla
            </h4>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input
                  placeholder="Version label (ör. 2026-05-14-v1)"
                  value={publishForm.versionLabel}
                  onChange={(e) =>
                    setPublishForm((prev) => ({ ...prev, versionLabel: e.target.value }))
                  }
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    border: '1px solid #e4e4e7',
                    fontSize: 13,
                  }}
                />
                <input
                  placeholder="Locale (tr)"
                  value={publishForm.locale}
                  onChange={(e) =>
                    setPublishForm((prev) => ({ ...prev, locale: e.target.value }))
                  }
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    border: '1px solid #e4e4e7',
                    fontSize: 13,
                  }}
                />
              </div>
              <input
                placeholder="Başlık"
                value={publishForm.title}
                onChange={(e) =>
                  setPublishForm((prev) => ({ ...prev, title: e.target.value }))
                }
                style={{
                  padding: 8,
                  borderRadius: 8,
                  border: '1px solid #e4e4e7',
                  fontSize: 13,
                }}
              />
              <textarea
                placeholder="Body (markdown)"
                value={publishForm.body}
                onChange={(e) =>
                  setPublishForm((prev) => ({ ...prev, body: e.target.value }))
                }
                rows={10}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  border: '1px solid #e4e4e7',
                  fontSize: 13,
                  fontFamily: 'monospace',
                }}
              />
              <label
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                  fontSize: 12,
                  color: '#3f3f46',
                }}
              >
                <input
                  type="checkbox"
                  checked={supersedeCurrent}
                  onChange={(e) => setSupersedeCurrent(e.target.checked)}
                />
                Mevcut aktif sürümü supersede et
              </label>
              <button
                onClick={handlePublish}
                disabled={busy}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: '#084799',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.5 : 1,
                  width: 'fit-content',
                }}
              >
                Yayınla
              </button>
            </div>
          </div>

          <h4 style={{ marginTop: 16, marginBottom: 8, fontSize: 14 }}>
            Sürüm geçmişi ({versions.length})
          </h4>
          {versionsLoading ? (
            <p style={{ color: '#71717a', fontSize: 13 }}>Yükleniyor…</p>
          ) : versions.length === 0 ? (
            <p style={{ color: '#71717a', fontSize: 13 }}>Henüz sürüm yok.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#71717a' }}>
                  <th style={{ padding: 6 }}>Label</th>
                  <th style={{ padding: 6 }}>Locale</th>
                  <th style={{ padding: 6 }}>Title</th>
                  <th style={{ padding: 6 }}>Published</th>
                  <th style={{ padding: 6 }}>Superseded</th>
                  <th style={{ padding: 6 }} />
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id} style={{ borderTop: '1px solid #f4f4f5' }}>
                    <td style={{ padding: 6, fontFamily: 'monospace' }}>
                      {v.versionLabel}
                    </td>
                    <td style={{ padding: 6 }}>{v.locale}</td>
                    <td style={{ padding: 6 }}>{v.title}</td>
                    <td style={{ padding: 6 }}>
                      {new Date(v.publishedAt).toLocaleString('tr-TR')}
                    </td>
                    <td style={{ padding: 6 }}>
                      {v.supersededAt
                        ? new Date(v.supersededAt).toLocaleString('tr-TR')
                        : 'aktif'}
                    </td>
                    <td style={{ padding: 6, textAlign: 'right' }}>
                      {!v.supersededAt && (
                        <button
                          onClick={() => handleSupersede(v.id)}
                          disabled={busy}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            border: '1px solid #b91c1c',
                            background: '#fff',
                            color: '#b91c1c',
                            fontSize: 11,
                            cursor: busy ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Supersede
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
