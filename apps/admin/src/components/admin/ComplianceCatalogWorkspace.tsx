'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  DataTable,
  Drawer,
  StatusBadge,
  Tabs,
  type Column,
} from '@/components/ui';
import { Icon } from '@/lib/icons';
import { useBranding } from '@/lib/branding/BrandingProvider';
import {
  createComplianceConsentDefinition,
  createComplianceDocumentRequirement,
  listComplianceConsentDefinitions,
  listComplianceDocumentRequirements,
  updateComplianceConsentDefinition,
  updateComplianceDocumentRequirement,
  type ComplianceConsentDefinition,
  type ComplianceConsentDefinitionInput,
  type ComplianceDocumentRequirement,
  type ComplianceDocumentRequirementInput,
} from '@/lib/admin-api/compliance-catalog-client';
import { requireAdminSession } from '@/lib/admin-api/require-admin-session';

type CatalogTab = 'documents' | 'consents';

type DrawerState =
  | { kind: 'document'; editingId: string | null }
  | { kind: 'consent'; editingId: string | null }
  | null;

const PLACEHOLDER_NOTE =
  'Taslak içeriktir; üretime geçmeden önce ülke/dil bazlı metin hukuk/operasyon ekibi tarafından doğrulanmalıdır.';

/**
 * Build the blank draft for a NEW document requirement. Country/language come
 * from the active installation profile (branding) — never CH/de-CH hardcoded —
 * so a TR install opens the form pre-filled with TR/tr-TR.
 */
function buildEmptyDocument(
  country: string,
  language: string,
): ComplianceDocumentRequirementInput {
  return {
    country,
    language,
    documentType: '',
    label: '',
    description: PLACEHOLDER_NOTE,
    required: false,
    acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
    guidanceOnly: true,
    active: true,
    sortOrder: 10,
  };
}

function buildEmptyConsent(
  country: string,
  language: string,
): ComplianceConsentDefinitionInput {
  return {
    country,
    language,
    consentKey: '',
    label: '',
    description: PLACEHOLDER_NOTE,
    documentCode: '',
    documentVersion: 'placeholder-v1',
    documentUrl: null,
    required: true,
    active: false,
    sortOrder: 10,
  };
}

export default function ComplianceCatalogWorkspace() {
  const branding = useBranding();
  const defaultCountry = branding?.defaultCountry?.trim() ?? '';
  const defaultLanguage = branding?.defaultLanguage?.trim() ?? '';
  // Branding revalidates from /config/branding; `null` means "still loading".
  const brandingLoaded = branding !== null;
  const canCreate = Boolean(defaultCountry && defaultLanguage);

  const [tab, setTab] = useState<CatalogTab>('documents');
  const [documents, setDocuments] = useState<ComplianceDocumentRequirement[]>([]);
  const [consents, setConsents] = useState<ComplianceConsentDefinition[]>([]);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [documentDraft, setDocumentDraft] = useState<ComplianceDocumentRequirementInput>(
    buildEmptyDocument('', ''),
  );
  const [consentDraft, setConsentDraft] = useState<ComplianceConsentDefinitionInput>(
    buildEmptyConsent('', ''),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const session = await requireAdminSession();
    const [nextDocuments, nextConsents] = await Promise.all([
      listComplianceDocumentRequirements(session),
      listComplianceConsentDefinitions(session),
    ]);
    setDocuments(nextDocuments);
    setConsents(nextConsents);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        await reload();
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : 'Başvuru uyumu verileri yüklenemedi.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [reload]);

  const tabs = useMemo(
    () => [
      { id: 'documents', label: 'Başvuruda İstenen Belgeler', count: documents.length },
      { id: 'consents', label: 'Başvuru Onay Kutuları', count: consents.length },
    ],
    [consents.length, documents.length],
  );

  const closeDrawer = useCallback(() => setDrawer(null), []);

  const openNewDocument = useCallback(() => {
    if (!canCreate) return;
    setDocumentDraft(buildEmptyDocument(defaultCountry, defaultLanguage));
    setError(null);
    setDrawer({ kind: 'document', editingId: null });
  }, [canCreate, defaultCountry, defaultLanguage]);

  const openEditDocument = useCallback((entry: ComplianceDocumentRequirement) => {
    const { id: _id, ...rest } = entry;
    void _id;
    setDocumentDraft({ ...rest });
    setError(null);
    setDrawer({ kind: 'document', editingId: entry.id });
  }, []);

  const openNewConsent = useCallback(() => {
    if (!canCreate) return;
    setConsentDraft(buildEmptyConsent(defaultCountry, defaultLanguage));
    setError(null);
    setDrawer({ kind: 'consent', editingId: null });
  }, [canCreate, defaultCountry, defaultLanguage]);

  const openEditConsent = useCallback((entry: ComplianceConsentDefinition) => {
    const { id: _id, ...rest } = entry;
    void _id;
    setConsentDraft({ ...rest });
    setError(null);
    setDrawer({ kind: 'consent', editingId: entry.id });
  }, []);

  const saveDocument = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (drawer?.kind !== 'document') return;
      try {
        setSaving(true);
        setError(null);
        const session = await requireAdminSession();
        if (drawer.editingId) {
          await updateComplianceDocumentRequirement(session, drawer.editingId, documentDraft);
        } else {
          await createComplianceDocumentRequirement(session, documentDraft);
        }
        await reload();
        closeDrawer();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Belge gereksinimi kaydedilemedi.');
      } finally {
        setSaving(false);
      }
    },
    [closeDrawer, documentDraft, drawer, reload],
  );

  const saveConsent = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (drawer?.kind !== 'consent') return;
      try {
        setSaving(true);
        setError(null);
        const session = await requireAdminSession();
        if (drawer.editingId) {
          await updateComplianceConsentDefinition(session, drawer.editingId, consentDraft);
        } else {
          await createComplianceConsentDefinition(session, consentDraft);
        }
        await reload();
        closeDrawer();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Başvuru onayı kaydedilemedi.');
      } finally {
        setSaving(false);
      }
    },
    [closeDrawer, consentDraft, drawer, reload],
  );

  const toggleDocument = useCallback(
    async (entry: ComplianceDocumentRequirement) => {
      try {
        setSaving(true);
        const session = await requireAdminSession();
        await updateComplianceDocumentRequirement(session, entry.id, { active: !entry.active });
        await reload();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Etkinlik durumu güncellenemedi.');
      } finally {
        setSaving(false);
      }
    },
    [reload],
  );

  const toggleConsent = useCallback(
    async (entry: ComplianceConsentDefinition) => {
      try {
        setSaving(true);
        const session = await requireAdminSession();
        await updateComplianceConsentDefinition(session, entry.id, { active: !entry.active });
        await reload();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Etkinlik durumu güncellenemedi.');
      } finally {
        setSaving(false);
      }
    },
    [reload],
  );

  const documentColumns: Column<ComplianceDocumentRequirement>[] = useMemo(
    () => [
      {
        key: 'label',
        header: 'Görünen ad',
        render: (row) => <span className="admin-table__primary">{row.label}</span>,
      },
      { key: 'documentType', header: 'Belge tipi', render: (row) => <span className="admin-tag">{row.documentType}</span> },
      { key: 'country', header: 'Ülke', render: (row) => row.country },
      { key: 'language', header: 'Dil', render: (row) => row.language },
      { key: 'required', header: 'Zorunlu mu', render: (row) => (row.required ? 'Evet' : 'Hayır') },
      { key: 'formats', header: 'Dosya tipleri', render: (row) => row.acceptedFormats.join(', ') },
      { key: 'sortOrder', header: 'Sıra', align: 'right', render: (row) => row.sortOrder },
      {
        key: 'status',
        header: 'Durum',
        render: (row) => (
          <StatusBadge label={row.active ? 'Etkin' : 'Pasif'} tone={row.active ? 'success' : 'neutral'} />
        ),
      },
      {
        key: 'actions',
        header: 'İşlemler',
        align: 'right',
        render: (row) => (
          <RowActions
            active={row.active}
            saving={saving}
            onEdit={() => openEditDocument(row)}
            onToggle={() => void toggleDocument(row)}
          />
        ),
      },
    ],
    [openEditDocument, saving, toggleDocument],
  );

  const consentColumns: Column<ComplianceConsentDefinition>[] = useMemo(
    () => [
      {
        key: 'label',
        header: 'Başlık',
        render: (row) => <span className="admin-table__primary">{row.label}</span>,
      },
      {
        key: 'code',
        header: 'Kod / tip',
        render: (row) => (
          <div>
            <div className="admin-tag">{row.consentKey}</div>
            <div className="admin-table__sub">{row.documentCode} · {row.documentVersion}</div>
          </div>
        ),
      },
      { key: 'country', header: 'Ülke', render: (row) => row.country },
      { key: 'language', header: 'Dil', render: (row) => row.language },
      { key: 'required', header: 'Zorunlu mu', render: (row) => (row.required ? 'Evet' : 'Hayır') },
      { key: 'redirect', header: 'Yönlendirme mi', render: (row) => (row.documentUrl ? 'Evet' : 'Hayır') },
      { key: 'sortOrder', header: 'Sıra', align: 'right', render: (row) => row.sortOrder },
      {
        key: 'status',
        header: 'Durum',
        render: (row) => (
          <StatusBadge label={row.active ? 'Etkin' : 'Pasif'} tone={row.active ? 'success' : 'neutral'} />
        ),
      },
      {
        key: 'actions',
        header: 'İşlemler',
        align: 'right',
        render: (row) => (
          <RowActions
            active={row.active}
            saving={saving}
            onEdit={() => openEditConsent(row)}
            onToggle={() => void toggleConsent(row)}
          />
        ),
      },
    ],
    [openEditConsent, saving, toggleConsent],
  );

  if (loading) {
    return <div className="admin-state">Partner başvuru uyumu yükleniyor...</div>;
  }

  const isDocumentTab = tab === 'documents';
  const editing = Boolean(drawer?.editingId);
  const drawerTitle =
    drawer?.kind === 'document'
      ? editing
        ? 'Belge Gereksinimini Düzenle'
        : 'Belge Gereksinimi Ekle'
      : drawer?.kind === 'consent'
        ? editing
          ? 'Başvuru Onayını Düzenle'
          : 'Başvuru Onayı Ekle'
        : '';

  return (
    <div className="admin-stack">
      <div className="admin-card" style={{ borderColor: '#f0ca73', background: '#fff9ed' }}>
        <div className="admin-card__body">
          <strong>Bu alan partner başvuru uyumunu yönetir.</strong>{' '}
          Üretime geçmeden önce ülke/dil bazlı belge ve onay metinleri hukuk/operasyon ekibi
          tarafından doğrulanmalıdır. Müşteri checkout yasal metinleri bu ekrandan yönetilmez.
        </div>
      </div>

      {!brandingLoaded && (
        <div className="admin-state">Platform ülke/dil bilgisi yükleniyor...</div>
      )}
      {brandingLoaded && !canCreate && (
        <div className="admin-card" style={{ borderColor: '#e2b6b6', background: '#fdf2f2' }}>
          <div className="admin-card__body">
            Aktif kurulum profili (ülke/dil) okunamadı. Yeni tanım eklemek için platform
            kurulumunun tamamlanmış olması gerekir. Mevcut kayıtlar yine de görüntülenip
            düzenlenebilir.
          </div>
        </div>
      )}
      {error && <div className="admin-state">{error}</div>}

      <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as CatalogTab)} />

      <div className="admin-row" style={{ justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="admin-button admin-button--primary"
          disabled={!canCreate || saving}
          onClick={isDocumentTab ? openNewDocument : openNewConsent}
          title={!canCreate ? 'Platform kurulum profili gerekli' : undefined}
        >
          <Icon.plus width={16} height={16} />
          {isDocumentTab ? 'Belge gereksinimi ekle' : 'Başvuru onayı ekle'}
        </button>
      </div>

      {isDocumentTab ? (
        <DataTable
          columns={documentColumns}
          rows={documents}
          rowKey={(row) => row.id}
          onRowClick={(row) => openEditDocument(row)}
          empty="Henüz belge gereksinimi tanımlanmadı."
          footer={<span>{documents.length} belge gereksinimi</span>}
        />
      ) : (
        <DataTable
          columns={consentColumns}
          rows={consents}
          rowKey={(row) => row.id}
          onRowClick={(row) => openEditConsent(row)}
          empty="Henüz başvuru onayı tanımlanmadı."
          footer={<span>{consents.length} başvuru onayı</span>}
        />
      )}

      <Drawer
        open={drawer?.kind === 'document'}
        onClose={closeDrawer}
        title={drawer?.kind === 'document' ? drawerTitle : ''}
        subtitle="Partner başvurusunda istenecek belge"
        footer={
          <>
            <button
              type="submit"
              form="compliance-document-form"
              className="admin-button admin-button--primary"
              disabled={saving}
            >
              {saving ? 'Kaydediliyor...' : editing ? 'Değişiklikleri kaydet' : 'Tanımı ekle'}
            </button>
            <button type="button" className="admin-button" disabled={saving} onClick={closeDrawer}>
              İptal
            </button>
          </>
        }
      >
        <form id="compliance-document-form" className="admin-stack" onSubmit={saveDocument} style={{ gap: 12 }}>
          <div style={fieldGridStyle}>
            <TextField label="Ülke" value={documentDraft.country} onChange={(value) => setDocumentDraft((d) => ({ ...d, country: value }))} required />
            <TextField label="Dil" value={documentDraft.language} onChange={(value) => setDocumentDraft((d) => ({ ...d, language: value }))} required />
            <TextField label="Belge tipi" value={documentDraft.documentType} onChange={(value) => setDocumentDraft((d) => ({ ...d, documentType: value }))} required />
            <TextField label="Sıralama" value={String(documentDraft.sortOrder)} type="number" onChange={(value) => setDocumentDraft((d) => ({ ...d, sortOrder: Number(value) }))} required />
          </div>
          <TextField label="Görünen ad" value={documentDraft.label} onChange={(value) => setDocumentDraft((d) => ({ ...d, label: value }))} required />
          <TextArea label="Açıklama" value={documentDraft.description} onChange={(value) => setDocumentDraft((d) => ({ ...d, description: value }))} required />
          <TextField label="Kabul edilen uzantılar (virgülle ayırın)" value={documentDraft.acceptedFormats.join(', ')} onChange={(value) => setDocumentDraft((d) => ({ ...d, acceptedFormats: value.split(',').map((part) => part.trim()).filter(Boolean) }))} required />
          <div className="admin-row">
            <CheckField label="Gerekli belge" checked={documentDraft.required} onChange={(checked) => setDocumentDraft((d) => ({ ...d, required: checked }))} />
            <CheckField label="Yalnız yönlendirme" checked={documentDraft.guidanceOnly} onChange={(checked) => setDocumentDraft((d) => ({ ...d, guidanceOnly: checked }))} />
            <CheckField label="Etkin" checked={documentDraft.active} onChange={(checked) => setDocumentDraft((d) => ({ ...d, active: checked }))} />
          </div>
        </form>
      </Drawer>

      <Drawer
        open={drawer?.kind === 'consent'}
        onClose={closeDrawer}
        title={drawer?.kind === 'consent' ? drawerTitle : ''}
        subtitle="Partner başvurusunda gösterilecek onay kutusu"
        footer={
          <>
            <button
              type="submit"
              form="compliance-consent-form"
              className="admin-button admin-button--primary"
              disabled={saving}
            >
              {saving ? 'Kaydediliyor...' : editing ? 'Değişiklikleri kaydet' : 'Tanımı ekle'}
            </button>
            <button type="button" className="admin-button" disabled={saving} onClick={closeDrawer}>
              İptal
            </button>
          </>
        }
      >
        <form id="compliance-consent-form" className="admin-stack" onSubmit={saveConsent} style={{ gap: 12 }}>
          <div style={fieldGridStyle}>
            <TextField label="Ülke" value={consentDraft.country} disabled={editing} onChange={(value) => setConsentDraft((d) => ({ ...d, country: value }))} required />
            <TextField label="Dil" value={consentDraft.language} disabled={editing} onChange={(value) => setConsentDraft((d) => ({ ...d, language: value }))} required />
            <TextField label="Onay anahtarı" value={consentDraft.consentKey} disabled={editing} onChange={(value) => setConsentDraft((d) => ({ ...d, consentKey: value }))} required />
            <TextField label="Sıralama" value={String(consentDraft.sortOrder)} type="number" onChange={(value) => setConsentDraft((d) => ({ ...d, sortOrder: Number(value) }))} required />
            <TextField label="Belge kodu" value={consentDraft.documentCode} disabled={editing} onChange={(value) => setConsentDraft((d) => ({ ...d, documentCode: value }))} required />
            <TextField label="Belge sürümü" value={consentDraft.documentVersion} disabled={editing} onChange={(value) => setConsentDraft((d) => ({ ...d, documentVersion: value }))} required />
          </div>
          <TextField label="Görünen ad" value={consentDraft.label} onChange={(value) => setConsentDraft((d) => ({ ...d, label: value }))} required />
          <TextArea label="Açıklama" value={consentDraft.description} onChange={(value) => setConsentDraft((d) => ({ ...d, description: value }))} required />
          <TextField label="Belge bağlantısı (isteğe bağlı)" value={consentDraft.documentUrl ?? ''} type="url" onChange={(value) => setConsentDraft((d) => ({ ...d, documentUrl: value || null }))} />
          <div className="admin-row">
            <CheckField label="Gerekli onay" checked={consentDraft.required} onChange={(checked) => setConsentDraft((d) => ({ ...d, required: checked }))} />
            <CheckField label="Etkin sürüm" checked={consentDraft.active} onChange={(checked) => setConsentDraft((d) => ({ ...d, active: checked }))} />
          </div>
          <div className="admin-card__subtitle">
            Yeni sürüm için yeni bir tanım oluşturun. Yeni tanım etkinleştirildiğinde önceki
            kabuller geçmiş kaydı olarak korunur; yeni gönderimler güncel sürüm için tekrar onay ister.
          </div>
        </form>
      </Drawer>
    </div>
  );
}

const fieldGridStyle = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
};

function RowActions({
  active,
  saving,
  onEdit,
  onToggle,
}: {
  active: boolean;
  saving: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="admin-row" style={{ gap: 6, justifyContent: 'flex-end' }} onClick={(event) => event.stopPropagation()}>
      <button className="admin-icon-button" type="button" disabled={saving} title="Düzenle" aria-label="Düzenle" onClick={onEdit}>
        <Icon.edit width={16} height={16} />
      </button>
      <button className="admin-icon-button" type="button" disabled={saving} title="Ayarlar" aria-label="Ayarlar" onClick={onEdit}>
        <Icon.settings width={16} height={16} />
      </button>
      <button
        className="admin-icon-button"
        type="button"
        disabled={saving}
        title={active ? 'Pasifleştir' : 'Aktifleştir'}
        aria-label={active ? 'Pasifleştir' : 'Aktifleştir'}
        onClick={onToggle}
      >
        <Icon.power width={16} height={16} />
      </button>
    </div>
  );
}

function TextField({ label, value, onChange, required, disabled, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; disabled?: boolean; type?: string }) {
  return (
    <label className="admin-field">
      <span className="admin-field__label">{label}</span>
      <input className="admin-input" type={type} value={value} required={required} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="admin-field">
      <span className="admin-field__label">{label}</span>
      <textarea className="admin-textarea" value={value} required={required} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="admin-row" style={{ gap: 8 }}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
