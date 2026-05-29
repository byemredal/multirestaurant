'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import TenantDashboardShell from '@/components/tenant/TenantDashboardShell';
import { usePlatformPack } from '@/lib/platform-pack-context';
import { TenantCuisinesPanel } from '@/components/tenant/TenantCuisinesPanel';
import { TenantReviewsPanel } from '@/components/tenant/TenantReviewsPanel';
import { StudioStickyBar } from '@/components/tenant/studio/StudioStickyBar';
import { CategoryRail } from '@/components/tenant/studio/CategoryRail';
import { ProductCard } from '@/components/tenant/studio/ProductCard';
import { StudioEmptyState } from '@/components/tenant/studio/StudioEmptyState';
import {
  QuickCreateProductSheet,
  type QuickCreateProductInput,
} from '@/components/tenant/studio/QuickCreateProductSheet';
import { Button } from '@lieferzonen/ui';
import { Input } from '@lieferzonen/ui';
import { Textarea } from '@lieferzonen/ui';
import { Select } from '@lieferzonen/ui';
import { useTenantAuth } from '@/lib/auth/tenant-auth-context';
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
        active ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500',
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-emerald-500' : 'bg-zinc-400')}
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

export default function TenantStudio() {
  const { session, logout } = useTenantAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [tab, setTab] = useState<StudioTab>('shop');

  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
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

  const selectedStore = useMemo(
    () => stores.find((entry) => entry.id === selectedStoreId) ?? null,
    [stores, selectedStoreId],
  );

  const userName = session
    ? `${session.tenant.firstName ?? ''} ${session.tenant.lastName ?? ''}`.trim() || 'Tenant Yönetici'
    : 'Tenant Yönetici';
  const companyName = session?.tenant.companyName ?? 'Tenant çalışma alanı';

  const loadStores = async (activeSession: StoredTenantSession) => {
    const data = (await listTenantStores(activeSession)) as Store[];
    setStores(data);
    setSelectedStoreId((current) =>
      data.some((store) => store.id === current) ? current : data[0]?.id ?? '',
    );
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

  const run = async (action: () => Promise<void>, successMessage?: string) => {
    try {
      setBusy(true);
      setError(null);
      setFeedback(null);
      await action();
      if (successMessage) setFeedback(successMessage);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'İşlem başarısız.');
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
      setStoreEditing(false);
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
    setStoreEditing(false);
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
        <StoreHeader
          stores={stores}
          selectedId={selectedStoreId}
          onSelect={(id) => setSelectedStoreId(id)}
          onNew={() => {
            setSelectedStoreId('');
            setStoreForm(emptyStoreForm());
            setStoreEditing(true);
            setTab('shop');
          }}
        />

        {feedback ? (
          <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700">
            {feedback}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5 rounded-[16px] border border-[#ece2d2] bg-white p-1.5">
          {TAB_ITEMS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={cn(
                'flex flex-1 min-w-[180px] flex-col gap-0.5 rounded-[12px] px-3.5 py-2 text-left transition',
                tab === entry.id
                  ? 'bg-[#f97316] text-white shadow-[0_8px_22px_rgba(249,115,22,0.25)]'
                  : 'text-[#44403c] hover:bg-[#f3f6fb]',
              )}
            >
              <span className="text-[13px] font-bold">{entry.label}</span>
              <span
                className={cn(
                  'text-[11px]',
                  tab === entry.id ? 'text-white/85' : 'text-[#a8a29e]',
                )}
              >
                {entry.hint}
              </span>
            </button>
          ))}
        </div>

        {tab === 'shop' ? (
          <ShopTab
            selectedStore={selectedStore}
            storeForm={storeForm}
            setStoreForm={setStoreForm}
            storeEditing={storeEditing}
            setStoreEditing={setStoreEditing}
            busy={busy}
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
              }, selectedStore ? 'Restoran güncellendi.' : 'Restoran oluşturuldu.')
            }
            onArchiveStore={() =>
              void run(async () => {
                if (!session || !selectedStore) return;
                await updateTenantStore(session, selectedStore.id, {
                  status: 'inactive',
                });
                await loadStores(session);
              }, 'Restoran arşivlendi.')
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
            selectedItemId={selectedItemId}
            onSelectItem={(id) => setSelectedItemId(id)}
            onSaveCategory={() =>
              void run(async () => {
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
            onArchiveCategory={() =>
              void run(async () => {
                if (!session || !selectedStoreId || !categoryForm.id) return;
                await updateTenantMenuCategory(
                  session,
                  selectedStoreId,
                  categoryForm.id,
                  { isActive: false },
                );
                await loadWorkspace(session, selectedStoreId);
                setCategoryForm(emptyCategoryForm());
              }, 'Kategori arşivlendi.')
            }
            onSaveItem={() =>
              void run(async () => {
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
                if (!itemForm.id) setItemForm(emptyItemForm());
              }, itemForm.id ? 'Ürün güncellendi.' : 'Ürün eklendi.')
            }
            onArchiveItem={() =>
              void run(async () => {
                if (!session || !selectedStoreId || !itemForm.id) return;
                await updateTenantMenuItem(session, selectedStoreId, itemForm.id, {
                  isActive: false,
                });
                await loadWorkspace(session, selectedStoreId);
                setItemForm(emptyItemForm());
              }, 'Ürün arşivlendi.')
            }
            onNewItem={() => setItemForm(emptyItemForm())}
            onQuickCreateProduct={(input) =>
              void run(async () => {
                if (!session || !selectedStoreId) return;
                const payload = {
                  categoryId: input.categoryId || null,
                  name: input.name,
                  description: '',
                  basePrice: Number(input.basePrice || '0'),
                  currencyId: input.currencyId,
                  sortOrder: 0,
                  availabilityType: 'always',
                  isActive: true,
                };
                await createTenantMenuItem(session, selectedStoreId, payload);
                await loadWorkspace(session, selectedStoreId);
              }, 'Ürün eklendi.')
            }
            storeIsActive={selectedStore ? selectedStore.status !== 'inactive' : true}
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
              void run(async () => {
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
            onArchiveGroup={() =>
              void run(async () => {
                if (!session || !selectedStoreId || !selectedItemId || !groupForm.id) return;
                await updateTenantOptionGroup(
                  session,
                  selectedStoreId,
                  selectedItemId,
                  groupForm.id,
                  { isActive: false },
                );
                const refreshed = await getTenantMenuItem(
                  session,
                  selectedStoreId,
                  selectedItemId,
                );
                setItemDetail(refreshed.item as ItemDetail);
                setGroupForm(emptyGroupForm());
              }, 'Seçenek grubu arşivlendi.')
            }
            onSaveOption={(groupId) =>
              void run(async () => {
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
              void run(async () => {
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

// ─── Store header ──────────────────────────────────────────────────────

function StoreHeader({
  stores,
  selectedId,
  onSelect,
  onNew,
}: {
  stores: Store[];
  selectedId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="rounded-[20px] border border-[#ece2d2] bg-white p-4 shadow-[0_8px_24px_rgba(28,25,23,0.04)] lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#a8a29e]">
            Aktif Restoran
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            {stores.length > 0 ? (
              <Select
                className="!w-auto min-w-[220px] !py-2 !text-[13.5px] !font-semibold"
                value={selectedId}
                onChange={(event) => onSelect(event.target.value)}
              >
                <option value="">Restoran seçin</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </Select>
            ) : (
              <span className="text-[14px] font-semibold text-[#1c1917]">
                Henüz restoran eklenmedi
              </span>
            )}
            <span className="text-[12.5px] text-[#78716c]">
              {stores.length > 0
                ? `${stores.length} restoran`
                : 'Çalışmaya başlamak için bir restoran oluşturun.'}
            </span>
          </div>
        </div>
        <Button onClick={onNew} variant="secondary">
          + Yeni restoran
        </Button>
      </div>
    </div>
  );
}

// ─── Shop tab ───────────────────────────────────────────────────────────────

function ShopTab({
  selectedStore,
  storeForm,
  setStoreForm,
  storeEditing,
  setStoreEditing,
  busy,
  onSaveStore,
  onArchiveStore,
}: {
  selectedStore: Store | null;
  storeForm: StoreFormState;
  setStoreForm: (updater: (current: StoreFormState) => StoreFormState) => void;
  storeEditing: boolean;
  setStoreEditing: (value: boolean) => void;
  busy: boolean;
  onSaveStore: () => void;
  onArchiveStore: () => void;
}) {
  const isCreating = !selectedStore;
  const isEditing = storeEditing || isCreating;
  const platformPack = usePlatformPack();
  const currency = platformPack?.currency || '';
  const platformCountry = platformPack?.country || '';

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

  // ── Read-only summary ────────────────────────────────────────────────
  if (!isEditing && selectedStore) {
    const addressLine = [
      selectedStore.addressLine1,
      selectedStore.postalCode,
      selectedStore.city,
      selectedStore.country,
    ]
      .filter((part) => part && String(part).trim())
      .join(', ');

    return (
      <SectionCard
        title="Restoran bilgileri"
        description="Restoranınızın profil, adres ve teslimat bilgileri."
        toolbar={
          <Button variant="secondary" onClick={() => setStoreEditing(true)}>
            Düzenle
          </Button>
        }
      >
        <div className="grid gap-3 text-[13.5px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[16px] font-bold text-[#1c1917]">{selectedStore.name}</span>
            <StatusPill active={selectedStore.status !== 'inactive'}>
              {selectedStore.status !== 'inactive' ? 'Aktif' : 'Pasif'}
            </StatusPill>
          </div>
          <div className="grid grid-cols-2 gap-3 text-[12.5px] text-[#44403c]">
            <div>
              <FieldLabel>Slug</FieldLabel>
              <div className="mt-1 font-medium text-[#1c1917]">{selectedStore.slug}</div>
            </div>
            <div>
              <FieldLabel>Kategori</FieldLabel>
              <div className="mt-1 font-medium text-[#1c1917]">{selectedStore.category}</div>
            </div>
            <div>
              <FieldLabel>Telefon</FieldLabel>
              <div className="mt-1 font-medium text-[#1c1917]">
                {selectedStore.phoneNumber || '—'}
              </div>
            </div>
            <div>
              <FieldLabel>Adres</FieldLabel>
              <div className="mt-1 font-medium text-[#1c1917]">{addressLine || '—'}</div>
            </div>
          </div>
          {selectedStore.description ? (
            <div>
              <FieldLabel>Açıklama</FieldLabel>
              <p className="mt-1 text-[13px] leading-6 text-[#44403c]">
                {selectedStore.description}
              </p>
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStoreEditing(true)}>
              Düzenle
            </Button>
            <Button variant="ghost" onClick={onArchiveStore} disabled={busy}>
              Arşivle
            </Button>
          </div>
        </div>
      </SectionCard>
    );
  }

  // ── Create / edit form ───────────────────────────────────────────────
  return (
    <div className="grid gap-4">
      <SectionCard
        title={isCreating ? 'Yeni restoran' : 'Restoran profili'}
        description={
          isCreating
            ? 'İlk restoranınızı oluşturun. Restoran; adres, çalışma saatleri ve teslimat ayarlarını tek başına taşır.'
            : 'Restoranınızın kimlik ve konum bilgilerini güncelleyin.'
        }
      >
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

        <div className="flex flex-wrap gap-4 rounded-[12px] bg-[#f7fafd] p-3 text-[13px] text-[#44403c]">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={storeForm.isActive}
              onChange={(event) =>
                setStoreForm((current) => ({ ...current, isActive: event.target.checked }))
              }
            />
            Vitrinde görünür
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Çalışma saatleri ve teslimat"
        description="Restoranın açık olduğu saatler ve hizmet verdiği teslimat bölgeleri."
      >
        <div className="grid gap-2">
          <FieldLabel>Çalışma saatleri</FieldLabel>
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
                <label className="flex items-center gap-2 text-[12px] text-[#44403c]">
                  <input
                    type="checkbox"
                    checked={Boolean(hour.isClosed)}
                    onChange={(event) => updateHour(index, { isClosed: event.target.checked })}
                  />
                  Kapalı
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <FieldLabel>Teslimat bölgeleri</FieldLabel>
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
      </SectionCard>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onSaveStore} shimmer={true} disabled={busy || !storeForm.name.trim()}>
          {isCreating ? 'Restoranı oluştur' : 'Değişiklikleri kaydet'}
        </Button>
        {!isCreating ? (
          <Button variant="ghost" shimmer={true} onClick={() => setStoreEditing(false)}>
            Vazgeç
          </Button>
        ) : null}
      </div>
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
  selectedItemId,
  onSelectItem,
  onSaveCategory,
  onArchiveCategory,
  onSaveItem,
  onArchiveItem,
  onNewItem,
  onQuickCreateProduct,
  storeIsActive,
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
  selectedItemId: string;
  onSelectItem: (id: string) => void;
  onSaveCategory: () => void;
  onArchiveCategory: () => void;
  onSaveItem: () => void;
  onArchiveItem: () => void;
  onNewItem: () => void;
  onQuickCreateProduct: (input: QuickCreateProductInput) => void;
  storeIsActive: boolean;
}) {
  // Faz C — operational studio görünümü
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);

  const productCountByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      if (item.categoryId) {
        map.set(item.categoryId, (map.get(item.categoryId) ?? 0) + 1);
      }
    }
    return map;
  }, [items]);

  const uncategorizedCount = useMemo(
    () => items.filter((i) => !i.categoryId).length,
    [items],
  );

  const filteredItems = useMemo(() => {
    if (filterCategoryId === null) return items;
    if (filterCategoryId === '__uncategorized__') return items.filter((i) => !i.categoryId);
    return items.filter((i) => i.categoryId === filterCategoryId);
  }, [items, filterCategoryId]);

  const publishedCount = items.filter((i) => (i.isActive ?? true) === true).length;
  const filterLabel =
    filterCategoryId === '__uncategorized__'
      ? 'Kategorisiz'
      : categories.find((c) => c.id === filterCategoryId)?.name;

  function handleCreateCategoryFromBar() {
    setCategoryForm(() => emptyCategoryForm());
  }

  function handleEditCategory(category: { id: string; name: string; sortOrder: number; isActive?: boolean }) {
    const full = categories.find((c) => c.id === category.id);
    if (!full) return;
    setCategoryForm(() => ({
      id: full.id,
      name: full.name,
      description: full.description ?? '',
      imageUrl: full.imageUrl ?? '',
      sortOrder: String(full.sortOrder),
      isActive: full.isActive ?? true,
    }));
  }

  function handleSelectProduct(item: MenuItem) {
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
  }

  if (disabled) {
    return (
      <SectionCard title="Menü">
        <p className="text-[13px] text-[#78716c]">Menüyü görmek için bir restoran seçin.</p>
      </SectionCard>
    );
  }

  const emptyVariant: 'no-category' | 'no-product' | 'empty-filter' =
    categories.length === 0 && items.length === 0
      ? 'no-category'
      : filterCategoryId !== null
        ? 'empty-filter'
        : 'no-product';

  return (
    <div className="grid gap-4">
      <StudioStickyBar
        categoryCount={categories.length}
        productCount={items.length}
        publishedCount={publishedCount}
        storeIsActive={storeIsActive}
        onCreateCategory={handleCreateCategoryFromBar}
        onCreateProduct={() => setQuickCreateOpen(true)}
      />

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <CategoryRail
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            sortOrder: c.sortOrder,
            isActive: c.isActive,
          }))}
          selectedCategoryId={filterCategoryId}
          productCountByCategory={productCountByCategory}
          uncategorizedCount={uncategorizedCount}
          totalCount={items.length}
          editingCategoryId={categoryForm.id || null}
          onSelect={setFilterCategoryId}
          onEdit={handleEditCategory}
        />

        <div className="min-w-0">
          {filteredItems.length === 0 ? (
            <StudioEmptyState
              variant={emptyVariant}
              filterLabel={filterLabel}
              onPrimary={() => {
                if (emptyVariant === 'no-category') {
                  handleCreateCategoryFromBar();
                } else {
                  setQuickCreateOpen(true);
                }
              }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  isSelected={selectedItemId === item.id}
                  onClick={() => handleSelectProduct(item)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <SectionCard
          title="Kategori formu"
          description="Yeni kategori ekle veya seçili kategoriyi düzenle."
          toolbar={
            categoryForm.id ? (
              <Button
                variant="ghost"
                shimmer={true}
                onClick={() => setCategoryForm(() => emptyCategoryForm())}
              >
                + Yeni
              </Button>
            ) : null
          }
        >
        <div className="grid gap-3">
          <Field label="Kategori adı">
            <Input
              value={categoryForm.name}
              placeholder="Başlangıçlar"
              onChange={(event) =>
                setCategoryForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </Field>
          <Field label="Açıklama">
            <Textarea
              rows={2}
              value={categoryForm.description}
              placeholder="Kategori için kısa açıklama..."
              onChange={(event) =>
                setCategoryForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Görsel URL">
              <Input
                value={categoryForm.imageUrl}
                onChange={(event) =>
                  setCategoryForm((current) => ({ ...current, imageUrl: event.target.value }))
                }
              />
            </Field>
            <Field label="Sıra">
              <Input
                value={categoryForm.sortOrder}
                inputMode="numeric"
                onChange={(event) =>
                  setCategoryForm((current) => ({ ...current, sortOrder: event.target.value }))
                }
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-[#44403c]">
            <input
              type="checkbox"
              checked={categoryForm.isActive}
              onChange={(event) =>
                setCategoryForm((current) => ({ ...current, isActive: event.target.checked }))
              }
            />
            Vitrinde görünür
          </label>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onSaveCategory} shimmer={true} disabled={busy || !categoryForm.name.trim()}>
              {categoryForm.id ? 'Kategoriyi güncelle' : 'Kategori ekle'}
            </Button>
            {categoryForm.id ? (
              <Button variant="ghost" shimmer={true} onClick={onArchiveCategory} disabled={busy}>
                Arşivle
              </Button>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Ürün formu"
        description="Seçili ürünü düzenle veya yeni ürünü detayları ile birlikte oluştur."
        toolbar={
          itemForm.id ? (
            <Button variant="ghost" onClick={onNewItem}>
              + Yeni
            </Button>
          ) : null
        }
      >
        <div className="grid gap-3">
          <Field label="Ürün adı">
            <Input
              value={itemForm.name}
              placeholder="Adana Kebap"
              onChange={(event) =>
                setItemForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Kategori">
              <Select
                value={itemForm.categoryId}
                onChange={(event) =>
                  setItemForm((current) => ({ ...current, categoryId: event.target.value }))
                }
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
                onChange={(event) =>
                  setItemForm((current) => ({ ...current, imageUrl: event.target.value }))
                }
              />
            </Field>
          </div>
          <Field label="Açıklama">
            <Textarea
              rows={2}
              value={itemForm.description}
              placeholder="Ürün açıklaması..."
              onChange={(event) =>
                setItemForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Fiyat">
              <Input
                value={itemForm.basePrice}
                inputMode="decimal"
                onChange={(event) =>
                  setItemForm((current) => ({ ...current, basePrice: event.target.value }))
                }
              />
            </Field>
            <Field label="Para birimi">
              <Select
                value={itemForm.currencyId}
                onChange={(event) =>
                  setItemForm((current) => ({ ...current, currencyId: event.target.value }))
                }
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
                onChange={(event) =>
                  setItemForm((current) => ({ ...current, sortOrder: event.target.value }))
                }
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mevcudiyet" hint="Ürünün vitrinde sipariş edilebilir olma koşulu">
              <Select
                value={itemForm.availabilityType}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    availabilityType: event.target.value,
                  }))
                }
              >
                <option value="always">Her zaman mevcut</option>
                <option value="inherit_store_status">Restoran açıkken mevcut</option>
              </Select>
            </Field>
            <label className="flex items-center gap-2 self-end text-[13px] text-[#44403c]">
              <input
                type="checkbox"
                checked={itemForm.isActive}
                onChange={(event) =>
                  setItemForm((current) => ({ ...current, isActive: event.target.checked }))
                }
              />
              Vitrinde görünür
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={onSaveItem}
              disabled={
                busy ||
                !itemForm.name.trim() ||
                !itemForm.basePrice.trim() ||
                !itemForm.currencyId
              }
            >
              {itemForm.id ? 'Ürünü güncelle' : 'Ürün ekle'}
            </Button>
            {itemForm.id ? (
              <Button variant="ghost" onClick={onArchiveItem} disabled={busy}>
                Arşivle
              </Button>
            ) : null}
          </div>
        </div>
      </SectionCard>
      </div>

      <QuickCreateProductSheet
        open={quickCreateOpen}
        busy={busy}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        currencies={currencies.map((c) => ({ id: c.id, code: c.code, symbol: c.symbol }))}
        defaultCategoryId={
          filterCategoryId && filterCategoryId !== '__uncategorized__' ? filterCategoryId : null
        }
        onClose={() => setQuickCreateOpen(false)}
        onSubmit={(input) => {
          onQuickCreateProduct(input);
          setQuickCreateOpen(false);
        }}
        onSwitchToFullForm={() => {
          onNewItem();
        }}
      />
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
  onSaveGroup: () => void;
  onArchiveGroup: () => void;
  onSaveOption: (groupId: string) => void;
  onArchiveOption: (groupId: string, optionId: string) => void;
}) {
  if (items.length === 0) {
    return (
      <SectionCard title="Seçenekler & Malzemeler">
        <p className="text-[13px] text-[#78716c]">
          Önce <strong>Menü</strong> sekmesinden bir ürün ekleyin.
        </p>
      </SectionCard>
    );
  }

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
                  ? 'border-[#f97316] bg-[#fff1e6]'
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
      >
        {!itemDetail ? (
          <p className="text-[13px] text-[#78716c]">Yükleniyor...</p>
        ) : (
          <>
            <div className="rounded-[14px] bg-[#f6f9ff] px-4 py-3">
              <div className="text-[12px] uppercase tracking-[0.06em] text-[#78716c]">
                Seçili ürün
              </div>
              <div className="text-[14px] font-bold text-[#1c1917]">{itemDetail.name}</div>
              <div className="text-[12px] text-[#78716c]">
                Baz fiyat: {itemDetail.basePrice} {itemDetail.currencyCode}
              </div>
            </div>

            <div className="grid gap-3 rounded-[14px] border border-[#ece2d2] bg-white p-4">
              <div className="text-[13px] font-bold text-[#1c1917]">
                {groupForm.id ? 'Seçenek grubunu güncelle' : 'Yeni seçenek grubu'}
              </div>
              <Field label="Grup adı">
                <Input
                  value={groupForm.name}
                  placeholder="Ekstra malzemeler"
                  onChange={(event) =>
                    setGroupForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </Field>
              <Field label="Açıklama">
                <Textarea
                  rows={2}
                  value={groupForm.description}
                  onChange={(event) =>
                    setGroupForm((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Min seçim">
                  <Input
                    value={groupForm.minSelections}
                    inputMode="numeric"
                    onChange={(event) =>
                      setGroupForm((current) => ({
                        ...current,
                        minSelections: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Max seçim">
                  <Input
                    value={groupForm.maxSelections}
                    inputMode="numeric"
                    onChange={(event) =>
                      setGroupForm((current) => ({
                        ...current,
                        maxSelections: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Sıra">
                  <Input
                    value={groupForm.sortOrder}
                    inputMode="numeric"
                    onChange={(event) =>
                      setGroupForm((current) => ({ ...current, sortOrder: event.target.value }))
                    }
                  />
                </Field>
              </div>
              <div className="flex flex-wrap gap-3 text-[13px] text-[#44403c]">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={groupForm.isRequired}
                    onChange={(event) =>
                      setGroupForm((current) => ({
                        ...current,
                        isRequired: event.target.checked,
                      }))
                    }
                  />
                  Zorunlu
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={groupForm.isActive}
                    onChange={(event) =>
                      setGroupForm((current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))
                    }
                  />
                  Vitrinde görünür
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={onSaveGroup} disabled={busy || !groupForm.name.trim()}>
                  {groupForm.id ? 'Grubu güncelle' : 'Grubu oluştur'}
                </Button>
                {groupForm.id ? (
                  <>
                    <Button variant="ghost" onClick={() => setGroupForm(() => emptyGroupForm())}>
                      + Yeni
                    </Button>
                    <Button variant="ghost" onClick={onArchiveGroup} disabled={busy}>
                      Arşivle
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3">
              {itemDetail.optionGroups.length === 0 ? (
                <div className="rounded-[14px] border border-dashed border-[#ece2d2] bg-[#f7fafd] px-4 py-5 text-center text-[13px] text-[#78716c]">
                  Bu ürün için henüz seçenek grubu yok.
                </div>
              ) : (
                itemDetail.optionGroups.map((group) => (
                  <OptionGroupCard
                    key={group.id}
                    group={group}
                    busy={busy}
                    optionForm={optionForm}
                    setOptionForm={setOptionForm}
                    onEditGroup={() =>
                      setGroupForm(() => ({
                        id: group.id,
                        name: group.name,
                        description: group.description ?? '',
                        minSelections: String(group.minSelections),
                        maxSelections: group.maxSelections?.toString() ?? '1',
                        isRequired: Boolean(group.isRequired),
                        sortOrder: String(group.sortOrder ?? 0),
                        isActive: group.isActive ?? true,
                      }))
                    }
                    onSaveOption={() => onSaveOption(group.id)}
                    onArchiveOption={(optionId) => onArchiveOption(group.id, optionId)}
                  />
                ))
              )}
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}

function OptionGroupCard({
  group,
  busy,
  optionForm,
  setOptionForm,
  onEditGroup,
  onSaveOption,
  onArchiveOption,
}: {
  group: OptionGroup;
  busy: boolean;
  optionForm: ReturnType<typeof emptyOptionForm>;
  setOptionForm: (
    updater: (current: ReturnType<typeof emptyOptionForm>) => ReturnType<typeof emptyOptionForm>,
  ) => void;
  onEditGroup: () => void;
  onSaveOption: () => void;
  onArchiveOption: (optionId: string) => void;
}) {
  const editingThisGroup = optionForm.groupId === group.id;
  const currency = usePlatformPack()?.currency || '';
  const setLocal = (patch: Partial<ReturnType<typeof emptyOptionForm>>) =>
    setOptionForm((current) => ({ ...current, ...patch, groupId: group.id }));

  return (
    <div className="rounded-[14px] border border-[#ece2d2] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold text-[#1c1917]">{group.name}</span>
            <StatusPill active={group.isActive ?? true}>
              {group.isActive ?? true ? 'Aktif' : 'Arşiv'}
            </StatusPill>
          </div>
          <div className="mt-0.5 text-[11.5px] text-[#78716c]">
            min {group.minSelections} · max {group.maxSelections ?? 1} ·{' '}
            {group.isRequired ? 'zorunlu' : 'opsiyonel'}
          </div>
        </div>
        <Button variant="ghost" onClick={onEditGroup}>
          Grubu düzenle
        </Button>
      </div>

      <div className="mt-3 grid gap-1.5">
        {group.options.length === 0 ? (
          <div className="rounded-[12px] bg-[#f7fafd] px-3 py-2 text-[12.5px] text-[#78716c]">
            Henüz malzeme yok.
          </div>
        ) : (
          group.options.map((option) => (
            <div
              key={option.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-[#f7fafd] px-3 py-2"
            >
              <button
                type="button"
                onClick={() =>
                  setOptionForm(() => ({
                    groupId: group.id,
                    id: option.id,
                    name: option.name,
                    description: option.description ?? '',
                    priceDelta: String(option.priceDelta),
                    sortOrder: String(option.sortOrder ?? 0),
                    isActive: option.isActive ?? true,
                  }))
                }
                className="flex-1 text-left"
              >
                <div className="text-[13px] font-semibold text-[#1c1917]">{option.name}</div>
                <div className="text-[11.5px] text-[#78716c]">
                  {option.priceDelta >= 0 ? '+' : ''}
                  {option.priceDelta} ek
                </div>
              </button>
              <StatusPill active={option.isActive ?? true}>
                {option.isActive ?? true ? 'Aktif' : 'Arşiv'}
              </StatusPill>
              <button
                type="button"
                className="text-[11.5px] font-semibold text-red-600 hover:underline"
                disabled={busy}
                onClick={() => onArchiveOption(option.id)}
              >
                Arşivle
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 grid gap-2 rounded-[12px] bg-[#fafbfd] p-3">
        <div className="text-[12px] font-bold text-[#1c1917]">
          {editingThisGroup && optionForm.id ? 'Malzemeyi güncelle' : 'Yeni malzeme ekle'}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            placeholder="Malzeme adı (ör. mantar)"
            value={editingThisGroup ? optionForm.name : ''}
            onChange={(event) => setLocal({ name: event.target.value })}
          />
          <Input
            placeholder={`Ek fiyat${currency ? ` (${currency})` : ''}`}
            inputMode="decimal"
            value={editingThisGroup ? optionForm.priceDelta : ''}
            onChange={(event) => setLocal({ priceDelta: event.target.value })}
          />
        </div>
        <Textarea
          rows={2}
          placeholder="Açıklama (opsiyonel)"
          value={editingThisGroup ? optionForm.description : ''}
          onChange={(event) => setLocal({ description: event.target.value })}
        />
        <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-[#44403c]">
          <Input
            className="!w-20"
            placeholder="Sıra"
            inputMode="numeric"
            value={editingThisGroup ? optionForm.sortOrder : ''}
            onChange={(event) => setLocal({ sortOrder: event.target.value })}
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={editingThisGroup ? optionForm.isActive : true}
              onChange={(event) => setLocal({ isActive: event.target.checked })}
            />
            Vitrinde görünür
          </label>
          <div className="ml-auto flex flex-wrap gap-2">
            {editingThisGroup && optionForm.id ? (
              <Button
                variant="ghost"
                onClick={() =>
                  setOptionForm(() => ({ ...emptyOptionForm(), groupId: group.id }))
                }
              >
                + Yeni
              </Button>
            ) : null}
            <Button onClick={onSaveOption} disabled={busy || !optionForm.name.trim() || !editingThisGroup}>
              {editingThisGroup && optionForm.id ? 'Güncelle' : 'Ekle'}
            </Button>
          </div>
        </div>
      </div>
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
                  <div className="text-[13px] font-bold text-[#f97316]">
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
