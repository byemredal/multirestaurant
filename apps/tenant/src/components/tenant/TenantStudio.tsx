'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import TenantDashboardShell from '@/components/tenant/TenantDashboardShell';
import { usePlatformPack } from '@/lib/platform-pack-context';
import { TenantCuisinesPanel } from '@/components/tenant/TenantCuisinesPanel';
import { TenantReviewsPanel } from '@/components/tenant/TenantReviewsPanel';
import {
  TenantSlideOver,
  TenantDataTable,
  FormSection,
  RowAction,
  EditIcon,
  TrashIcon,
  SettingsIcon,
  type DataTableColumn,
} from '@/components/tenant/studio/StudioPrimitives';
import { ConfirmDialog } from '@/components/tenant/staff/ConfirmDialog';
import { Button } from '@lieferzonen/ui';
import { Input } from '@lieferzonen/ui';
import { Textarea } from '@lieferzonen/ui';
import { Select } from '@lieferzonen/ui';
import { Checkbox } from '@lieferzonen/ui';
import { useTenantAuth } from '@/lib/auth/tenant-auth-context';
import { useTenantStores } from '@/lib/tenant-store-context';
import {
  createTenantMenuCategory,
  createTenantMenuItem,
  createTenantOptionGroup,
  createTenantOptionItem,
  createTenantStore,
  getTenantMenuItem,
  listSystemCurrencies,
  listTenantMenuCategories,
  listTenantMenuItems,
  listTenantStores,
  updateTenantMenuCategory,
  updateTenantMenuItem,
  updateTenantOptionGroup,
  updateTenantOptionItem,
  updateTenantStore,
  apiBaseUrl,
} from '@/lib/tenant-client';
import type { StoredTenantSession } from '@/lib/storage/tenant-session';
import type { SystemCurrency } from '@/lib/tenant-client';
import { cn } from '@lieferzonen/ui';

/**
 * A Store is a single physical restaurant. There is no separate Branch
 * entity — the store itself holds all location, contact and delivery data
 * for that operating site.
 */
type Store = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl?: string | null;
  category: string;
  status?: string;
  phoneNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  openingHours?: Array<{
    dayOfWeek: string;
    openTime: string;
    closeTime: string;
    isClosed?: boolean;
  }>;
  deliveryZones?: Array<{
    name: string;
    postalCodes: string[];
    radiusKm?: number | null;
    minimumOrderAmount?: number | null;
    deliveryFee?: number | null;
    estimatedDeliveryMinutes?: number | null;
  }>;
};

type Category = {
  id: string;
  name: string;
  description: string | null;
  imageUrl?: string | null;
  sortOrder: number;
  isActive?: boolean;
};

type MenuItem = {
  id: string;
  categoryId: string | null;
  categoryName?: string | null;
  name: string;
  description: string | null;
  imageUrl?: string | null;
  basePrice: number;
  currencyId: string;
  currencyCode: string;
  sortOrder?: number;
  availabilityType: string;
  isActive?: boolean;
};

type OptionGroup = {
  id: string;
  name: string;
  description?: string | null;
  minSelections: number;
  maxSelections: number | null;
  isRequired?: boolean;
  sortOrder?: number;
  isActive?: boolean;
  options: Array<{
    id: string;
    name: string;
    description?: string | null;
    priceDelta: number;
    sortOrder?: number;
    isActive?: boolean;
  }>;
};

type ItemDetail = MenuItem & { optionGroups: OptionGroup[] };

type PublicPreview = {
  store: (Store & {
    deliveryFee?: number | null;
    minimumOrderAmount?: number | null;
  }) | null;
  categories: Category[];
  items: MenuItem[];
};

type WeekDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

type StudioTab = 'shop' | 'menu' | 'options' | 'cuisines' | 'reviews' | 'preview';

const weekDays: WeekDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const WEEKDAY_LABEL: Record<WeekDay, string> = {
  monday: 'Pazartesi',
  tuesday: 'Salı',
  wednesday: 'Çarşamba',
  thursday: 'Perşembe',
  friday: 'Cuma',
  saturday: 'Cumartesi',
  sunday: 'Pazar',
};

const TAB_ITEMS: Array<{ id: StudioTab; label: string; hint: string }> = [
  { id: 'shop', label: 'Restoran', hint: 'Restoran profili, adres ve teslimat' },
  { id: 'menu', label: 'Menü', hint: 'Kategoriler ve ürünler' },
  { id: 'options', label: 'Seçenekler & Malzemeler', hint: 'Ek seçenek grupları ve içerikler' },
  { id: 'cuisines', label: 'Mutfaklar', hint: 'Vitrin için mutfak tipi etiketleri' },
  { id: 'reviews', label: 'Yorumlar', hint: 'Müşteri puanları ve resmi cevaplar' },
  { id: 'preview', label: 'Önizleme', hint: 'Müşterinin gördüğü vitrin' },
];

const STORE_CATEGORIES = [
  'store',
  'fast_food',
  'cafe',
  'bakery',
  'dessert',
  'pizza',
  'sushi',
  'burger',
  'kebab',
  'grocery',
];

function buildDefaultHours() {
  return weekDays.map((dayOfWeek) => ({
    dayOfWeek,
    openTime: '09:00',
    closeTime: '22:00',
    isClosed: false,
  }));
}

function buildDefaultZone(postalCode = '') {
  return [
    {
      name: 'Birincil bölge',
      postalCodes: postalCode ? [postalCode] : [],
      radiusKm: 5,
      minimumOrderAmount: 0,
      deliveryFee: 0,
      estimatedDeliveryMinutes: 30,
    },
  ];
}

function asNumber(value: string) {
  return value.trim() ? Number(value) : null;
}

/**
 * Empty image URLs must be omitted from API payloads — the backend `@IsUrl`
 * validators reject an empty string ('' is not "missing" for `@IsOptional`).
 */
function optionalText(value: string) {
  return value.trim() ? value.trim() : undefined;
}

/**
 * The full restaurant form. A store IS the physical restaurant, so this one
 * form carries identity, location/contact and delivery data together — there
 * is no separate branch form.
 */
type StoreFormState = {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  category: string;
  isActive: boolean;
  phoneNumber: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  country: string;
  openingHours: Array<{
    dayOfWeek: WeekDay;
    openTime: string;
    closeTime: string;
    isClosed: boolean;
  }>;
  deliveryZones: Array<{
    name: string;
    postalCodes: string[];
    radiusKm: number | null;
    minimumOrderAmount: number | null;
    deliveryFee: number | null;
    estimatedDeliveryMinutes: number | null;
  }>;
};

function emptyStoreForm(): StoreFormState {
  return {
    name: '',
    slug: '',
    description: '',
    imageUrl: '',
    category: 'store',
    isActive: true,
    phoneNumber: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    postalCode: '',
    country: '',
    openingHours: buildDefaultHours(),
    deliveryZones: buildDefaultZone(),
  };
}

function emptyCategoryForm() {
  return { id: '', name: '', description: '', imageUrl: '', sortOrder: '0', isActive: true };
}

function emptyItemForm() {
  return {
    id: '',
    categoryId: '',
    name: '',
    description: '',
    imageUrl: '',
    basePrice: '',
    currencyId: '',
    sortOrder: '0',
    availabilityType: 'always',
    isActive: true,
  };
}

function emptyGroupForm() {
  return {
    id: '',
    name: '',
    description: '',
    minSelections: '0',
    maxSelections: '1',
    isRequired: false,
    sortOrder: '0',
    isActive: true,
  };
}

function emptyOptionForm() {
  return {
    groupId: '',
    id: '',
    name: '',
    description: '',
    priceDelta: '0',
    sortOrder: '0',
    isActive: true,
  };
}

function StatusPill({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        active ? 'bg-primary-50 text-primary-700' : 'bg-zinc-100 text-zinc-500',
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-primary-500' : 'bg-zinc-400')}
      />
      {children}
    </span>
  );
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
    <span className="text-[12.5px] font-semibold leading-none tracking-[-0.005em] text-[#57534e]">
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
    <label className="grid gap-2">
      <FieldLabel>{label}</FieldLabel>
      {children}
      {hint ? <span className="text-[11.5px] leading-4 text-[#a8a29e]">{hint}</span> : null}
    </label>
  );
}

export default function TenantStudio() {
  const { session, logout } = useTenantAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [tab, setTab] = useState<StudioTab>('shop');

  // Active store selection is owned by the sidebar's TenantStoreProvider (single
  // source of truth). This page reads/sets it through the context and keeps a
  // local full-detail `stores` list only for the management table + edit form.
  const {
    activeStoreId,
    setActiveStore,
    refresh: refreshStoreContext,
  } = useTenantStores();
  const selectedStoreId = activeStoreId ?? '';
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isCreatingStore, setIsCreatingStore] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [itemDetail, setItemDetail] = useState<ItemDetail | null>(null);
  const [currencies, setCurrencies] = useState<SystemCurrency[]>([]);
  const [publicPreview, setPublicPreview] = useState<PublicPreview>({
    store: null,
    categories: [],
    items: [],
  });

  const [storeForm, setStoreForm] = useState(emptyStoreForm());
  const [storeEditing, setStoreEditing] = useState(false);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm());
  const [itemForm, setItemForm] = useState(emptyItemForm());
  const [groupForm, setGroupForm] = useState(emptyGroupForm());
  const [optionForm, setOptionForm] = useState(emptyOptionForm());

  // When creating a brand-new store the form must not bind to any existing
  // store, otherwise the save handler would update instead of create.
  const selectedStore = useMemo(
    () =>
      isCreatingStore ? null : stores.find((entry) => entry.id === selectedStoreId) ?? null,
    [stores, selectedStoreId, isCreatingStore],
  );

  const userName = session
    ? `${session.tenant.firstName ?? ''} ${session.tenant.lastName ?? ''}`.trim() || 'Tenant Yönetici'
    : 'Tenant Yönetici';
  const companyName = session?.tenant.companyName ?? 'Tenant çalışma alanı';

  const loadStores = async (activeSession: StoredTenantSession) => {
    const data = (await listTenantStores(activeSession)) as Store[];
    setStores(data);
    // Active-store selection (and default fallback) lives in the shared store
    // context; refresh it so the sidebar switcher and this page stay in sync.
    await refreshStoreContext();
  };

  const loadPreview = useCallback(async (storeId: string) => {
    try {
      const [storeResponse, categoriesResponse, itemsResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/public/stores/${storeId}`).then((r) => r.json()),
        fetch(`${apiBaseUrl}/public/stores/${storeId}/menu/categories`).then((r) => r.json()),
        fetch(`${apiBaseUrl}/public/stores/${storeId}/menu/items`).then((r) => r.json()),
      ]);

      setPublicPreview({
        store: storeResponse.store ?? null,
        categories: categoriesResponse.categories ?? [],
        items: itemsResponse.items ?? [],
      });
    } catch {
      setPublicPreview({ store: null, categories: [], items: [] });
    }
  }, []);

  const loadWorkspace = useCallback(
    async (activeSession: StoredTenantSession, storeId: string) => {
      const [nextCategories, nextItems] = await Promise.all([
        listTenantMenuCategories(activeSession, storeId),
        listTenantMenuItems(activeSession, storeId),
      ]);
      setCategories(nextCategories as Category[]);
      setItems(nextItems as MenuItem[]);
      setSelectedItemId((current) =>
        (nextItems as MenuItem[]).some((item) => item.id === current)
          ? current
          : (nextItems as MenuItem[])[0]?.id ?? '',
      );
      await loadPreview(storeId);
    },
    [loadPreview],
  );

  const run = async (
    action: () => Promise<void>,
    successMessage?: string,
  ): Promise<boolean> => {
    try {
      setBusy(true);
      setError(null);
      setFeedback(null);
      await action();
      if (successMessage) setFeedback(successMessage);
      return true;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'İşlem başarısız.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  // TenantGate guarantees an authenticated ACTIVE session here.
  useEffect(() => {
    if (session) {
      void loadStores(session);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Currency catalog feeds the menu-item price dropdown. The API requires a
  // currencyId (UUID) on every menu item, so this must load before saving.
  useEffect(() => {
    void listSystemCurrencies()
      .then((payload) => setCurrencies(payload.currencies ?? []))
      .catch(() => setCurrencies([]));
  }, []);

  useEffect(() => {
    if (!session || !selectedStoreId) {
      setCategories([]);
      setItems([]);
      setItemDetail(null);
      setPublicPreview({ store: null, categories: [], items: [] });
      return;
    }
    void loadWorkspace(session, selectedStoreId);
  }, [loadWorkspace, selectedStoreId, session]);

  useEffect(() => {
    if (!session || !selectedStoreId || !selectedItemId) {
      setItemDetail(null);
      return;
    }
    void getTenantMenuItem(session, selectedStoreId, selectedItemId)
      .then((payload) => setItemDetail(payload.item as ItemDetail))
      .catch(() => setItemDetail(null));
  }, [selectedItemId, selectedStoreId, session]);

  useEffect(() => {
    if (!selectedStore) {
      setStoreForm(emptyStoreForm());
      return;
    }
    setStoreForm({
      name: selectedStore.name,
      slug: selectedStore.slug,
      description: selectedStore.description ?? '',
      imageUrl: selectedStore.imageUrl ?? '',
      category: selectedStore.category,
      isActive: selectedStore.status !== 'inactive',
      phoneNumber: selectedStore.phoneNumber ?? '',
      addressLine1: selectedStore.addressLine1 ?? '',
      addressLine2: selectedStore.addressLine2 ?? '',
      city: selectedStore.city ?? '',
      postalCode: selectedStore.postalCode ?? '',
      country: selectedStore.country ?? '',
      openingHours: selectedStore.openingHours?.length
        ? selectedStore.openingHours.map((hour) => ({
            dayOfWeek: hour.dayOfWeek as WeekDay,
            openTime: hour.openTime,
            closeTime: hour.closeTime,
            isClosed: Boolean(hour.isClosed),
          }))
        : buildDefaultHours(),
      deliveryZones: selectedStore.deliveryZones?.length
        ? selectedStore.deliveryZones.map((zone) => ({
            name: zone.name,
            postalCodes: zone.postalCodes,
            radiusKm: zone.radiusKm ?? null,
            minimumOrderAmount: zone.minimumOrderAmount ?? null,
            deliveryFee: zone.deliveryFee ?? null,
            estimatedDeliveryMinutes: zone.estimatedDeliveryMinutes ?? null,
          }))
        : buildDefaultZone(),
    });
  }, [selectedStore]);

  useEffect(() => {
    if (!itemDetail) return;
    setItemForm({
      id: itemDetail.id,
      categoryId: itemDetail.categoryId ?? '',
      name: itemDetail.name,
      description: itemDetail.description ?? '',
      imageUrl: itemDetail.imageUrl ?? '',
      basePrice: String(itemDetail.basePrice),
      currencyId: itemDetail.currencyId,
      sortOrder: String(itemDetail.sortOrder ?? 0),
      availabilityType: itemDetail.availabilityType,
      isActive: itemDetail.isActive ?? true,
    });
  }, [itemDetail]);

  const handleSignOut = async () => {
    await logout();
  };

  return (
    <TenantDashboardShell
      companyName={companyName}
      currentHref="/dashboard/studio"
      description="Restoran ve menü yönetiminizi tek bir operasyonel panelden yürütün."
      onSignOut={handleSignOut}
      title="Restoran & Menü"
      userName={userName}
    >
      <div className="grid gap-4">
        {feedback ? (
          <div className="rounded-[14px] border border-primary-200 bg-primary-50 px-4 py-3 text-[13px] text-primary-700">
            {feedback}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {error}
          </div>
        ) : null}

        <div
          role="tablist"
          aria-label="Restoran ve menü sekmeleri"
          className="flex flex-wrap gap-1 rounded-[16px] border border-[#ece2d2] bg-[#fbfaf7] p-1.5"
        >
          {TAB_ITEMS.map((entry) => {
            const active = tab === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(entry.id)}
                className={cn(
                  'group flex flex-1 min-w-[160px] flex-col gap-0.5 rounded-[12px] px-3.5 py-2 text-left transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#24A94A]/40',
                  active
                    ? 'bg-white text-[#1c1917] shadow-[0_6px_18px_rgba(28,25,23,0.08)] ring-1 ring-[#ece2d2]'
                    : 'text-[#57534e] hover:bg-white/70',
                )}
              >
                <span className="flex items-center gap-2 text-[13px] font-bold">
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full transition-colors duration-200',
                      active ? 'bg-[#24A94A]' : 'bg-transparent group-hover:bg-[#d6c9ad]',
                    )}
                  />
                  {entry.label}
                </span>
                <span
                  className={cn(
                    'pl-3.5 text-[11px] transition-colors duration-200',
                    active ? 'text-[#78716c]' : 'text-[#a8a29e]',
                  )}
                >
                  {entry.hint}
                </span>
              </button>
            );
          })}
        </div>

        {tab === 'shop' ? (
          <ShopTab
            stores={stores}
            selectedStore={selectedStore}
            storeForm={storeForm}
            setStoreForm={setStoreForm}
            storeEditing={storeEditing}
            busy={busy}
            onAddStore={() => {
              setIsCreatingStore(true);
              setStoreForm(emptyStoreForm());
              setStoreEditing(true);
            }}
            onEditStore={(id) => {
              setIsCreatingStore(false);
              setActiveStore(id);
              setStoreEditing(true);
            }}
            onCloseDrawer={() => {
              setStoreEditing(false);
              setIsCreatingStore(false);
            }}
            onDisableStore={(id) =>
              void run(async () => {
                if (!session) return;
                await updateTenantStore(session, id, { status: 'inactive' });
                await loadStores(session);
              }, 'Restoran pasifleştirildi.')
            }
            onSaveStore={() =>
              void run(async () => {
                if (!session) return;
                // A store is the physical restaurant: identity + location +
                // delivery data are saved together. Empty optional strings
                // are omitted — the backend `@IsUrl`/`@Length` validators
                // reject '' for `@IsOptional` fields.
                const base = {
                  name: storeForm.name,
                  slug: optionalText(storeForm.slug),
                  category: storeForm.category,
                  description: storeForm.description,
                  imageUrl: optionalText(storeForm.imageUrl),
                  phoneNumber: optionalText(storeForm.phoneNumber),
                  addressLine1: optionalText(storeForm.addressLine1),
                  addressLine2: optionalText(storeForm.addressLine2),
                  city: optionalText(storeForm.city),
                  postalCode: optionalText(storeForm.postalCode),
                  country: optionalText(storeForm.country),
                  openingHours: storeForm.openingHours.map((hour) => ({
                    dayOfWeek: hour.dayOfWeek,
                    openTime: hour.openTime,
                    closeTime: hour.closeTime,
                    isClosed: hour.isClosed,
                  })),
                  deliveryZones: storeForm.deliveryZones.map((zone) => ({
                    name: zone.name,
                    postalCodes: zone.postalCodes,
                    radiusKm: zone.radiusKm ?? undefined,
                    minimumOrderAmount: zone.minimumOrderAmount ?? undefined,
                    deliveryFee: zone.deliveryFee ?? undefined,
                    estimatedDeliveryMinutes: zone.estimatedDeliveryMinutes ?? undefined,
                  })),
                };
                if (selectedStore) {
                  await updateTenantStore(session, selectedStore.id, {
                    ...base,
                    status: storeForm.isActive ? 'active' : 'inactive',
                  });
                } else {
                  await createTenantStore(session, base);
                }
                await loadStores(session);
                setStoreEditing(false);
                setIsCreatingStore(false);
              }, selectedStore ? 'Restoran güncellendi.' : 'Restoran oluşturuldu.')
            }
          />
        ) : null}

        {tab === 'menu' ? (
          <MenuTab
            disabled={!session || !selectedStoreId}
            busy={busy}
            categories={categories}
            items={items}
            currencies={currencies}
            categoryForm={categoryForm}
            setCategoryForm={setCategoryForm}
            itemForm={itemForm}
            setItemForm={setItemForm}
            onSelectItem={(id) => setSelectedItemId(id)}
            onSaveCategory={() =>
              run(async () => {
                if (!session || !selectedStoreId) return;
                const payload = {
                  name: categoryForm.name,
                  description: categoryForm.description,
                  imageUrl: optionalText(categoryForm.imageUrl),
                  sortOrder: Number(categoryForm.sortOrder || '0'),
                  isActive: categoryForm.isActive,
                };
                if (categoryForm.id) {
                  await updateTenantMenuCategory(session, selectedStoreId, categoryForm.id, payload);
                } else {
                  await createTenantMenuCategory(session, selectedStoreId, payload);
                }
                await loadWorkspace(session, selectedStoreId);
                setCategoryForm(emptyCategoryForm());
              }, categoryForm.id ? 'Kategori güncellendi.' : 'Kategori oluşturuldu.')
            }
            onArchiveCategory={(id) =>
              run(async () => {
                if (!session || !selectedStoreId) return;
                await updateTenantMenuCategory(session, selectedStoreId, id, {
                  isActive: false,
                });
                await loadWorkspace(session, selectedStoreId);
              }, 'Kategori pasifleştirildi.')
            }
            onSaveItem={() =>
              run(async () => {
                if (!session || !selectedStoreId) return;
                const payload = {
                  categoryId: itemForm.categoryId || null,
                  name: itemForm.name,
                  description: itemForm.description,
                  imageUrl: optionalText(itemForm.imageUrl),
                  basePrice: Number(itemForm.basePrice || '0'),
                  currencyId: itemForm.currencyId,
                  sortOrder: Number(itemForm.sortOrder || '0'),
                  availabilityType: itemForm.availabilityType,
                  isActive: itemForm.isActive,
                };
                if (itemForm.id) {
                  await updateTenantMenuItem(session, selectedStoreId, itemForm.id, payload);
                } else {
                  await createTenantMenuItem(session, selectedStoreId, payload);
                }
                await loadWorkspace(session, selectedStoreId);
                setItemForm(emptyItemForm());
              }, itemForm.id ? 'Ürün güncellendi.' : 'Ürün eklendi.')
            }
            onArchiveItem={(id) =>
              run(async () => {
                if (!session || !selectedStoreId) return;
                await updateTenantMenuItem(session, selectedStoreId, id, {
                  isActive: false,
                });
                await loadWorkspace(session, selectedStoreId);
              }, 'Ürün pasifleştirildi.')
            }
          />
        ) : null}

        {tab === 'options' ? (
          <OptionsTab
            items={items}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            itemDetail={itemDetail}
            busy={busy}
            groupForm={groupForm}
            setGroupForm={setGroupForm}
            optionForm={optionForm}
            setOptionForm={setOptionForm}
            onSaveGroup={() =>
              run(async () => {
                if (!session || !selectedStoreId || !selectedItemId) return;
                const payload = {
                  name: groupForm.name,
                  description: groupForm.description,
                  minSelections: Number(groupForm.minSelections || '0'),
                  maxSelections: Number(groupForm.maxSelections || '1'),
                  isRequired: groupForm.isRequired,
                  sortOrder: Number(groupForm.sortOrder || '0'),
                  isActive: groupForm.isActive,
                };
                if (groupForm.id) {
                  await updateTenantOptionGroup(
                    session,
                    selectedStoreId,
                    selectedItemId,
                    groupForm.id,
                    payload,
                  );
                } else {
                  await createTenantOptionGroup(
                    session,
                    selectedStoreId,
                    selectedItemId,
                    payload,
                  );
                }
                const refreshed = await getTenantMenuItem(
                  session,
                  selectedStoreId,
                  selectedItemId,
                );
                setItemDetail(refreshed.item as ItemDetail);
                setGroupForm(emptyGroupForm());
              }, groupForm.id ? 'Seçenek grubu güncellendi.' : 'Seçenek grubu oluşturuldu.')
            }
            onArchiveGroup={(groupId) =>
              run(async () => {
                if (!session || !selectedStoreId || !selectedItemId) return;
                await updateTenantOptionGroup(
                  session,
                  selectedStoreId,
                  selectedItemId,
                  groupId,
                  { isActive: false },
                );
                const refreshed = await getTenantMenuItem(
                  session,
                  selectedStoreId,
                  selectedItemId,
                );
                setItemDetail(refreshed.item as ItemDetail);
              }, 'Seçenek grubu pasifleştirildi.')
            }
            onSaveOption={(groupId) =>
              run(async () => {
                if (!session || !selectedStoreId || !selectedItemId) return;
                const payload = {
                  name: optionForm.name,
                  description: optionForm.description,
                  priceDelta: Number(optionForm.priceDelta || '0'),
                  sortOrder: Number(optionForm.sortOrder || '0'),
                  isActive: optionForm.isActive,
                };
                if (optionForm.id && optionForm.groupId === groupId) {
                  await updateTenantOptionItem(
                    session,
                    selectedStoreId,
                    selectedItemId,
                    groupId,
                    optionForm.id,
                    payload,
                  );
                } else {
                  await createTenantOptionItem(
                    session,
                    selectedStoreId,
                    selectedItemId,
                    groupId,
                    payload,
                  );
                }
                const refreshed = await getTenantMenuItem(
                  session,
                  selectedStoreId,
                  selectedItemId,
                );
                setItemDetail(refreshed.item as ItemDetail);
                setOptionForm({ ...emptyOptionForm(), groupId });
              }, optionForm.id ? 'Malzeme güncellendi.' : 'Malzeme eklendi.')
            }
            onArchiveOption={(groupId, optionId) =>
              run(async () => {
                if (!session || !selectedStoreId || !selectedItemId) return;
                await updateTenantOptionItem(
                  session,
                  selectedStoreId,
                  selectedItemId,
                  groupId,
                  optionId,
                  { isActive: false },
                );
                const refreshed = await getTenantMenuItem(
                  session,
                  selectedStoreId,
                  selectedItemId,
                );
                setItemDetail(refreshed.item as ItemDetail);
              }, 'Malzeme arşivlendi.')
            }
          />
        ) : null}

        {tab === 'cuisines' && session ? (
          <TenantCuisinesPanel
            session={session}
            storeId={selectedStoreId ?? null}
          />
        ) : null}

        {tab === 'reviews' && session ? (
          <TenantReviewsPanel
            session={session}
            storeId={selectedStoreId ?? null}
          />
        ) : null}

        {tab === 'preview' ? <PreviewTab preview={publicPreview} /> : null}
      </div>
    </TenantDashboardShell>
  );
}

// ─── Shop tab ───────────────────────────────────────────────────────────────

function ShopTab({
  stores,
  selectedStore,
  storeForm,
  setStoreForm,
  storeEditing,
  busy,
  onAddStore,
  onEditStore,
  onCloseDrawer,
  onDisableStore,
  onSaveStore,
}: {
  stores: Store[];
  selectedStore: Store | null;
  storeForm: StoreFormState;
  setStoreForm: (updater: (current: StoreFormState) => StoreFormState) => void;
  storeEditing: boolean;
  busy: boolean;
  onAddStore: () => void;
  onEditStore: (id: string) => void;
  onCloseDrawer: () => void;
  onDisableStore: (id: string) => void;
  onSaveStore: () => void;
}) {
  const router = useRouter();
  const isCreating = !selectedStore;
  const platformPack = usePlatformPack();
  const currency = platformPack?.currency || '';
  const platformCountry = platformPack?.country || '';
  const [disableTarget, setDisableTarget] = useState<Store | null>(null);
  // Step-accordion inside the drawer: one section open at a time.
  const [section, setSection] = useState<'info' | 'hours' | 'zones'>('info');

  // Reset to the first step every time the drawer (re)opens.
  useEffect(() => {
    if (storeEditing) setSection('info');
  }, [storeEditing]);

  const infoComplete = storeForm.name.trim().length > 0;
  const zoneCount = storeForm.deliveryZones.length;
  const openDays = storeForm.openingHours.filter((h) => !h.isClosed).length;

  // Single-country platform: the store country is pinned to the active
  // CountryPack. Keep the form in sync so the locked field always submits the
  // platform country (the backend enforces this too via store_country_mismatch).
  useEffect(() => {
    if (platformCountry && storeForm.country !== platformCountry) {
      setStoreForm((current) => ({ ...current, country: platformCountry }));
    }
  }, [platformCountry, storeForm.country, setStoreForm]);

  const updateHour = (
    index: number,
    patch: Partial<StoreFormState['openingHours'][number]>,
  ) =>
    setStoreForm((current) => ({
      ...current,
      openingHours: current.openingHours.map((entry, i) =>
        i === index ? { ...entry, ...patch } : entry,
      ),
    }));

  const updateZone = (
    index: number,
    patch: Partial<StoreFormState['deliveryZones'][number]>,
  ) =>
    setStoreForm((current) => ({
      ...current,
      deliveryZones: current.deliveryZones.map((entry, i) =>
        i === index ? { ...entry, ...patch } : entry,
      ),
    }));

  const columns: DataTableColumn<Store>[] = [
    {
      key: 'name',
      header: 'Restoran',
      render: (store) => (
        <div className="font-semibold text-[#1c1917]">{store.name}</div>
      ),
    },
    {
      key: 'location',
      header: 'Şehir / posta',
      render: (store) =>
        [store.city, store.postalCode].filter(Boolean).join(' · ') || '—',
    },
    {
      key: 'status',
      header: 'Durum',
      render: (store) => (
        <StatusPill active={store.status !== 'inactive'}>
          {store.status !== 'inactive' ? 'Aktif' : 'Pasif'}
        </StatusPill>
      ),
    },
    {
      key: 'currency',
      header: 'Para birimi',
      render: () => currency || '—',
    },
    {
      key: 'category',
      header: 'Kategori',
      render: (store) => store.category,
      hideOnMobile: true,
    },
  ];

  return (
    <div className="grid gap-4">
      <SectionCard
        title="Restoranlar"
        description="Restoranlarınızı yönetin. Eklemek veya düzenlemek için sağdan açılan formu kullanın."
        toolbar={
          stores.length > 0 ? (
            <Button onClick={onAddStore} shimmer={true}>
              + Restoran Ekle
            </Button>
          ) : null
        }
      >
        <TenantDataTable
          columns={columns}
          rows={stores}
          getRowId={(store) => store.id}
          empty={
            <div className="rounded-[14px] border border-dashed border-[#ece2d2] bg-[#f7fafd] px-4 py-8 text-center">
              <p className="text-[14px] font-semibold text-[#1c1917]">Henüz restoran yok.</p>
              <p className="mt-1 text-[13px] text-[#78716c]">İlk restoranını ekle.</p>
              <div className="mt-3 flex justify-center">
                <Button onClick={onAddStore}>+ Restoran Ekle</Button>
              </div>
            </div>
          }
          rowActions={(store) => (
            <>
              <RowAction label="Düzenle" onClick={() => onEditStore(store.id)}>
                <EditIcon />
              </RowAction>
              <RowAction
                label="Ayarlar"
                onClick={() => router.push('/dashboard/settings')}
              >
                <SettingsIcon />
              </RowAction>
              <RowAction
                label="Pasifleştir"
                tone="danger"
                disabled={store.status === 'inactive'}
                onClick={() => setDisableTarget(store)}
              >
                <TrashIcon />
              </RowAction>
            </>
          )}
        />
      </SectionCard>

      <ConfirmDialog
        open={Boolean(disableTarget)}
        title="Restoranı pasifleştir"
        body={
          <span>
            <strong>{disableTarget?.name}</strong> vitrinde görünmez olacak. Bu işlem
            menü ve ürün verilerini silmez; istediğinde tekrar aktifleştirebilirsin.
          </span>
        }
        confirmLabel="Pasifleştir"
        busy={busy}
        onConfirm={() => {
          if (disableTarget) onDisableStore(disableTarget.id);
          setDisableTarget(null);
        }}
        onClose={() => setDisableTarget(null)}
      />

      <TenantSlideOver
        open={storeEditing}
        busy={busy}
        title={isCreating ? 'Restoran Ekle' : 'Restoranı düzenle'}
        description={
          isCreating
            ? 'Yeni restoran; adres, çalışma saatleri ve teslimat ayarlarını tek başına taşır.'
            : 'Restoranın kimlik ve konum bilgilerini güncelle.'
        }
        onClose={onCloseDrawer}
        footer={
          <>
            <Button variant="ghost" onClick={onCloseDrawer} disabled={busy}>
              Vazgeç
            </Button>
            <Button onClick={onSaveStore} shimmer={true} disabled={busy || !storeForm.name.trim()}>
              {isCreating ? 'Restoranı oluştur' : 'Değişiklikleri kaydet'}
            </Button>
          </>
        }
      >
      <div className="grid gap-3">
        <FormSection
          title="Restoran bilgileri"
          index={1}
          open={section === 'info'}
          done={infoComplete && section !== 'info'}
          summary={
            infoComplete
              ? [storeForm.name, storeForm.city].filter(Boolean).join(' · ')
              : undefined
          }
          onToggle={() => setSection('info')}
        >
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Restoran adı">
                <Input
                  value={storeForm.name}
                  placeholder="Lieferzonen Zürich"
                  onChange={(event) =>
                    setStoreForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </Field>
              <Field label="Slug" hint="URL'de kullanılır">
                <Input
                  value={storeForm.slug}
                  placeholder="lieferzonen-zurich"
                  onChange={(event) =>
                    setStoreForm((current) => ({ ...current, slug: event.target.value }))
                  }
                />
              </Field>
              <Field label="Kategori">
                <Select
                  value={storeForm.category}
                  onChange={(event) =>
                    setStoreForm((current) => ({ ...current, category: event.target.value }))
                  }
                >
                  {STORE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Görsel URL">
                <Input
                  value={storeForm.imageUrl}
                  placeholder="https://..."
                  onChange={(event) =>
                    setStoreForm((current) => ({ ...current, imageUrl: event.target.value }))
                  }
                />
              </Field>
            </div>
            <Field label="Açıklama">
              <Textarea
                rows={3}
                value={storeForm.description}
                placeholder="Kısa restoran açıklaması..."
                onChange={(event) =>
                  setStoreForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Telefon">
                <Input
                  value={storeForm.phoneNumber}
                  placeholder="+41 ..."
                  onChange={(event) =>
                    setStoreForm((current) => ({ ...current, phoneNumber: event.target.value }))
                  }
                />
              </Field>
              <Field label="Posta kodu">
                <Input
                  value={storeForm.postalCode}
                  placeholder="8001"
                  onChange={(event) =>
                    setStoreForm((current) => ({ ...current, postalCode: event.target.value }))
                  }
                />
              </Field>
              <Field label="Adres satırı 1">
                <Input
                  value={storeForm.addressLine1}
                  placeholder="Bahnhofstrasse 1"
                  onChange={(event) =>
                    setStoreForm((current) => ({ ...current, addressLine1: event.target.value }))
                  }
                />
              </Field>
              <Field label="Adres satırı 2">
                <Input
                  value={storeForm.addressLine2}
                  onChange={(event) =>
                    setStoreForm((current) => ({ ...current, addressLine2: event.target.value }))
                  }
                />
              </Field>
              <Field label="Şehir">
                <Input
                  value={storeForm.city}
                  placeholder="Zürich"
                  onChange={(event) =>
                    setStoreForm((current) => ({ ...current, city: event.target.value }))
                  }
                />
              </Field>
              <Field label="Ülke">
                <Input
                  value={platformCountry || storeForm.country}
                  readOnly
                  disabled
                  title="Ülke, platformun aktif ülkesine sabittir."
                />
              </Field>
            </div>
            <div className="rounded-[12px] bg-[#f7fafd] p-3">
              <Checkbox
                label="Vitrinde görünür"
                checked={storeForm.isActive}
                onChange={(event) =>
                  setStoreForm((current) => ({ ...current, isActive: event.target.checked }))
                }
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setSection('hours')} disabled={!infoComplete}>
                Devam: Çalışma saatleri
              </Button>
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Çalışma saatleri"
          index={2}
          open={section === 'hours'}
          done={section === 'zones'}
          summary={`${openDays} gün açık`}
          onToggle={() => setSection('hours')}
        >
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              {storeForm.openingHours.map((hour, index) => (
                <div
                  key={hour.dayOfWeek}
                  className="grid items-center gap-2 rounded-[12px] bg-white px-3 py-2 md:grid-cols-[110px_1fr_1fr_auto]"
                >
                  <span className="text-[12.5px] font-semibold text-[#1c1917]">
                    {WEEKDAY_LABEL[hour.dayOfWeek]}
                  </span>
                  <Input
                    value={hour.openTime}
                    placeholder="09:00"
                    disabled={hour.isClosed}
                    onChange={(event) => updateHour(index, { openTime: event.target.value })}
                  />
                  <Input
                    value={hour.closeTime}
                    placeholder="22:00"
                    disabled={hour.isClosed}
                    onChange={(event) => updateHour(index, { closeTime: event.target.value })}
                  />
                  <Checkbox
                    label="Kapalı"
                    checked={Boolean(hour.isClosed)}
                    onChange={(event) => updateHour(index, { isClosed: event.target.checked })}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setSection('zones')}>Devam: Teslimat bölgeleri</Button>
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Teslimat bölgeleri"
          index={3}
          open={section === 'zones'}
          summary={`${zoneCount} bölge`}
          onToggle={() => setSection('zones')}
        >
          <div className="grid gap-2">
            <div className="flex items-center justify-end">
              <Button
                variant="ghost"
                shimmer={true}
                onClick={() =>
                  setStoreForm((current) => ({
                    ...current,
                    deliveryZones: [
                      ...current.deliveryZones,
                      {
                        name: `Bölge ${current.deliveryZones.length + 1}`,
                        postalCodes: current.postalCode ? [current.postalCode] : [],
                        radiusKm: 5,
                        minimumOrderAmount: 0,
                        deliveryFee: 0,
                        estimatedDeliveryMinutes: 30,
                      },
                    ],
                  }))
                }
              >
                + Bölge ekle
              </Button>
            </div>
            {storeForm.deliveryZones.map((zone, index) => (
              <div key={`${zone.name}-${index}`} className="grid gap-2 rounded-[12px] bg-white p-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <Field label="Bölge adı">
                    <Input
                      value={zone.name}
                      onChange={(event) => updateZone(index, { name: event.target.value })}
                    />
                  </Field>
                  <Field label="Posta kodları (virgülle)">
                    <Input
                      value={zone.postalCodes.join(', ')}
                      onChange={(event) =>
                        updateZone(index, {
                          postalCodes: event.target.value
                            .split(',')
                            .map((value) => value.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </Field>
                  <Field label="Yarıçap (km)">
                    <Input
                      value={zone.radiusKm?.toString() ?? ''}
                      inputMode="decimal"
                      onChange={(event) =>
                        updateZone(index, { radiusKm: asNumber(event.target.value) })
                      }
                    />
                  </Field>
                  <Field label={`Min sipariş${currency ? ` (${currency})` : ''}`}>
                    <Input
                      value={zone.minimumOrderAmount?.toString() ?? ''}
                      inputMode="decimal"
                      onChange={(event) =>
                        updateZone(index, { minimumOrderAmount: asNumber(event.target.value) })
                      }
                    />
                  </Field>
                  <Field label={`Teslimat ücreti${currency ? ` (${currency})` : ''}`}>
                    <Input
                      value={zone.deliveryFee?.toString() ?? ''}
                      inputMode="decimal"
                      onChange={(event) =>
                        updateZone(index, { deliveryFee: asNumber(event.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Tahmini süre (dk)">
                    <Input
                      value={zone.estimatedDeliveryMinutes?.toString() ?? ''}
                      inputMode="numeric"
                      onChange={(event) =>
                        updateZone(index, {
                          estimatedDeliveryMinutes: asNumber(event.target.value),
                        })
                      }
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </FormSection>
      </div>
      </TenantSlideOver>
    </div>
  );
}

// ─── Menu tab ───────────────────────────────────────────────────────────────

function MenuTab({
  disabled,
  busy,
  categories,
  items,
  currencies,
  categoryForm,
  setCategoryForm,
  itemForm,
  setItemForm,
  onSelectItem,
  onSaveCategory,
  onArchiveCategory,
  onSaveItem,
  onArchiveItem,
}: {
  disabled: boolean;
  busy: boolean;
  categories: Category[];
  items: MenuItem[];
  currencies: SystemCurrency[];
  categoryForm: ReturnType<typeof emptyCategoryForm>;
  setCategoryForm: (
    updater: (current: ReturnType<typeof emptyCategoryForm>) => ReturnType<typeof emptyCategoryForm>,
  ) => void;
  itemForm: ReturnType<typeof emptyItemForm>;
  setItemForm: (
    updater: (current: ReturnType<typeof emptyItemForm>) => ReturnType<typeof emptyItemForm>,
  ) => void;
  onSelectItem: (id: string) => void;
  onSaveCategory: () => Promise<boolean>;
  onArchiveCategory: (id: string) => Promise<boolean>;
  onSaveItem: () => Promise<boolean>;
  onArchiveItem: (id: string) => Promise<boolean>;
}) {
  const platformCurrency = usePlatformPack()?.currency || '';
  const defaultCurrencyId = useMemo(
    () => currencies.find((c) => c.code === platformCurrency)?.id ?? currencies[0]?.id ?? '',
    [currencies, platformCurrency],
  );
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [productDrawerOpen, setProductDrawerOpen] = useState(false);
  const [productSection, setProductSection] = useState<'info' | 'pricing'>('info');
  const [categoryDisableTarget, setCategoryDisableTarget] = useState<Category | null>(null);
  const [itemDisableTarget, setItemDisableTarget] = useState<MenuItem | null>(null);

  // Reset the product step-accordion to the first section each time it opens.
  useEffect(() => {
    if (productDrawerOpen) setProductSection('info');
  }, [productDrawerOpen]);
  const productInfoComplete = itemForm.name.trim().length > 0;

  const productCountByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      if (item.categoryId) map.set(item.categoryId, (map.get(item.categoryId) ?? 0) + 1);
    }
    return map;
  }, [items]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) map.set(c.id, c.name);
    return map;
  }, [categories]);

  if (disabled) {
    return (
      <SectionCard title="Menü">
        <p className="text-[13px] text-[#78716c]">Menüyü görmek için bir restoran seçin.</p>
      </SectionCard>
    );
  }

  function openCategoryCreate() {
    setCategoryForm(() => emptyCategoryForm());
    setCategoryDrawerOpen(true);
  }
  function openCategoryEdit(category: Category) {
    setCategoryForm(() => ({
      id: category.id,
      name: category.name,
      description: category.description ?? '',
      imageUrl: category.imageUrl ?? '',
      sortOrder: String(category.sortOrder),
      isActive: category.isActive ?? true,
    }));
    setCategoryDrawerOpen(true);
  }
  function openProductCreate() {
    setItemForm(() => ({ ...emptyItemForm(), currencyId: defaultCurrencyId }));
    setProductDrawerOpen(true);
  }
  function openProductEdit(item: MenuItem) {
    onSelectItem(item.id);
    setItemForm(() => ({
      id: item.id,
      categoryId: item.categoryId ?? '',
      name: item.name,
      description: item.description ?? '',
      imageUrl: item.imageUrl ?? '',
      basePrice: String(item.basePrice),
      currencyId: item.currencyId,
      sortOrder: String(item.sortOrder ?? 0),
      availabilityType: item.availabilityType,
      isActive: item.isActive ?? true,
    }));
    setProductDrawerOpen(true);
  }
  async function saveCategory() {
    const ok = await onSaveCategory();
    if (ok) setCategoryDrawerOpen(false);
  }
  async function saveItem() {
    const ok = await onSaveItem();
    if (ok) setProductDrawerOpen(false);
  }

  const categoryColumns: DataTableColumn<Category>[] = [
    {
      key: 'name',
      header: 'Kategori',
      render: (c) => <span className="font-semibold text-[#1c1917]">{c.name}</span>,
    },
    { key: 'sort', header: 'Sıra', render: (c) => c.sortOrder, hideOnMobile: true },
    { key: 'count', header: 'Ürün', render: (c) => productCountByCategory.get(c.id) ?? 0 },
    {
      key: 'status',
      header: 'Durum',
      render: (c) => (
        <StatusPill active={c.isActive ?? true}>{c.isActive ?? true ? 'Aktif' : 'Pasif'}</StatusPill>
      ),
    },
  ];

  const productColumns: DataTableColumn<MenuItem>[] = [
    {
      key: 'name',
      header: 'Ürün',
      render: (i) => <span className="font-semibold text-[#1c1917]">{i.name}</span>,
    },
    {
      key: 'category',
      header: 'Kategori',
      render: (i) => (i.categoryId ? categoryNameById.get(i.categoryId) ?? '—' : 'Kategorisiz'),
      hideOnMobile: true,
    },
    {
      key: 'price',
      header: 'Fiyat',
      render: (i) => `${i.basePrice} ${i.currencyCode || platformCurrency}`,
    },
    {
      key: 'status',
      header: 'Durum',
      render: (i) => (
        <StatusPill active={i.isActive ?? true}>{i.isActive ?? true ? 'Aktif' : 'Pasif'}</StatusPill>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <SectionCard
        title="Kategoriler"
        description="Menü kategorilerini yönetin."
        toolbar={
          <Button onClick={openCategoryCreate} shimmer={true}>
            + Kategori Ekle
          </Button>
        }
      >
        <TenantDataTable
          columns={categoryColumns}
          rows={categories}
          getRowId={(c) => c.id}
          empty={
            <div className="rounded-[14px] border border-dashed border-[#ece2d2] bg-[#f7fafd] px-4 py-8 text-center">
              <p className="text-[14px] font-semibold text-[#1c1917]">Henüz kategori yok.</p>
              <p className="mt-1 text-[13px] text-[#78716c]">İlk kategorini ekle.</p>
              <div className="mt-3 flex justify-center">
                <Button onClick={openCategoryCreate}>+ Kategori Ekle</Button>
              </div>
            </div>
          }
          rowActions={(c) => (
            <>
              <RowAction label="Düzenle" onClick={() => openCategoryEdit(c)}>
                <EditIcon />
              </RowAction>
              <RowAction
                label="Pasifleştir"
                tone="danger"
                disabled={(c.isActive ?? true) === false}
                onClick={() => setCategoryDisableTarget(c)}
              >
                <TrashIcon />
              </RowAction>
            </>
          )}
        />
      </SectionCard>

      <SectionCard
        title="Ürünler"
        description="Menü ürünlerini yönetin."
        toolbar={
          <Button onClick={openProductCreate} shimmer={true}>
            + Ürün Ekle
          </Button>
        }
      >
        <TenantDataTable
          columns={productColumns}
          rows={items}
          getRowId={(i) => i.id}
          empty={
            <div className="rounded-[14px] border border-dashed border-[#ece2d2] bg-[#f7fafd] px-4 py-8 text-center">
              <p className="text-[14px] font-semibold text-[#1c1917]">Henüz ürün yok.</p>
              <p className="mt-1 text-[13px] text-[#78716c]">İlk ürününü ekle.</p>
              <div className="mt-3 flex justify-center">
                <Button onClick={openProductCreate}>+ Ürün Ekle</Button>
              </div>
            </div>
          }
          rowActions={(i) => (
            <>
              <RowAction label="Düzenle" onClick={() => openProductEdit(i)}>
                <EditIcon />
              </RowAction>
              <RowAction
                label="Pasifleştir"
                tone="danger"
                disabled={(i.isActive ?? true) === false}
                onClick={() => setItemDisableTarget(i)}
              >
                <TrashIcon />
              </RowAction>
            </>
          )}
        />
      </SectionCard>

      <ConfirmDialog
        open={Boolean(categoryDisableTarget)}
        title="Kategoriyi pasifleştir"
        body={
          <span>
            <strong>{categoryDisableTarget?.name}</strong> vitrinde görünmez olacak.
          </span>
        }
        confirmLabel="Pasifleştir"
        busy={busy}
        onConfirm={async () => {
          if (categoryDisableTarget) await onArchiveCategory(categoryDisableTarget.id);
          setCategoryDisableTarget(null);
        }}
        onClose={() => setCategoryDisableTarget(null)}
      />
      <ConfirmDialog
        open={Boolean(itemDisableTarget)}
        title="Ürünü pasifleştir"
        body={
          <span>
            <strong>{itemDisableTarget?.name}</strong> vitrinde görünmez olacak.
          </span>
        }
        confirmLabel="Pasifleştir"
        busy={busy}
        onConfirm={async () => {
          if (itemDisableTarget) await onArchiveItem(itemDisableTarget.id);
          setItemDisableTarget(null);
        }}
        onClose={() => setItemDisableTarget(null)}
      />

      <TenantSlideOver
        open={categoryDrawerOpen}
        busy={busy}
        title={categoryForm.id ? 'Kategoriyi düzenle' : 'Kategori Ekle'}
        description="Kategori adını ve görünürlüğünü ayarla."
        onClose={() => setCategoryDrawerOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCategoryDrawerOpen(false)} disabled={busy}>
              Vazgeç
            </Button>
            <Button onClick={saveCategory} shimmer={true} disabled={busy || !categoryForm.name.trim()}>
              {categoryForm.id ? 'Kaydet' : 'Kategori ekle'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Kategori adı">
            <Input
              value={categoryForm.name}
              placeholder="Başlangıçlar"
              onChange={(e) => setCategoryForm((c) => ({ ...c, name: e.target.value }))}
            />
          </Field>
          <Field label="Açıklama">
            <Textarea
              rows={2}
              value={categoryForm.description}
              onChange={(e) => setCategoryForm((c) => ({ ...c, description: e.target.value }))}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Görsel URL">
              <Input
                value={categoryForm.imageUrl}
                onChange={(e) => setCategoryForm((c) => ({ ...c, imageUrl: e.target.value }))}
              />
            </Field>
            <Field label="Sıra">
              <Input
                value={categoryForm.sortOrder}
                inputMode="numeric"
                onChange={(e) => setCategoryForm((c) => ({ ...c, sortOrder: e.target.value }))}
              />
            </Field>
          </div>
          <Checkbox
            label="Vitrinde görünür"
            checked={categoryForm.isActive}
            onChange={(e) => setCategoryForm((c) => ({ ...c, isActive: e.target.checked }))}
          />
        </div>
      </TenantSlideOver>

      <TenantSlideOver
        open={productDrawerOpen}
        busy={busy}
        title={itemForm.id ? 'Ürünü düzenle' : 'Ürün Ekle'}
        description="Ürün bilgilerini ve fiyatını ayarla."
        onClose={() => setProductDrawerOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setProductDrawerOpen(false)} disabled={busy}>
              Vazgeç
            </Button>
            <Button
              onClick={saveItem}
              shimmer={true}
              disabled={
                busy || !itemForm.name.trim() || !itemForm.basePrice.trim() || !itemForm.currencyId
              }
            >
              {itemForm.id ? 'Kaydet' : 'Ürün ekle'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <FormSection
            title="Ürün bilgileri"
            index={1}
            open={productSection === 'info'}
            done={productInfoComplete && productSection !== 'info'}
            summary={productInfoComplete ? itemForm.name : undefined}
            onToggle={() => setProductSection('info')}
          >
            <div className="grid gap-4">
              <Field label="Ürün adı">
                <Input
                  value={itemForm.name}
                  placeholder="Adana Kebap"
                  onChange={(e) => setItemForm((c) => ({ ...c, name: e.target.value }))}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Kategori">
                  <Select
                    value={itemForm.categoryId}
                    onChange={(e) => setItemForm((c) => ({ ...c, categoryId: e.target.value }))}
                  >
                    <option value="">Kategorisiz</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Görsel URL">
                  <Input
                    value={itemForm.imageUrl}
                    onChange={(e) => setItemForm((c) => ({ ...c, imageUrl: e.target.value }))}
                  />
                </Field>
              </div>
              <Field label="Açıklama">
                <Textarea
                  rows={2}
                  value={itemForm.description}
                  onChange={(e) => setItemForm((c) => ({ ...c, description: e.target.value }))}
                />
              </Field>
              <div className="flex justify-end">
                <Button onClick={() => setProductSection('pricing')} disabled={!productInfoComplete}>
                  Devam: Fiyat ve görünürlük
                </Button>
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Fiyat ve görünürlük"
            index={2}
            open={productSection === 'pricing'}
            summary={
              itemForm.basePrice ? `${itemForm.basePrice} ${platformCurrency}` : undefined
            }
            onToggle={() => setProductSection('pricing')}
          >
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Fiyat">
                  <Input
                    value={itemForm.basePrice}
                    inputMode="decimal"
                    onChange={(e) => setItemForm((c) => ({ ...c, basePrice: e.target.value }))}
                  />
                </Field>
                <Field label="Para birimi">
                  <Select
                    value={itemForm.currencyId}
                    onChange={(e) => setItemForm((c) => ({ ...c, currencyId: e.target.value }))}
                  >
                    <option value="">Para birimi seçin</option>
                    {currencies.map((currency) => (
                      <option key={currency.id} value={currency.id}>
                        {currency.code}
                        {currency.symbol ? ` (${currency.symbol})` : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Sıra">
                  <Input
                    value={itemForm.sortOrder}
                    inputMode="numeric"
                    onChange={(e) => setItemForm((c) => ({ ...c, sortOrder: e.target.value }))}
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Mevcudiyet" hint="Ürünün vitrinde sipariş edilebilir olma koşulu">
                  <Select
                    value={itemForm.availabilityType}
                    onChange={(e) =>
                      setItemForm((c) => ({ ...c, availabilityType: e.target.value }))
                    }
                  >
                    <option value="always">Her zaman mevcut</option>
                    <option value="inherit_store_status">Restoran açıkken mevcut</option>
                  </Select>
                </Field>
                <Checkbox
                  className="self-end pb-2.5"
                  label="Vitrinde görünür"
                  checked={itemForm.isActive}
                  onChange={(e) => setItemForm((c) => ({ ...c, isActive: e.target.checked }))}
                />
              </div>
            </div>
          </FormSection>
        </div>
      </TenantSlideOver>
    </div>
  );
}

// ─── Options tab ────────────────────────────────────────────────────────────

function OptionsTab({
  items,
  selectedItemId,
  onSelectItem,
  itemDetail,
  busy,
  groupForm,
  setGroupForm,
  optionForm,
  setOptionForm,
  onSaveGroup,
  onArchiveGroup,
  onSaveOption,
  onArchiveOption,
}: {
  items: MenuItem[];
  selectedItemId: string;
  onSelectItem: (id: string) => void;
  itemDetail: ItemDetail | null;
  busy: boolean;
  groupForm: ReturnType<typeof emptyGroupForm>;
  setGroupForm: (
    updater: (current: ReturnType<typeof emptyGroupForm>) => ReturnType<typeof emptyGroupForm>,
  ) => void;
  optionForm: ReturnType<typeof emptyOptionForm>;
  setOptionForm: (
    updater: (current: ReturnType<typeof emptyOptionForm>) => ReturnType<typeof emptyOptionForm>,
  ) => void;
  onSaveGroup: () => Promise<boolean>;
  onArchiveGroup: (id: string) => Promise<boolean>;
  onSaveOption: (groupId: string) => Promise<boolean>;
  onArchiveOption: (groupId: string, optionId: string) => Promise<boolean>;
}) {
  const [groupDrawerOpen, setGroupDrawerOpen] = useState(false);
  const [optionsGroupId, setOptionsGroupId] = useState<string | null>(null);
  const [groupDisableTarget, setGroupDisableTarget] = useState<OptionGroup | null>(null);

  const groups = itemDetail?.optionGroups ?? [];
  const optionsGroup = optionsGroupId
    ? groups.find((g) => g.id === optionsGroupId) ?? null
    : null;
  const editingOption = optionForm.groupId === optionsGroupId;

  if (items.length === 0) {
    return (
      <SectionCard title="Seçenekler & Malzemeler">
        <p className="text-[13px] text-[#78716c]">
          Önce <strong>Menü</strong> sekmesinden bir ürün ekleyin.
        </p>
      </SectionCard>
    );
  }

  function openGroupCreate() {
    setGroupForm(() => emptyGroupForm());
    setGroupDrawerOpen(true);
  }
  function openGroupEdit(group: OptionGroup) {
    setGroupForm(() => ({
      id: group.id,
      name: group.name,
      description: group.description ?? '',
      minSelections: String(group.minSelections),
      maxSelections: group.maxSelections?.toString() ?? '1',
      isRequired: Boolean(group.isRequired),
      sortOrder: String(group.sortOrder ?? 0),
      isActive: group.isActive ?? true,
    }));
    setGroupDrawerOpen(true);
  }
  async function saveGroup() {
    const ok = await onSaveGroup();
    if (ok) setGroupDrawerOpen(false);
  }

  const groupColumns: DataTableColumn<OptionGroup>[] = [
    {
      key: 'name',
      header: 'Grup',
      render: (g) => <span className="font-semibold text-[#1c1917]">{g.name}</span>,
    },
    { key: 'required', header: 'Zorunlu', render: (g) => (g.isRequired ? 'Evet' : 'Hayır') },
    {
      key: 'range',
      header: 'Min / Max',
      render: (g) => `${g.minSelections} / ${g.maxSelections ?? 1}`,
      hideOnMobile: true,
    },
    { key: 'count', header: 'Seçenek', render: (g) => g.options.length },
    {
      key: 'status',
      header: 'Durum',
      render: (g) => (
        <StatusPill active={g.isActive ?? true}>{g.isActive ?? true ? 'Aktif' : 'Pasif'}</StatusPill>
      ),
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)]">
      <SectionCard title="Ürünler" description="Seçenek eklemek için bir ürün seçin.">
        <div className="grid gap-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectItem(item.id)}
              className={cn(
                'rounded-[12px] border px-3 py-2.5 text-left transition',
                selectedItemId === item.id
                  ? 'border-[#24A94A] bg-[#EAF6EE]'
                  : 'border-[#ece2d2] bg-white hover:border-[#d6c9ad]',
              )}
            >
              <div className="text-[13px] font-semibold text-[#1c1917]">{item.name}</div>
              <div className="text-[11.5px] text-[#78716c]">
                {item.basePrice} {item.currencyCode}
              </div>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Seçenek grupları"
        description="Beden, soslar, ekstra malzemeler gibi seçimleri burada yönetin."
        toolbar={
          itemDetail ? (
            <Button onClick={openGroupCreate} shimmer={true}>
              + Ek Seçenek Grubu Ekle
            </Button>
          ) : null
        }
      >
        {!itemDetail ? (
          <p className="text-[13px] text-[#78716c]">Seçenekleri görmek için bir ürün seçin.</p>
        ) : (
          <TenantDataTable
            columns={groupColumns}
            rows={groups}
            getRowId={(g) => g.id}
            empty={
              <div className="rounded-[14px] border border-dashed border-[#ece2d2] bg-[#f7fafd] px-4 py-8 text-center">
                <p className="text-[14px] font-semibold text-[#1c1917]">
                  Bu ürün için henüz seçenek grubu yok.
                </p>
                <p className="mt-1 text-[13px] text-[#78716c]">İlk grubu ekle.</p>
                <div className="mt-3 flex justify-center">
                  <Button onClick={openGroupCreate}>+ Ek Seçenek Grubu Ekle</Button>
                </div>
              </div>
            }
            rowActions={(g) => (
              <>
                <RowAction label="Malzemeler" onClick={() => setOptionsGroupId(g.id)}>
                  <SettingsIcon />
                </RowAction>
                <RowAction label="Düzenle" onClick={() => openGroupEdit(g)}>
                  <EditIcon />
                </RowAction>
                <RowAction
                  label="Pasifleştir"
                  tone="danger"
                  disabled={(g.isActive ?? true) === false}
                  onClick={() => setGroupDisableTarget(g)}
                >
                  <TrashIcon />
                </RowAction>
              </>
            )}
          />
        )}
      </SectionCard>

      <ConfirmDialog
        open={Boolean(groupDisableTarget)}
        title="Seçenek grubunu pasifleştir"
        body={
          <span>
            <strong>{groupDisableTarget?.name}</strong> ve içindeki seçenekler vitrinde
            görünmez olacak.
          </span>
        }
        confirmLabel="Pasifleştir"
        busy={busy}
        onConfirm={async () => {
          if (groupDisableTarget) await onArchiveGroup(groupDisableTarget.id);
          setGroupDisableTarget(null);
        }}
        onClose={() => setGroupDisableTarget(null)}
      />

      <TenantSlideOver
        open={groupDrawerOpen}
        busy={busy}
        title={groupForm.id ? 'Seçenek grubunu düzenle' : 'Ek Seçenek Grubu Ekle'}
        description="Grup adı, seçim kuralları ve zorunluluk."
        onClose={() => setGroupDrawerOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setGroupDrawerOpen(false)} disabled={busy}>
              Vazgeç
            </Button>
            <Button onClick={saveGroup} shimmer={true} disabled={busy || !groupForm.name.trim()}>
              {groupForm.id ? 'Kaydet' : 'Grubu oluştur'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Grup adı">
            <Input
              value={groupForm.name}
              placeholder="Ekstra malzemeler"
              onChange={(e) => setGroupForm((c) => ({ ...c, name: e.target.value }))}
            />
          </Field>
          <Field label="Açıklama">
            <Textarea
              rows={2}
              value={groupForm.description}
              onChange={(e) => setGroupForm((c) => ({ ...c, description: e.target.value }))}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Min seçim">
              <Input
                value={groupForm.minSelections}
                inputMode="numeric"
                onChange={(e) => setGroupForm((c) => ({ ...c, minSelections: e.target.value }))}
              />
            </Field>
            <Field label="Max seçim">
              <Input
                value={groupForm.maxSelections}
                inputMode="numeric"
                onChange={(e) => setGroupForm((c) => ({ ...c, maxSelections: e.target.value }))}
              />
            </Field>
            <Field label="Sıra">
              <Input
                value={groupForm.sortOrder}
                inputMode="numeric"
                onChange={(e) => setGroupForm((c) => ({ ...c, sortOrder: e.target.value }))}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-5 rounded-[12px] bg-[#f7fafd] p-3">
            <Checkbox
              label="Zorunlu"
              checked={groupForm.isRequired}
              onChange={(e) => setGroupForm((c) => ({ ...c, isRequired: e.target.checked }))}
            />
            <Checkbox
              label="Vitrinde görünür"
              checked={groupForm.isActive}
              onChange={(e) => setGroupForm((c) => ({ ...c, isActive: e.target.checked }))}
            />
          </div>
          {!groupForm.id ? (
            <p className="rounded-[10px] bg-[#f7fafd] px-3 py-2 text-[12px] text-[#78716c]">
              Grup kaydedildikten sonra satırdaki “Malzemeler” aksiyonundan seçenek
              ekleyebilirsiniz.
            </p>
          ) : null}
        </div>
      </TenantSlideOver>

      <TenantSlideOver
        open={Boolean(optionsGroupId)}
        busy={busy}
        title={optionsGroup ? `Malzemeler — ${optionsGroup.name}` : 'Malzemeler'}
        description="Bu gruptaki seçenekleri ekle, düzenle veya pasifleştir."
        onClose={() => {
          setOptionsGroupId(null);
          setOptionForm(() => emptyOptionForm());
        }}
        footer={
          <Button
            variant="ghost"
            onClick={() => {
              setOptionsGroupId(null);
              setOptionForm(() => emptyOptionForm());
            }}
            disabled={busy}
          >
            Kapat
          </Button>
        }
      >
        {!optionsGroup ? (
          <p className="text-[13px] text-[#78716c]">Grup bulunamadı.</p>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              {optionsGroup.options.length === 0 ? (
                <div className="rounded-[12px] bg-[#f7fafd] px-3 py-3 text-[12.5px] text-[#78716c]">
                  Henüz malzeme yok.
                </div>
              ) : (
                optionsGroup.options.map((option) => (
                  <div
                    key={option.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-[#f7fafd] px-3 py-2"
                  >
                    <button
                      type="button"
                      className="flex-1 text-left"
                      onClick={() =>
                        setOptionForm(() => ({
                          groupId: optionsGroup.id,
                          id: option.id,
                          name: option.name,
                          description: option.description ?? '',
                          priceDelta: String(option.priceDelta),
                          sortOrder: String(option.sortOrder ?? 0),
                          isActive: option.isActive ?? true,
                        }))
                      }
                    >
                      <div className="text-[13px] font-semibold text-[#1c1917]">{option.name}</div>
                      <div className="text-[11.5px] text-[#78716c]">
                        {option.priceDelta >= 0 ? '+' : ''}
                        {option.priceDelta} ek
                      </div>
                    </button>
                    <StatusPill active={option.isActive ?? true}>
                      {option.isActive ?? true ? 'Aktif' : 'Pasif'}
                    </StatusPill>
                    <RowAction
                      label="Pasifleştir"
                      tone="danger"
                      disabled={busy}
                      onClick={() => void onArchiveOption(optionsGroup.id, option.id)}
                    >
                      <TrashIcon />
                    </RowAction>
                  </div>
                ))
              )}
            </div>

            <div className="grid gap-2 rounded-[12px] border border-[#ece2d2] bg-[#fafbfd] p-3">
              <div className="text-[12px] font-bold text-[#1c1917]">
                {editingOption && optionForm.id ? 'Malzemeyi güncelle' : 'Yeni malzeme ekle'}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Malzeme adı (ör. mantar)"
                  value={editingOption ? optionForm.name : ''}
                  onChange={(e) =>
                    setOptionForm(() => ({
                      ...optionForm,
                      groupId: optionsGroup.id,
                      name: e.target.value,
                    }))
                  }
                />
                <Input
                  placeholder="Ek fiyat"
                  inputMode="decimal"
                  value={editingOption ? optionForm.priceDelta : ''}
                  onChange={(e) =>
                    setOptionForm(() => ({
                      ...optionForm,
                      groupId: optionsGroup.id,
                      priceDelta: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {editingOption && optionForm.id ? (
                  <Button
                    variant="ghost"
                    onClick={() => setOptionForm(() => ({ ...emptyOptionForm(), groupId: optionsGroup.id }))}
                  >
                    + Yeni
                  </Button>
                ) : null}
                <Button
                  onClick={() => void onSaveOption(optionsGroup.id)}
                  shimmer={true}
                  disabled={busy || !editingOption || !optionForm.name.trim()}
                >
                  {editingOption && optionForm.id ? 'Güncelle' : 'Ekle'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </TenantSlideOver>
    </div>
  );
}

// ─── Preview tab ────────────────────────────────────────────────────────────

function PreviewTab({ preview }: { preview: PublicPreview }) {
  if (!preview.store) {
    return (
      <SectionCard title="Müşteri önizlemesi">
        <p className="text-[13px] text-[#78716c]">
          Restoran müşterilere açıldığında bu alanda canlı vitrin görünür.
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <SectionCard title="Vitrin başlığı">
        <div className="rounded-[14px] bg-[#f7fafd] px-4 py-3">
          <div className="text-[14px] font-bold text-[#1c1917]">{preview.store.name}</div>
          <div className="mt-1 text-[12px] text-[#78716c]">
            {preview.store.category} · teslimat {preview.store.deliveryFee ?? 0} · min{' '}
            {preview.store.minimumOrderAmount ?? 0}
          </div>
        </div>
        <div className="grid gap-1.5">
          <FieldLabel>Kategoriler</FieldLabel>
          {preview.categories.length === 0 ? (
            <div className="text-[12.5px] text-[#78716c]">Görünür kategori yok.</div>
          ) : (
            preview.categories.map((category) => (
              <div
                key={category.id}
                className="rounded-[12px] border border-[#ece2d2] px-3 py-1.5 text-[13px] text-[#1c1917]"
              >
                {category.name}
                <span className="ml-2 text-[11.5px] text-[#78716c]">sıra {category.sortOrder}</span>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard title="Vitrin ürünleri" description="Müşterilerin gördüğü ilk ürünler.">
        {preview.items.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-[#ece2d2] bg-[#f7fafd] px-4 py-5 text-center text-[12.5px] text-[#78716c]">
            Vitrinde görünür ürün yok.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {preview.items.slice(0, 12).map((item) => (
              <div
                key={item.id}
                className="rounded-[14px] border border-[#ece2d2] bg-white px-3.5 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[13.5px] font-semibold text-[#1c1917]">{item.name}</div>
                    <div className="text-[11.5px] text-[#78716c]">
                      {item.categoryName ?? 'Kategorisiz'}
                    </div>
                  </div>
                  <div className="text-[13px] font-bold text-[#24A94A]">
                    {item.basePrice} {item.currencyCode}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
