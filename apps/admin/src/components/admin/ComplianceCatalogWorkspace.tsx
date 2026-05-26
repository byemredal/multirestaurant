'use client';

import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { SectionCard, Tabs } from '@/components/ui';
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

const emptyDocument: ComplianceDocumentRequirementInput = {
  country: 'CH',
  language: 'de-CH',
  documentType: '',
  label: '',
  description: 'Üretime geçmeden önce hukuk ekibi tarafından doğrulanmalıdır.',
  required: false,
  acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
  guidanceOnly: true,
  active: true,
  sortOrder: 10,
};

const emptyConsent: ComplianceConsentDefinitionInput = {
  country: 'CH',
  language: 'de-CH',
  consentKey: '',
  label: '',
  description: 'Nihai metin hukuk incelemesinden sonra yayımlanacaktır.',
  documentCode: '',
  documentVersion: 'placeholder-v1',
  documentUrl: null,
  required: true,
  active: false,
  sortOrder: 10,
};

export default function ComplianceCatalogWorkspace() {
  const [tab, setTab] = useState<CatalogTab>('documents');
  const [documents, setDocuments] = useState<ComplianceDocumentRequirement[]>([]);
  const [consents, setConsents] = useState<ComplianceConsentDefinition[]>([]);
  const [documentDraft, setDocumentDraft] = useState<ComplianceDocumentRequirementInput>(emptyDocument);
  const [consentDraft, setConsentDraft] = useState<ComplianceConsentDefinitionInput>(emptyConsent);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editingConsentId, setEditingConsentId] = useState<string | null>(null);
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
          setError(caught instanceof Error ? caught.message : 'Compliance kataloğu yüklenemedi.');
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

  const tabs = useMemo(() => [
    { id: 'documents', label: 'Belge gereksinimleri', count: documents.length },
    { id: 'consents', label: 'Onay tanımları', count: consents.length },
  ], [consents.length, documents.length]);

  const saveDocument = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const session = await requireAdminSession();
      if (editingDocumentId) {
        await updateComplianceDocumentRequirement(session, editingDocumentId, documentDraft);
      } else {
        await createComplianceDocumentRequirement(session, documentDraft);
      }
      setDocumentDraft(emptyDocument);
      setEditingDocumentId(null);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Belge tanımı kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }, [documentDraft, editingDocumentId, reload]);

  const saveConsent = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const session = await requireAdminSession();
      if (editingConsentId) {
        await updateComplianceConsentDefinition(session, editingConsentId, consentDraft);
      } else {
        await createComplianceConsentDefinition(session, consentDraft);
      }
      setConsentDraft(emptyConsent);
      setEditingConsentId(null);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Onay tanımı kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }, [consentDraft, editingConsentId, reload]);

  const toggleDocument = useCallback(async (entry: ComplianceDocumentRequirement) => {
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
  }, [reload]);

  const toggleConsent = useCallback(async (entry: ComplianceConsentDefinition) => {
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
  }, [reload]);

  if (loading) {
    return <div className="admin-state">Compliance kataloğu yükleniyor...</div>;
  }

  return (
    <div className="admin-stack">
      <div className="admin-card" style={{ borderColor: '#f0ca73', background: '#fff9ed' }}>
        <div className="admin-card__body">
          <strong>Üretim uyarısı:</strong>{' '}
          Yer tutucu compliance tanımları üretime alınmadan önce hukuk ve ürün ekipleri tarafından incelenmelidir.
        </div>
      </div>
      {error && <div className="admin-state">{error}</div>}
      <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as CatalogTab)} />
      {tab === 'documents' ? (
        <>
          <SectionCard title={editingDocumentId ? 'Belge gereksinimini düzenle' : 'Yeni belge gereksinimi'}>
            <form className="admin-stack" onSubmit={saveDocument} style={{ gap: 12 }}>
              <div style={fieldGridStyle}>
                <TextField label="Ülke" value={documentDraft.country} onChange={(value) => setDocumentDraft((draft) => ({ ...draft, country: value }))} required />
                <TextField label="Dil" value={documentDraft.language} onChange={(value) => setDocumentDraft((draft) => ({ ...draft, language: value }))} required />
                <TextField label="Belge tipi" value={documentDraft.documentType} onChange={(value) => setDocumentDraft((draft) => ({ ...draft, documentType: value }))} required />
                <TextField label="Sıralama" value={String(documentDraft.sortOrder)} type="number" onChange={(value) => setDocumentDraft((draft) => ({ ...draft, sortOrder: Number(value) }))} required />
              </div>
              <TextField label="Görünen ad" value={documentDraft.label} onChange={(value) => setDocumentDraft((draft) => ({ ...draft, label: value }))} required />
              <TextArea label="Açıklama" value={documentDraft.description} onChange={(value) => setDocumentDraft((draft) => ({ ...draft, description: value }))} required />
              <TextField label="Kabul edilen uzantılar (virgülle ayırın)" value={documentDraft.acceptedFormats.join(', ')} onChange={(value) => setDocumentDraft((draft) => ({ ...draft, acceptedFormats: value.split(',').map((part) => part.trim()).filter(Boolean) }))} required />
              <div className="admin-row">
                <CheckField label="Gerekli belge" checked={documentDraft.required} onChange={(checked) => setDocumentDraft((draft) => ({ ...draft, required: checked }))} />
                <CheckField label="Yalnız yönlendirme" checked={documentDraft.guidanceOnly} onChange={(checked) => setDocumentDraft((draft) => ({ ...draft, guidanceOnly: checked }))} />
                <CheckField label="Etkin" checked={documentDraft.active} onChange={(checked) => setDocumentDraft((draft) => ({ ...draft, active: checked }))} />
              </div>
              <FormActions saving={saving} editing={Boolean(editingDocumentId)} onCancel={() => { setEditingDocumentId(null); setDocumentDraft(emptyDocument); }} />
            </form>
          </SectionCard>
          <DefinitionList>
            {documents.map((entry) => (
              <DefinitionRow
                key={entry.id}
                title={entry.label}
                meta={`${entry.country} / ${entry.language} - ${entry.documentType} - ${entry.acceptedFormats.join(', ')}`}
                active={entry.active}
                detail={`${entry.required ? 'Gerekli' : 'İsteğe bağlı'}${entry.guidanceOnly ? ' - Yalnız yönlendirme' : ''}`}
                saving={saving}
                onEdit={() => { setEditingDocumentId(entry.id); setDocumentDraft({ ...entry }); }}
                onToggle={() => void toggleDocument(entry)}
              />
            ))}
          </DefinitionList>
        </>
      ) : (
        <>
          <SectionCard title={editingConsentId ? 'Onay tanımını düzenle' : 'Yeni onay tanımı'}>
            <form className="admin-stack" onSubmit={saveConsent} style={{ gap: 12 }}>
              <div style={fieldGridStyle}>
                <TextField label="Ülke" value={consentDraft.country} disabled={Boolean(editingConsentId)} onChange={(value) => setConsentDraft((draft) => ({ ...draft, country: value }))} required />
                <TextField label="Dil" value={consentDraft.language} disabled={Boolean(editingConsentId)} onChange={(value) => setConsentDraft((draft) => ({ ...draft, language: value }))} required />
                <TextField label="Onay anahtarı" value={consentDraft.consentKey} disabled={Boolean(editingConsentId)} onChange={(value) => setConsentDraft((draft) => ({ ...draft, consentKey: value }))} required />
                <TextField label="Sıralama" value={String(consentDraft.sortOrder)} type="number" onChange={(value) => setConsentDraft((draft) => ({ ...draft, sortOrder: Number(value) }))} required />
                <TextField label="Belge kodu" value={consentDraft.documentCode} disabled={Boolean(editingConsentId)} onChange={(value) => setConsentDraft((draft) => ({ ...draft, documentCode: value }))} required />
                <TextField label="Belge sürümü" value={consentDraft.documentVersion} disabled={Boolean(editingConsentId)} onChange={(value) => setConsentDraft((draft) => ({ ...draft, documentVersion: value }))} required />
              </div>
              <TextField label="Görünen ad" value={consentDraft.label} onChange={(value) => setConsentDraft((draft) => ({ ...draft, label: value }))} required />
              <TextArea label="Açıklama" value={consentDraft.description} onChange={(value) => setConsentDraft((draft) => ({ ...draft, description: value }))} required />
              <TextField label="Belge bağlantısı (isteğe bağlı)" value={consentDraft.documentUrl ?? ''} type="url" onChange={(value) => setConsentDraft((draft) => ({ ...draft, documentUrl: value || null }))} />
              <div className="admin-row">
                <CheckField label="Gerekli onay" checked={consentDraft.required} onChange={(checked) => setConsentDraft((draft) => ({ ...draft, required: checked }))} />
                <CheckField label="Etkin sürüm" checked={consentDraft.active} onChange={(checked) => setConsentDraft((draft) => ({ ...draft, active: checked }))} />
              </div>
              <div className="admin-card__subtitle">
                Yeni sürüm için yeni bir tanım oluşturun. Yeni tanım etkinleştirildiğinde önceki kabuller geçmiş kaydı olarak korunur; yeni gönderimler güncel sürüm için tekrar onay ister.
              </div>
              <FormActions saving={saving} editing={Boolean(editingConsentId)} onCancel={() => { setEditingConsentId(null); setConsentDraft(emptyConsent); }} />
            </form>
          </SectionCard>
          <DefinitionList>
            {consents.map((entry) => (
              <DefinitionRow
                key={entry.id}
                title={entry.label}
                meta={`${entry.country} / ${entry.language} - ${entry.documentCode} - ${entry.documentVersion}`}
                active={entry.active}
                detail={entry.required ? 'Gerekli onay' : 'İsteğe bağlı onay'}
                saving={saving}
                onEdit={() => { setEditingConsentId(entry.id); setConsentDraft({ ...entry }); }}
                onToggle={() => void toggleConsent(entry)}
              />
            ))}
          </DefinitionList>
        </>
      )}
    </div>
  );
}

const fieldGridStyle = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
};

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

function FormActions({ saving, editing, onCancel }: { saving: boolean; editing: boolean; onCancel: () => void }) {
  return (
    <div className="admin-row">
      <button className="admin-button admin-button--primary" disabled={saving} type="submit">
        {saving ? 'Kaydediliyor...' : editing ? 'Değişiklikleri kaydet' : 'Tanımı ekle'}
      </button>
      {editing && <button className="admin-button" disabled={saving} type="button" onClick={onCancel}>İptal</button>}
    </div>
  );
}

function DefinitionList({ children }: { children: ReactNode }) {
  return <SectionCard title="Kayıtlı tanımlar" flush><div className="admin-list">{children}</div></SectionCard>;
}

function DefinitionRow({ title, meta, detail, active, saving, onEdit, onToggle }: { title: string; meta: string; detail: string; active: boolean; saving: boolean; onEdit: () => void; onToggle: () => void }) {
  return (
    <div className="admin-list-row">
      <div>
        <div className="admin-list-row__title">{title}</div>
        <div className="admin-list-row__meta">{meta}</div>
        <div className="admin-card__subtitle">{detail}</div>
      </div>
      <div className="admin-row">
        <span className="admin-tag">{active ? 'Etkin' : 'Pasif'}</span>
        <button className="admin-button admin-button--sm" disabled={saving} type="button" onClick={onEdit}>Düzenle</button>
        <button className="admin-button admin-button--sm" disabled={saving} type="button" onClick={onToggle}>{active ? 'Pasifleştir' : 'Etkinleştir'}</button>
      </div>
    </div>
  );
}
