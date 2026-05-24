'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import TenantDashboardShell from '@/components/tenant/TenantDashboardShell';
import { Button } from '@lieferzonen/ui';
import { Input } from '@lieferzonen/ui';
import { Select } from '@lieferzonen/ui';
import { Textarea } from '@lieferzonen/ui';
import { useTenantAuth } from '@/lib/auth/tenant-auth-context';
import {
  getTenantStoreDeliveryFeeTiers,
  getTenantStoreOrderingPolicy,
  getTenantStorePaymentMethods,
  getTenantStoreReceiptSettings,
  getTenantStoreSettings,
  getTenantStoreTaxSettings,
  listTenantStores,
  TENANT_PAYMENT_METHODS,
  replaceTenantStoreDeliveryFeeTiers,
  replaceTenantStorePaymentMethods,
  updateTenantStoreOrderingPolicy,
  updateTenantStoreReceiptSettings,
  updateTenantStoreSettings,
  updateTenantStoreTaxSettings,
  type TenantPaymentMethodCode,
  type TenantStoreDeliveryFeeTier,
  type TenantStoreOrderingPolicy,
  type TenantStorePaymentMethod,
  type TenantStoreReceiptSetting,
  type TenantStoreSetting,
  type TenantStoreTaxSetting,
} from '@/lib/tenant-client';
import type { StoredTenantSession } from '@/lib/storage/tenant-session';
import { cn } from '@lieferzonen/ui';

type StoreSummary = {
  id: string;
  name: string;
  slug: string;
  category: string;
  status?: string;
};

type SaveState = 'idle' | 'saving' | 'saved';

type GeneralForm = {
  primaryLanguage: string;
  serviceMode: TenantStoreSetting['serviceMode'];
  themeKey: string;
  logoUrl: string;
  bannerUrl: string;
  currencyCode: string;
};

type TaxForm = {
  taxRegistrationNumber: string;
  priceIncludesTax: boolean;
  defaultVatRate: string;
  serviceChargeRate: string;
  invoiceFooterText: string;
};

type ReceiptForm = {
  headerText: string;
  footerText: string;
  showTaxBreakdown: boolean;
  showQrCode: boolean;
};

type PaymentMethodFormEntry = {
  method: TenantPaymentMethodCode;
  label: string;
  isActive: boolean;
};

type OrderingPolicyForm = {
  minOrderAmount: string;
  acceptsDelivery: boolean;
  acceptsPickup: boolean;
  currencyCode: string;
};

type DeliveryFeeTierForm = {
  id: string;
  minDistanceKm: string;
  maxDistanceKm: string;
  feeAmount: string;
  isActive: boolean;
};

function emptyPaymentMethodForms(): PaymentMethodFormEntry[] {
  return TENANT_PAYMENT_METHODS.map((entry) => ({
    method: entry.code,
    label: entry.defaultLabel,
    isActive: entry.code === 'cash',
  }));
}

function emptyOrderingPolicyForm(): OrderingPolicyForm {
  return {
    minOrderAmount: '0',
    acceptsDelivery: true,
    acceptsPickup: true,
    currencyCode: 'CHF',
  };
}

function newTierRowId() {
  return `local-${Math.random().toString(36).slice(2, 11)}`;
}

function emptyGeneralForm(): GeneralForm {
  return {
    primaryLanguage: 'tr',
    serviceMode: 'delivery_and_pickup',
    themeKey: 'classic-light',
    logoUrl: '',
    bannerUrl: '',
    currencyCode: 'CHF',
  };
}

function emptyTaxForm(): TaxForm {
  return {
    taxRegistrationNumber: '',
    priceIncludesTax: true,
    defaultVatRate: '0',
    serviceChargeRate: '0',
    invoiceFooterText: '',
  };
}

function emptyReceiptForm(): ReceiptForm {
  return {
    headerText: '',
    footerText: '',
    showTaxBreakdown: true,
    showQrCode: false,
  };
}

function SectionCard({
  title,
  description,
  children,
  toolbar,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  toolbar?: React.ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-[#ece2d2] bg-white p-5 shadow-[0_8px_24px_rgba(28,25,23,0.04)] lg:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-bold text-[#1c1917]">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-[12.5px] text-[#78716c]">{description}</p>
          ) : null}
        </div>
        {toolbar}
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#a8a29e]">
      {children}
    </span>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      {children}
      {hint ? <span className="text-[11.5px] text-[#a8a29e]">{hint}</span> : null}
    </label>
  );
}

function SaveButton({ state, disabled, onClick, idleLabel = 'Kaydet' }: {
  state: SaveState;
  disabled?: boolean;
  onClick: () => void;
  idleLabel?: string;
}) {
  return (
    <Button onClick={onClick} disabled={disabled || state === 'saving'}>
      {state === 'saving'
        ? 'Kaydediliyor...'
        : state === 'saved'
          ? 'Kaydedildi ✓'
          : idleLabel}
    </Button>
  );
}

export default function TenantStoreSettingsWorkspace() {
  const router = useRouter();
  const { session, logout } = useTenantAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');

  const [generalForm, setGeneralForm] = useState<GeneralForm>(emptyGeneralForm());
  const [generalSaveState, setGeneralSaveState] = useState<SaveState>('idle');

  const [taxForm, setTaxForm] = useState<TaxForm>(emptyTaxForm());
  const [taxSaveState, setTaxSaveState] = useState<SaveState>('idle');

  const [receiptForm, setReceiptForm] = useState<ReceiptForm>(emptyReceiptForm());
  const [receiptSaveState, setReceiptSaveState] = useState<SaveState>('idle');

  const [paymentMethodForms, setPaymentMethodForms] = useState<PaymentMethodFormEntry[]>(
    emptyPaymentMethodForms(),
  );
  const [paymentMethodsSaveState, setPaymentMethodsSaveState] = useState<SaveState>('idle');

  const [orderingPolicyForm, setOrderingPolicyForm] = useState<OrderingPolicyForm>(
    emptyOrderingPolicyForm(),
  );
  const [orderingPolicySaveState, setOrderingPolicySaveState] = useState<SaveState>('idle');

  const [feeTierForms, setFeeTierForms] = useState<DeliveryFeeTierForm[]>([]);
  const [feeTiersSaveState, setFeeTiersSaveState] = useState<SaveState>('idle');

  const selectedStore = useMemo(
    () => stores.find((store) => store.id === selectedStoreId) ?? null,
    [stores, selectedStoreId],
  );

  // TenantGate guarantees an authenticated ACTIVE session here.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void (async () => {
      try {
        const nextStores = (await listTenantStores(session)) as StoreSummary[];
        if (cancelled) return;
        setStores(nextStores);
        setSelectedStoreId(nextStores[0]?.id ?? '');
      } catch {
        if (!cancelled) setError('Restoranlar yüklenemedi.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    const loadSettings = async () => {
      if (!session || !selectedStoreId) return;
      try {
        setLoading(true);
        setError(null);
        const [general, tax, receipt, paymentMethods, orderingPolicy, feeTiers] =
          await Promise.all([
            getTenantStoreSettings(session, selectedStoreId),
            getTenantStoreTaxSettings(session, selectedStoreId),
            getTenantStoreReceiptSettings(session, selectedStoreId),
            getTenantStorePaymentMethods(session, selectedStoreId),
            getTenantStoreOrderingPolicy(session, selectedStoreId),
            getTenantStoreDeliveryFeeTiers(session, selectedStoreId),
          ]);
        hydrateGeneral(general);
        hydrateTax(tax);
        hydrateReceipt(receipt);
        hydratePaymentMethods(paymentMethods.paymentMethods);
        hydrateOrderingPolicy(orderingPolicy);
        hydrateFeeTiers(feeTiers.deliveryFeeTiers);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : 'Ayarlar yüklenemedi.',
        );
      } finally {
        setLoading(false);
      }
    };
    void loadSettings();
  }, [selectedStoreId, session]);

  function hydratePaymentMethods(methods: TenantStorePaymentMethod[]) {
    const byCode = new Map(methods.map((entry) => [entry.method, entry]));
    setPaymentMethodForms(
      TENANT_PAYMENT_METHODS.map((entry) => {
        const persisted = byCode.get(entry.code);
        return {
          method: entry.code,
          label: persisted?.label ?? entry.defaultLabel,
          isActive: persisted?.isActive ?? false,
        };
      }),
    );
    setPaymentMethodsSaveState('idle');
  }

  function hydrateOrderingPolicy(policy: TenantStoreOrderingPolicy) {
    setOrderingPolicyForm({
      minOrderAmount: String(policy.minOrderAmount ?? 0),
      acceptsDelivery: policy.acceptsDelivery,
      acceptsPickup: policy.acceptsPickup,
      currencyCode: policy.currencyCode || 'CHF',
    });
    setOrderingPolicySaveState('idle');
  }

  function hydrateFeeTiers(tiers: TenantStoreDeliveryFeeTier[]) {
    setFeeTierForms(
      tiers.map((tier) => ({
        id: tier.id,
        minDistanceKm: String(tier.minDistanceKm ?? 0),
        maxDistanceKm: String(tier.maxDistanceKm ?? 0),
        feeAmount: String(tier.feeAmount ?? 0),
        isActive: tier.isActive,
      })),
    );
    setFeeTiersSaveState('idle');
  }

  function hydrateGeneral(setting: TenantStoreSetting) {
    const themeKey =
      typeof setting.advancedOptionsJson?.themeKey === 'string'
        ? (setting.advancedOptionsJson.themeKey as string)
        : 'classic-light';
    const logoUrl =
      typeof setting.advancedOptionsJson?.logoUrl === 'string'
        ? (setting.advancedOptionsJson.logoUrl as string)
        : '';
    const bannerUrl =
      typeof setting.advancedOptionsJson?.bannerUrl === 'string'
        ? (setting.advancedOptionsJson.bannerUrl as string)
        : '';

    setGeneralForm({
      primaryLanguage: setting.primaryLanguage,
      serviceMode: setting.serviceMode,
      themeKey,
      logoUrl,
      bannerUrl,
      currencyCode: setting.currencyCode || 'CHF',
    });
    setGeneralSaveState('idle');
  }

  function hydrateTax(setting: TenantStoreTaxSetting) {
    setTaxForm({
      taxRegistrationNumber: setting.taxRegistrationNumber ?? '',
      priceIncludesTax: setting.priceIncludesTax,
      defaultVatRate: String(setting.defaultVatRate ?? 0),
      serviceChargeRate: String(setting.serviceChargeRate ?? 0),
      invoiceFooterText: setting.invoiceFooterText ?? '',
    });
    setTaxSaveState('idle');
  }

  function hydrateReceipt(setting: TenantStoreReceiptSetting) {
    setReceiptForm({
      headerText: setting.headerText ?? '',
      footerText: setting.footerText ?? '',
      showTaxBreakdown: setting.showTaxBreakdown,
      showQrCode: setting.showQrCode,
    });
    setReceiptSaveState('idle');
  }

  async function saveGeneral() {
    if (!session || !selectedStoreId) return;
    try {
      setGeneralSaveState('saving');
      setError(null);
      const next = await updateTenantStoreSettings(session, selectedStoreId, {
        primaryLanguage: generalForm.primaryLanguage.trim() || 'tr',
        serviceMode: generalForm.serviceMode,
        currencyCode: generalForm.currencyCode.trim() || 'CHF',
        advancedOptionsJson: {
          themeKey: generalForm.themeKey.trim() || 'classic-light',
          logoUrl: generalForm.logoUrl.trim() || null,
          bannerUrl: generalForm.bannerUrl.trim() || null,
        },
      });
      hydrateGeneral(next);
      setGeneralSaveState('saved');
      window.setTimeout(() => setGeneralSaveState('idle'), 2000);
    } catch (saveError) {
      setGeneralSaveState('idle');
      setError(saveError instanceof Error ? saveError.message : 'Ayarlar kaydedilemedi.');
    }
  }

  async function saveTax() {
    if (!session || !selectedStoreId) return;
    try {
      setTaxSaveState('saving');
      setError(null);
      const next = await updateTenantStoreTaxSettings(session, selectedStoreId, {
        taxRegistrationNumber: taxForm.taxRegistrationNumber.trim() || null,
        priceIncludesTax: taxForm.priceIncludesTax,
        defaultVatRate: Number(taxForm.defaultVatRate || '0'),
        serviceChargeRate: Number(taxForm.serviceChargeRate || '0'),
        invoiceFooterText: taxForm.invoiceFooterText.trim() || null,
      });
      hydrateTax(next);
      setTaxSaveState('saved');
      window.setTimeout(() => setTaxSaveState('idle'), 2000);
    } catch (saveError) {
      setTaxSaveState('idle');
      setError(saveError instanceof Error ? saveError.message : 'Vergi ayarları kaydedilemedi.');
    }
  }

  async function saveReceipt() {
    if (!session || !selectedStoreId) return;
    try {
      setReceiptSaveState('saving');
      setError(null);
      const next = await updateTenantStoreReceiptSettings(session, selectedStoreId, {
        headerText: receiptForm.headerText.trim() || null,
        footerText: receiptForm.footerText.trim() || null,
        showTaxBreakdown: receiptForm.showTaxBreakdown,
        showQrCode: receiptForm.showQrCode,
      });
      hydrateReceipt(next);
      setReceiptSaveState('saved');
      window.setTimeout(() => setReceiptSaveState('idle'), 2000);
    } catch (saveError) {
      setReceiptSaveState('idle');
      setError(saveError instanceof Error ? saveError.message : 'Fiş ayarları kaydedilemedi.');
    }
  }

  async function savePaymentMethods() {
    if (!session || !selectedStoreId) return;
    const activeMethods = paymentMethodForms.filter((entry) => entry.isActive);
    if (activeMethods.length === 0) {
      setError('En az bir aktif ödeme yöntemi seçmelisiniz.');
      return;
    }
    try {
      setPaymentMethodsSaveState('saving');
      setError(null);
      const next = await replaceTenantStorePaymentMethods(
        session,
        selectedStoreId,
        paymentMethodForms.map((entry, index) => ({
          method: entry.method,
          label: entry.label.trim() || null,
          isActive: entry.isActive,
          sortOrder: index,
        })),
      );
      console.log('Saved payment methods:', next);
      hydratePaymentMethods(next.paymentMethods);
      setPaymentMethodsSaveState('saved');
      window.setTimeout(() => setPaymentMethodsSaveState('idle'), 2000);
    } catch (saveError) {
      setPaymentMethodsSaveState('idle');
      setError(
        saveError instanceof Error ? saveError.message : 'Ödeme yöntemleri kaydedilemedi.',
      );
    }
  }

  async function saveOrderingPolicy() {
    if (!session || !selectedStoreId) return;
    if (!orderingPolicyForm.acceptsDelivery && !orderingPolicyForm.acceptsPickup) {
      setError('Teslimat veya gel-al seçeneklerinden en az birini açık bırakın.');
      return;
    }
    const minOrder = Number(orderingPolicyForm.minOrderAmount || '0');
    if (Number.isNaN(minOrder) || minOrder < 0) {
      setError('Minimum sipariş tutarı geçerli bir sayı olmalı.');
      return;
    }
    try {
      setOrderingPolicySaveState('saving');
      setError(null);
      const next = await updateTenantStoreOrderingPolicy(
        session,
        selectedStoreId,
        {
          minOrderAmount: minOrder,
          acceptsDelivery: orderingPolicyForm.acceptsDelivery,
          acceptsPickup: orderingPolicyForm.acceptsPickup,
          currencyCode: orderingPolicyForm.currencyCode.trim().toUpperCase() || 'CHF',
        },
      );
      hydrateOrderingPolicy(next);
      setOrderingPolicySaveState('saved');
      window.setTimeout(() => setOrderingPolicySaveState('idle'), 2000);
    } catch (saveError) {
      setOrderingPolicySaveState('idle');
      setError(
        saveError instanceof Error ? saveError.message : 'Sipariş kuralları kaydedilemedi.',
      );
    }
  }

  async function saveFeeTiers() {
    if (!session || !selectedStoreId) return;
    const parsed = feeTierForms.map((tier) => ({
      minDistanceKm: Number(tier.minDistanceKm || '0'),
      maxDistanceKm: Number(tier.maxDistanceKm || '0'),
      feeAmount: Number(tier.feeAmount || '0'),
      isActive: tier.isActive,
    }));
    for (const tier of parsed) {
      if (
        Number.isNaN(tier.minDistanceKm) ||
        Number.isNaN(tier.maxDistanceKm) ||
        Number.isNaN(tier.feeAmount)
      ) {
        setError('Tüm mesafe ve ücret değerleri sayı olmalı.');
        return;
      }
      if (tier.minDistanceKm < 0 || tier.maxDistanceKm <= tier.minDistanceKm || tier.feeAmount < 0) {
        setError('Mesafe aralıkları geçerli olmalı (min < max, ücret ≥ 0).');
        return;
      }
    }
    try {
      setFeeTiersSaveState('saving');
      setError(null);
      const next = await replaceTenantStoreDeliveryFeeTiers(
        session,
        selectedStoreId,
        parsed.map((tier, index) => ({
          minDistanceKm: tier.minDistanceKm,
          maxDistanceKm: tier.maxDistanceKm,
          feeAmount: tier.feeAmount,
          sortOrder: index,
          isActive: tier.isActive,
        })),
      );
      hydrateFeeTiers(next.deliveryFeeTiers);
      setFeeTiersSaveState('saved');
      window.setTimeout(() => setFeeTiersSaveState('idle'), 2000);
    } catch (saveError) {
      setFeeTiersSaveState('idle');
      setError(
        saveError instanceof Error ? saveError.message : 'Mesafe bazlı ücretler kaydedilemedi.',
      );
    }
  }

  async function handleSignOut() {
    await logout();
  }

  return (
    <TenantDashboardShell
      companyName={session?.tenant.companyName ?? 'Tenant çalışma alanı'}
      currentHref="/dashboard/settings"
      description="Vitrin, vergi ve fiş ayarları gibi tenantin kendi yönettiği alanlar."
      onSignOut={handleSignOut}
      title="Ayarlar"
      userName={`${session?.tenant.firstName ?? ''} ${session?.tenant.lastName ?? ''}`.trim() || 'Tenant Yönetici'}
    >
      <div className="grid gap-4">
        <div className="rounded-[20px] border border-[#ece2d2] bg-white p-4 shadow-[0_8px_24px_rgba(28,25,23,0.04)] lg:p-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,280px)_1fr] md:items-end">
            <Field label="Restoran">
              <Select
                value={selectedStoreId}
                onChange={(event) => setSelectedStoreId(event.target.value)}
                disabled={stores.length === 0}
              >
                {stores.length === 0 ? <option value="">Restoran yok</option> : null}
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </Select>
            </Field>

            {selectedStore ? (
              <div className="rounded-[14px] bg-[#f7fafd] px-4 py-3 text-[13px] text-[#44403c]">
                <span className="font-semibold text-[#1c1917]">{selectedStore.name}</span>
                {' · '}
                {selectedStore.slug}
                {' · '}
                {selectedStore.category}
              </div>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {error}
          </div>
        ) : null}

        {!selectedStoreId && stores.length === 0 ? (
          <SectionCard
            title="Henüz restoran yok"
            description="Ayarları düzenlemek için önce restoran panelinden bir restoran oluşturun."
          >
            <Button onClick={() => router.push('/dashboard')}>Restoran paneline git</Button>
          </SectionCard>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              title="Vitrin & yerel operasyon"
              description="Dil, hizmet modu, tema ve görsel ayarları."
            >
              {loading ? (
                <div className="text-[13px] text-[#78716c]">Ayarlar yükleniyor...</div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Birincil dil" hint="ör. tr, en, de">
                      <Input
                        value={generalForm.primaryLanguage}
                        onChange={(event) =>
                          setGeneralForm((current) => ({
                            ...current,
                            primaryLanguage: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Para birimi">
                      <Select
                        value={generalForm.currencyCode}
                        onChange={(event) =>
                          setGeneralForm((current) => ({
                            ...current,
                            currencyCode: event.target.value,
                          }))
                        }
                      >
                        <option value="CHF">CHF</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="USD">USD ($)</option>
                        <option value="TRY">TRY (₺)</option>
                      </Select>
                    </Field>
                    <Field label="Hizmet modu">
                      <Select
                        value={generalForm.serviceMode}
                        onChange={(event) =>
                          setGeneralForm((current) => ({
                            ...current,
                            serviceMode: event.target.value as TenantStoreSetting['serviceMode'],
                          }))
                        }
                      >
                        <option value="delivery_only">Yalnızca teslimat</option>
                        <option value="pickup_only">Yalnızca gel-al</option>
                        <option value="delivery_and_pickup">Teslimat + gel-al</option>
                        <option value="reservation_only">Yalnızca rezervasyon</option>
                      </Select>
                    </Field>
                    <Field label="Tema">
                      <Select
                        value={generalForm.themeKey}
                        onChange={(event) =>
                          setGeneralForm((current) => ({
                            ...current,
                            themeKey: event.target.value,
                          }))
                        }
                      >
                        <option value="classic-light">Klasik açık</option>
                        <option value="warm-bistro">Sıcak bistro</option>
                        <option value="clean-minimal">Sade minimal</option>
                      </Select>
                    </Field>
                  </div>
                  <Field label="Logo URL">
                    <Input
                      value={generalForm.logoUrl}
                      placeholder="https://..."
                      onChange={(event) =>
                        setGeneralForm((current) => ({
                          ...current,
                          logoUrl: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Banner URL">
                    <Input
                      value={generalForm.bannerUrl}
                      placeholder="https://..."
                      onChange={(event) =>
                        setGeneralForm((current) => ({
                          ...current,
                          bannerUrl: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <SaveButton state={generalSaveState} onClick={() => void saveGeneral()} />
                </>
              )}
            </SectionCard>

            <SectionCard
              title="Vergi ayarları"
              description="KDV, hizmet bedeli ve vergi numarası ile fatura görünümü."
            >
              {loading ? (
                <div className="text-[13px] text-[#78716c]">Yükleniyor...</div>
              ) : (
                <>
                  <Field label="Vergi numarası">
                    <Input
                      value={taxForm.taxRegistrationNumber}
                      placeholder="ör. 1234567890"
                      onChange={(event) =>
                        setTaxForm((current) => ({
                          ...current,
                          taxRegistrationNumber: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Varsayılan KDV (%)">
                      <Input
                        value={taxForm.defaultVatRate}
                        inputMode="decimal"
                        onChange={(event) =>
                          setTaxForm((current) => ({
                            ...current,
                            defaultVatRate: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Hizmet bedeli (%)">
                      <Input
                        value={taxForm.serviceChargeRate}
                        inputMode="decimal"
                        onChange={(event) =>
                          setTaxForm((current) => ({
                            ...current,
                            serviceChargeRate: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 text-[13px] text-[#44403c]">
                    <input
                      type="checkbox"
                      checked={taxForm.priceIncludesTax}
                      onChange={(event) =>
                        setTaxForm((current) => ({
                          ...current,
                          priceIncludesTax: event.target.checked,
                        }))
                      }
                    />
                    Fiyatlar KDV dahil
                  </label>
                  <Field label="Fatura altyazısı">
                    <Textarea
                      rows={2}
                      value={taxForm.invoiceFooterText}
                      placeholder="ör. Teşekkürler — afiyet olsun"
                      onChange={(event) =>
                        setTaxForm((current) => ({
                          ...current,
                          invoiceFooterText: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <SaveButton state={taxSaveState} onClick={() => void saveTax()} />
                </>
              )}
            </SectionCard>

            <SectionCard
              title="Fiş ayarları"
              description="Yazıcıdan çıkan fiş üst/alt yazısı ve gösterim seçenekleri."
            >
              {loading ? (
                <div className="text-[13px] text-[#78716c]">Yükleniyor...</div>
              ) : (
                <>
                  <Field label="Üst yazı">
                    <Textarea
                      rows={2}
                      value={receiptForm.headerText}
                      placeholder="ör. Lieferzonen Store"
                      onChange={(event) =>
                        setReceiptForm((current) => ({
                          ...current,
                          headerText: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Alt yazı">
                    <Textarea
                      rows={2}
                      value={receiptForm.footerText}
                      placeholder="ör. Tekrar bekleriz!"
                      onChange={(event) =>
                        setReceiptForm((current) => ({
                          ...current,
                          footerText: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <div className="flex flex-wrap gap-4 text-[13px] text-[#44403c]">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={receiptForm.showTaxBreakdown}
                        onChange={(event) =>
                          setReceiptForm((current) => ({
                            ...current,
                            showTaxBreakdown: event.target.checked,
                          }))
                        }
                      />
                      KDV dökümünü göster
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={receiptForm.showQrCode}
                        onChange={(event) =>
                          setReceiptForm((current) => ({
                            ...current,
                            showQrCode: event.target.checked,
                          }))
                        }
                      />
                      QR kod ekle
                    </label>
                  </div>
                  <SaveButton state={receiptSaveState} onClick={() => void saveReceipt()} />
                </>
              )}
            </SectionCard>

            <SectionCard
              title="Sipariş kuralları"
              description="Minimum sepet tutarı, teslimat/gel-al kabul durumu."
            >
              {loading ? (
                <div className="text-[13px] text-[#78716c]">Yükleniyor...</div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Minimum sepet" hint="Sipariş için minimum sepet tutarı.">
                      <Input
                        value={orderingPolicyForm.minOrderAmount}
                        inputMode="decimal"
                        onChange={(event) =>
                          setOrderingPolicyForm((current) => ({
                            ...current,
                            minOrderAmount: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Para birimi">
                      <Select
                        value={orderingPolicyForm.currencyCode}
                        onChange={(event) =>
                          setOrderingPolicyForm((current) => ({
                            ...current,
                            currencyCode: event.target.value,
                          }))
                        }
                      >
                        <option value="CHF">CHF</option>
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="TRY">TRY</option>
                      </Select>
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-4 text-[13px] text-[#44403c]">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={orderingPolicyForm.acceptsDelivery}
                        onChange={(event) =>
                          setOrderingPolicyForm((current) => ({
                            ...current,
                            acceptsDelivery: event.target.checked,
                          }))
                        }
                      />
                      Teslimat kabul ediyor
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={orderingPolicyForm.acceptsPickup}
                        onChange={(event) =>
                          setOrderingPolicyForm((current) => ({
                            ...current,
                            acceptsPickup: event.target.checked,
                          }))
                        }
                      />
                      Gel-al kabul ediyor
                    </label>
                  </div>
                  <SaveButton
                    state={orderingPolicySaveState}
                    onClick={() => void saveOrderingPolicy()}
                  />
                </>
              )}
            </SectionCard>

            <SectionCard
              title="Ödeme yöntemleri"
              description="Müşterinin checkout sırasında görüp seçebileceği yöntemler."
            >
              {loading ? (
                <div className="text-[13px] text-[#78716c]">Yükleniyor...</div>
              ) : (
                <>
                  <div className="grid gap-2">
                    {paymentMethodForms.map((entry, index) => (
                      <div
                        key={entry.method}
                        className="grid gap-2 rounded-[14px] border border-[#ece2d2] bg-[#fbf7f1] px-3 py-2 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                      >
                        <label className="flex items-center gap-2 text-[13px] font-semibold text-[#1c1917]">
                          <input
                            type="checkbox"
                            checked={entry.isActive}
                            onChange={(event) =>
                              setPaymentMethodForms((current) =>
                                current.map((c, i) =>
                                  i === index ? { ...c, isActive: event.target.checked } : c,
                                ),
                              )
                            }
                          />
                          {TENANT_PAYMENT_METHODS.find((m) => m.code === entry.method)?.defaultLabel ?? entry.method}
                        </label>
                        <Input
                          value={entry.label}
                          placeholder="Müşteriye görünen etiket"
                          onChange={(event) =>
                            setPaymentMethodForms((current) =>
                              current.map((c, i) =>
                                i === index ? { ...c, label: event.target.value } : c,
                              ),
                            )
                          }
                        />
                        <span className="text-[11px] text-[#a8a29e]">{entry.method}</span>
                      </div>
                    ))}
                  </div>
                  <SaveButton
                    state={paymentMethodsSaveState}
                    onClick={() => void savePaymentMethods()}
                  />
                </>
              )}
            </SectionCard>

            <SectionCard
              title="Mesafe bazlı teslimat ücreti"
              description="Mesafe dilimlerine göre teslimat ücreti. Checkout'ta otomatik hesaplanır."
              toolbar={
                <Button
                  variant="secondary"
                  onClick={() =>
                    setFeeTierForms((current) => [
                      ...current,
                      {
                        id: newTierRowId(),
                        minDistanceKm: '0',
                        maxDistanceKm: '2',
                        feeAmount: '0',
                        isActive: true,
                      },
                    ])
                  }
                >
                  Dilim ekle
                </Button>
              }
            >
              {loading ? (
                <div className="text-[13px] text-[#78716c]">Yükleniyor...</div>
              ) : (
                <>
                  {feeTierForms.length === 0 ? (
                    <p className="rounded-[14px] bg-[#fbf7f1] px-4 py-3 text-[12.5px] text-[#78716c]">
                      Henüz mesafe dilimi yok. Dilim eklemediyseniz teslimat ücreti 0 CHF olur.
                    </p>
                  ) : null}
                  {feeTierForms.map((tier, index) => (
                    <div
                      key={tier.id}
                      className="grid gap-2 rounded-[14px] border border-[#ece2d2] bg-[#fbf7f1] px-3 py-3 sm:grid-cols-[1fr_1fr_1fr_auto_auto] sm:items-end"
                    >
                      <Field label="Min km">
                        <Input
                          value={tier.minDistanceKm}
                          inputMode="decimal"
                          onChange={(event) =>
                            setFeeTierForms((current) =>
                              current.map((c, i) =>
                                i === index ? { ...c, minDistanceKm: event.target.value } : c,
                              ),
                            )
                          }
                        />
                      </Field>
                      <Field label="Max km">
                        <Input
                          value={tier.maxDistanceKm}
                          inputMode="decimal"
                          onChange={(event) =>
                            setFeeTierForms((current) =>
                              current.map((c, i) =>
                                i === index ? { ...c, maxDistanceKm: event.target.value } : c,
                              ),
                            )
                          }
                        />
                      </Field>
                      <Field label="Ücret">
                        <Input
                          value={tier.feeAmount}
                          inputMode="decimal"
                          onChange={(event) =>
                            setFeeTierForms((current) =>
                              current.map((c, i) =>
                                i === index ? { ...c, feeAmount: event.target.value } : c,
                              ),
                            )
                          }
                        />
                      </Field>
                      <label className="flex items-center gap-2 text-[12.5px] text-[#44403c]">
                        <input
                          type="checkbox"
                          checked={tier.isActive}
                          onChange={(event) =>
                            setFeeTierForms((current) =>
                              current.map((c, i) =>
                                i === index ? { ...c, isActive: event.target.checked } : c,
                              ),
                            )
                          }
                        />
                        Aktif
                      </label>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setFeeTierForms((current) => current.filter((_, i) => i !== index))
                        }
                      >
                        Sil
                      </Button>
                    </div>
                  ))}
                  <SaveButton state={feeTiersSaveState} onClick={() => void saveFeeTiers()} />
                </>
              )}
            </SectionCard>

            <SectionCard title="Hesap bilgileri" description="Oturumdaki tenant hesabının özeti.">
              <div className="grid gap-2 text-[13px] text-[#44403c]">
                <div className="rounded-[14px] bg-[#f7fafd] px-4 py-3">
                  <FieldLabel>E-posta</FieldLabel>
                  <div className="mt-1 font-semibold text-[#1c1917]">{session?.tenant.email}</div>
                </div>
                <div className="rounded-[14px] bg-[#f7fafd] px-4 py-3">
                  <FieldLabel>Doğrulama</FieldLabel>
                  <div
                    className={cn(
                      'mt-1 font-semibold',
                      session?.tenant.verificationStatus === 'verified'
                        ? 'text-emerald-700'
                        : 'text-[#1c1917]',
                    )}
                  >
                    {session?.tenant.verificationStatus ?? 'bilinmiyor'}
                  </div>
                </div>
                <div className="rounded-[14px] bg-[#f7fafd] px-4 py-3">
                  <FieldLabel>Onboarding</FieldLabel>
                  <div className="mt-1 font-semibold text-[#1c1917]">
                    {session?.tenant.onboardingStatus ?? 'bilinmiyor'}
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        )}
      </div>
    </TenantDashboardShell>
  );
}
