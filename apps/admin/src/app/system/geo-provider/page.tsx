'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { PageHeader, SectionCard, StatusBadge } from '@/components/ui';
import { Icon } from '@/lib/icons';
import {
  getGeoProviderConfig,
  setGeoProvider,
  type GeoProviderConfig,
  type GeoProviderId,
} from '@/lib/admin-api/platform-settings-client';
import { readAdminSession } from '@/lib/storage/admin-session';

type LoadState = 'idle' | 'loading' | 'saving' | 'error';

export default function AdminGeoProviderPage() {
  const [config, setConfig] = useState<GeoProviderConfig | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GeoProviderId>('locationiq');
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const load = useCallback(() => {
    const session = readAdminSession();
    if (!session) {
      setError('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
      setState('error');
      return;
    }
    setState('loading');
    setError(null);
    void getGeoProviderConfig(session)
      .then((next) => {
        setConfig(next);
        setSelected(next.provider);
        setState('idle');
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Geo provider yapılandırması yüklenemedi.');
        setState('error');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSave = useCallback(async () => {
    const session = readAdminSession();
    if (!session) {
      setError('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
      setState('error');
      return;
    }
    setState('saving');
    setError(null);
    try {
      const next = await setGeoProvider(session, selected);
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              provider: next.provider,
              apiKeyConfigured: next.apiKeyConfigured,
              active: next.active,
            }
          : prev,
      );
      setSavedAt(new Date());
      setState('idle');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Geo provider kaydedilemedi.');
      setState('error');
    }
  }, [selected]);

  const dirty = config?.provider !== selected;

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'Sistem' }, { label: 'Geo Provider' }]}
          title="Adres Arama Servisi"
          description="Tenant başvuru formunda adres aramasını besleyen üçüncü taraf sağlayıcı seçimi. API anahtarı yalnızca sunucuda saklanır; bu sayfa anahtarın değerini göstermez."
        />

        <SectionCard
          title="Aktif sağlayıcı"
          subtitle="Tenant ve müşteri adres aramaları seçilen sağlayıcıya yönlendirilir. 'Devre dışı' seçilirse adres arama özelliği kullanılamaz."
        >
          {state === 'loading' ? (
            <p className="admin-list-row__meta">Yapılandırma yükleniyor…</p>
          ) : null}

          {error ? (
            <p className="mt-2 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-[13px] text-danger-700">
              {error}
            </p>
          ) : null}

          {config ? (
            <div className="admin-stack" style={{ gap: 16 }}>
              <div className="admin-row" style={{ gap: 10 }}>
                <span className="admin-list-row__title">Mevcut seçim:</span>
                <span className="admin-tag">
                  <Icon.globe width={12} height={12} />
                  {config.availableProviders.find((p) => p.id === config.provider)?.label ?? config.provider}
                </span>
                {config.active ? (
                  <StatusBadge tone="success" label="Aktif" />
                ) : config.provider === 'none' ? (
                  <StatusBadge tone="neutral" label="Devre dışı" />
                ) : (
                  <StatusBadge tone="danger" label="API anahtarı eksik" />
                )}
              </div>

              <div>
                <label htmlFor="geo-provider-select" className="admin-list-row__title" style={{ display: 'block', marginBottom: 6 }}>
                  Sağlayıcı seçin
                </label>
                <select
                  id="geo-provider-select"
                  className="admin-input admin-login-input"
                  style={{ maxWidth: 320 }}
                  disabled={state === 'saving'}
                  value={selected}
                  onChange={(event) => setSelected(event.target.value as GeoProviderId)}
                >
                  {config.availableProviders.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {selected === 'locationiq' && !config.apiKeyConfigured ? (
                  <p className="mt-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-[12.5px] text-warning-800">
                    LocationIQ API anahtarı sunucu ortamında ayarlanmamış. Sağlayıcı bu haliyle çağrı yapamaz — operatör <code>LOCATIONIQ_API_KEY</code> environment değişkenini sağlamalı.
                  </p>
                ) : null}
              </div>

              <div className="admin-row" style={{ gap: 10 }}>
                <button
                  type="button"
                  className="admin-button admin-button--primary"
                  disabled={!dirty || state === 'saving'}
                  onClick={() => void onSave()}
                >
                  {state === 'saving' ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
                {savedAt ? (
                  <span className="admin-list-row__meta">
                    Son kayıt: {savedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Notlar"
          subtitle="API anahtarları sunucu ortam değişkenlerinden okunur. Bu panel anahtar değerini ne gösterir ne değiştirir; yalnızca aktif sağlayıcı seçimini düzenler."
        >
          <ul className="admin-stack" style={{ gap: 6 }}>
            <li className="admin-list-row__meta">• Sağlayıcı seçimi <code>SystemSetting.geo.provider</code> kaydında tutulur.</li>
            <li className="admin-list-row__meta">• 'Devre dışı' seçilirse tenant başvuru formundaki adres arama servisi hata verir ve manuel yazıma düşer.</li>
            <li className="admin-list-row__meta">• Sağlayıcı değişiklikleri sonraki backend isteğinden itibaren geçerli olur (in-memory cache 1 PUT ile sıfırlanır).</li>
          </ul>
        </SectionCard>
      </div>
    </AdminShell>
  );
}
