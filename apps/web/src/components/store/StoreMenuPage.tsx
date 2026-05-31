'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart/cart-context';
import { apiBaseUrl } from '@/lib/config';
import HomeHeader from '@/components/shell/HomeHeader';

type StoreCuisine = {
  id: string;
  slug: string;
  name: string;
  emoji: string | null;
  isPrimary: boolean;
};

type StoreReviewSummary = {
  averageRating: number | null;
  totalReviews: number;
};

type StoreServiceType = {
  code: 'delivery' | 'pickup' | 'dine_in';
  label: string;
  isActive: boolean;
};

type StoreOpeningHour = {
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
};

type Store = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  imageUrl: string | null;
  status: string;
  // Operational order-acceptance switch (MR-DB-HARDENING-01 Slice 1B). When
  // false the store stays listable but is not orderable. Optional for backward
  // compatibility with older API responses (treated as accepting when absent).
  acceptingOrders?: boolean;
  supportsDelivery: boolean;
  supportsCollection: boolean;
  deliveryFee: number | null;
  minimumOrderAmount: number | null;
  estimatedDeliveryMinutes: number | null;
  currency: string;
  // Public location/contact fields — returned by the public store endpoint.
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  phoneNumber?: string | null;
  openingHours?: StoreOpeningHour[];
  cuisines?: StoreCuisine[];
  serviceTypes?: StoreServiceType[];
  reviewSummary?: StoreReviewSummary;
};

type MenuCategory = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  isVirtual?: boolean;
};

type MenuItem = {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: number;
  currency: string;
  sortOrder: number;
  isActive: boolean;
  availabilityType: string;
};

type PopularMenuItem = MenuItem & {
  orderedQuantity: number;
  orderCount: number;
};

type StoreReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  authorDisplayName: string;
  tenantReplyBody: string | null;
  tenantReplyAt: string | null;
  createdAt: string;
};

type ReviewsResponse = {
  reviews: StoreReview[];
  pagination: { limit: number; offset: number };
};

function Icon({
  children,
  className = 'h-5 w-5',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const BackIcon = () => (
  <Icon>
    <path d="M19 12H5M12 5l-7 7 7 7" />
  </Icon>
);
const PlusIcon = () => (
  <Icon className="h-4 w-4">
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
const MinusIcon = () => (
  <Icon className="h-4 w-4">
    <path d="M5 12h14" />
  </Icon>
);
const ClockIcon = () => (
  <Icon className="h-3.5 w-3.5">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </Icon>
);
const InfoIcon = () => (
  <Icon className="h-5 w-5">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16v-4M12 8h.01" />
  </Icon>
);
const PhoneIcon = () => (
  <Icon className="h-4 w-4">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  </Icon>
);
const PinIcon = () => (
  <Icon className="h-4 w-4">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </Icon>
);

export default function StoreMenuPage({
  storeId,
}: {
  storeId: string;
}) {
  const router = useRouter();
  const {
    addItem,
    updateQty,
    itemQty,
    totalItems,
    subtotal,
    openCart,
    hasConflict,
    cart,
    isSyncing,
    setServiceType,
  } = useCart();

  const [store, setStore] = useState<Store | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [popularItems, setPopularItems] = useState<PopularMenuItem[]>([]);
  const [reviewsData, setReviewsData] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [conflictItem, setConflictItem] = useState<MenuItem | null>(null);
  const [activeTab, setActiveTab] = useState<'menu' | 'reviews'>('menu');
  const [infoOpen, setInfoOpen] = useState(false);
  // Bumped by the error-state "Tekrar dene" button to re-trigger the load.
  const [reloadKey, setReloadKey] = useState(0);

  // Align the browsing mode with what this store actually offers. Only steers
  // while the cart is empty so a customer's in-progress choice is never
  // overridden. Prefers delivery, falls back to pickup.
  useEffect(() => {
    if (!store?.serviceTypes || store.serviceTypes.length === 0) return;
    if (cart.items.length > 0) return;
    const offered = store.serviceTypes
      .filter((type) => type.isActive)
      .map((type) => type.code)
      .filter((code): code is 'delivery' | 'pickup' => code === 'delivery' || code === 'pickup');
    if (offered.length === 0) return;
    if (!offered.includes(cart.serviceType)) {
      setServiceType(offered.includes('delivery') ? 'delivery' : 'pickup');
    }
  }, [store, cart.items.length, cart.serviceType, setServiceType]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [storeRes, categoriesRes, itemsRes, popularRes, reviewsRes] =
          await Promise.all([
            fetch(`${apiBaseUrl}/public/stores/${storeId}`, {
              signal: controller.signal,
            }),
            fetch(
              `${apiBaseUrl}/public/stores/${storeId}/menu/categories`,
              { signal: controller.signal },
            ),
            fetch(
              `${apiBaseUrl}/public/stores/${storeId}/menu/items`,
              { signal: controller.signal },
            ),
            fetch(
              `${apiBaseUrl}/public/stores/${storeId}/menu/popular`,
              { signal: controller.signal },
            ),
            fetch(
              `${apiBaseUrl}/public/stores/${storeId}/reviews?limit=10`,
              { signal: controller.signal },
            ),
          ]);

        if (!storeRes.ok) {
          throw new Error(
            storeRes.status === 404
              ? 'Store bulunamadı.'
              : 'Store bilgileri yüklenemedi.',
          );
        }

        const { store: r } = (await storeRes.json()) as {
          store: Store;
        };
        const { categories: cats = [] } = categoriesRes.ok
          ? ((await categoriesRes.json()) as { categories: MenuCategory[] })
          : { categories: [] as MenuCategory[] };
        const { items: its = [] } = itemsRes.ok
          ? ((await itemsRes.json()) as { items: MenuItem[] })
          : { items: [] as MenuItem[] };
        const { items: popular = [] } = popularRes.ok
          ? ((await popularRes.json()) as { items: PopularMenuItem[] })
          : { items: [] as PopularMenuItem[] };
        const reviewsPayload = reviewsRes.ok
          ? ((await reviewsRes.json()) as ReviewsResponse)
          : null;

        const activeCategories = cats.filter((c) => c.isActive);
        setStore(r);
        setCategories(activeCategories);
        setItems(its.filter((i) => i.isActive));
        setPopularItems(popular);
        setReviewsData(reviewsPayload);
        setActiveCategoryId(activeCategories[0]?.id ?? null);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(
            err instanceof Error ? err.message : 'Sayfa yüklenemedi.',
          );
        }
      } finally {
        setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [storeId, reloadKey]);

  const itemsByCategory = categories
    .map((cat) => ({
      cat,
      catItems: items.filter((i) => i.categoryId === cat.id),
    }))
    .filter(({ catItems }) => catItems.length > 0);

  const uncategorized = items.filter(
    (i) => !i.categoryId || !categories.some((c) => c.id === i.categoryId),
  );

  const scrollToSection = (id: string) => {
    setActiveCategoryId(id);
    document
      .getElementById(`section-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push('/');
  };

  const handleAddItem = (item: MenuItem) => {
    if (!store || isSyncing) return;
    if (hasConflict(store.id)) {
      setConflictItem(item);
      return;
    }
    addItem(store.id, store.name, {
      menuItemId: item.id,
      name: item.name,
      price: Number(item.basePrice),
      currency: item.currency || store.currency || 'CHF',
    });
  };

  const handleConflictReplace = () => {
    if (!store || !conflictItem) return;
    // Clear and add new item
    addItem(store.id, store.name, {
      menuItemId: conflictItem.id,
      name: conflictItem.name,
      price: Number(conflictItem.basePrice),
      currency: conflictItem.currency || store.currency || 'CHF',
    });
    setConflictItem(null);
  };

  if (loading) return <LoadingSkeleton />;

  if (error || !store) {
    return (
      <div className="min-h-screen bg-[#f6f6f4]">
        <HomeHeader />
        <div className="mx-auto max-w-[900px] px-5 py-8">
          <button
            onClick={goBack}
            className="inline-flex items-center gap-1.5 rounded-full px-1 text-[13px] font-medium text-[#52525b] transition hover:text-[#18181b]"
          >
            <BackIcon />
            <span>Geri</span>
          </button>
          <div className="mt-6 rounded-[20px] bg-white px-6 py-12 text-center shadow-sm">
            <p className="text-[18px] font-semibold text-[#18181b]">
              {error ?? 'Store bulunamadı.'}
            </p>
            <p className="mt-2 text-[14px] text-[#71717a]">
              Bağlantınızı kontrol edip tekrar deneyebilirsiniz.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2.5">
              <button
                onClick={() => setReloadKey((key) => key + 1)}
                className="rounded-[12px] bg-[#084799] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#063d85] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#084799] focus-visible:ring-offset-2"
              >
                Tekrar dene
              </button>
              <button
                onClick={() => router.push('/')}
                className="rounded-[12px] border border-[#e4e4e7] px-5 py-2.5 text-[14px] font-semibold text-[#18181b] transition hover:bg-[#f4f4f5]"
              >
                Ana sayfa
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // A store is orderable only when it is published (status active) AND currently
  // accepting orders. acceptingOrders may be absent on older API responses, so
  // only an explicit `false` blocks ordering.
  const isOrderable =
    store.status === 'active' && store.acceptingOrders !== false;
  const notAcceptingOrders =
    store.status === 'active' && store.acceptingOrders === false;
  const currency = store.currency ?? 'CHF';
  const cartHasItems = totalItems > 0 && cart.storeId === store.id;
  const activeServiceTypes = (store.serviceTypes ?? []).filter((t) => t.isActive);

  return (
    <div className="min-h-screen bg-[#f6f6f4]">
      {/* Global web header — consistent across all customer surfaces. */}
      <HomeHeader />

      <main className="mx-auto max-w-[1180px] px-5 pb-20 lg:px-8">
        {/* Secondary breadcrumb: back action stays page-level, not in the brand bar. */}
        <button
          onClick={goBack}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full px-1 text-[13px] font-medium text-[#52525b] transition hover:text-[#18181b]"
        >
          <BackIcon />
          <span>Geri</span>
        </button>

        {/* Hero card */}
        <section className="mt-5 overflow-hidden rounded-[22px] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <div
            className="relative flex h-[160px] items-center justify-center md:h-[200px]"
            style={{ backgroundColor: '#e8f0fe' }}
          >
            {store.imageUrl ? (
              <img
                src={store.imageUrl}
                alt={store.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="select-none text-[64px] font-black tracking-tight text-[#084799]/15">
                {store.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            {!isOrderable && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#18181b]/50">
                <span className="rounded-full bg-white px-5 py-2 text-[14px] font-semibold text-[#18181b]">
                  Şu an sipariş alınmıyor
                </span>
              </div>
            )}
          </div>

          <div className="p-5">
            <div className="flex items-start gap-2">
              <h1 className="text-[24px] font-bold text-[#18181b] lg:text-[28px]">
                {store.name}
              </h1>
              <button
                type="button"
                onClick={() => setInfoOpen(true)}
                aria-label="Restoran bilgilerini görüntüle"
                aria-haspopup="dialog"
                className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[#71717a] transition hover:bg-[#f4f4f5] hover:text-[#084799] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#084799] focus-visible:ring-offset-2"
              >
                <InfoIcon />
              </button>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-[#71717a]">
              <span>{store.category}</span>
              {store.reviewSummary && store.reviewSummary.totalReviews > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#fff8e6] px-2 py-0.5 text-[12px] font-semibold text-[#a36a00]">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                    <path d="M12 2.5l2.95 6 6.6.95-4.78 4.65 1.13 6.55L12 17.6l-5.9 3.05 1.13-6.55L2.45 9.45l6.6-.95L12 2.5z" />
                  </svg>
                  {store.reviewSummary.averageRating?.toFixed(1) ?? '—'}
                  <span className="text-[#a36a00]/70">
                    ({store.reviewSummary.totalReviews})
                  </span>
                </span>
              )}
            </div>

            {store.cuisines && store.cuisines.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {store.cuisines.map((cuisine) => (
                  <span
                    key={cuisine.id}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium ${
                      cuisine.isPrimary
                        ? 'bg-[#084799]/8 text-[#084799]'
                        : 'bg-[#f4f4f5] text-[#52525b]'
                    }`}
                  >
                    {cuisine.emoji ? <span>{cuisine.emoji}</span> : null}
                    {cuisine.name}
                  </span>
                ))}
              </div>
            )}

            {store.description ? (
              <p className="mt-3 text-[14px] leading-6 text-[#52525b]">
                {store.description}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {typeof store.estimatedDeliveryMinutes === 'number' && (
                <InfoChip>
                  <ClockIcon />
                  {store.estimatedDeliveryMinutes} dk teslimat
                </InfoChip>
              )}
              {typeof store.deliveryFee === 'number' && (
                <InfoChip>
                  {store.deliveryFee === 0
                    ? 'Ücretsiz teslimat'
                    : `${store.deliveryFee.toFixed(2)} ${currency} teslimat`}
                </InfoChip>
              )}
              {typeof store.minimumOrderAmount === 'number' &&
                store.minimumOrderAmount > 0 && (
                  <InfoChip>
                    Min. {store.minimumOrderAmount.toFixed(2)} {currency}
                  </InfoChip>
                )}
              {store.serviceTypes && store.serviceTypes.some((t) => t.isActive)
                ? store.serviceTypes
                    .filter((type) => type.isActive)
                    .map((type) => <InfoChip key={type.code}>{type.label}</InfoChip>)
                : store.supportsCollection && <InfoChip>Gel-al mevcut</InfoChip>}
            </div>
          </div>
        </section>

        {/* Store not currently accepting orders — listable but not orderable. */}
        {notAcceptingOrders && (
          <div
            role="status"
            className="mt-5 flex items-start gap-3 rounded-[16px] border border-[#fbbf24]/40 bg-[#fffbeb] px-4 py-3.5"
          >
            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#fbbf24]/20 text-[#92400e]">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5M12 16h.01" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <p className="text-[14px] font-semibold text-[#92400e]">
                Bu restoran şu anda sipariş almıyor
              </p>
              <p className="mt-0.5 text-[13px] leading-5 text-[#b45309]">
                Menüye göz atabilirsiniz; sipariş kabulü tekrar açıldığında ürün ekleyebilirsiniz.
              </p>
            </div>
          </div>
        )}

        {/* Desktop: menu/content on the left, sticky order sidebar on the right. */}
        <div className="lg:mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-7">
          <div className="min-w-0">
        {/* Tab switcher: menu / reviews */}
        <div
          role="tablist"
          aria-label="Restoran içerik sekmeleri"
          className="mt-5 inline-flex rounded-full bg-white p-1 shadow-sm"
        >
          <button
            role="tab"
            aria-selected={activeTab === 'menu'}
            onClick={() => setActiveTab('menu')}
            className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${
              activeTab === 'menu'
                ? 'bg-[#084799] text-white'
                : 'text-[#52525b] hover:bg-[#f4f4f5]'
            }`}
          >
            Menü
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'reviews'}
            onClick={() => setActiveTab('reviews')}
            className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${
              activeTab === 'reviews'
                ? 'bg-[#084799] text-white'
                : 'text-[#52525b] hover:bg-[#f4f4f5]'
            }`}
          >
            Yorumlar
            {reviewsData && reviewsData.reviews.length > 0 && (
              <span className="ml-1.5 text-[11px] opacity-80">
                {store.reviewSummary?.totalReviews ?? reviewsData.reviews.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'menu' && (
          <>
            {/* Category navigation */}
            {(popularItems.length > 0 || categories.length > 1) && (
              <nav
                aria-label="Menü kategorileri"
                className="mt-5 -mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 lg:-mx-8 lg:px-8"
              >
                {popularItems.length > 0 && (
                  <button
                    key="popular"
                    onClick={() => scrollToSection('popular')}
                    className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#084799] focus-visible:ring-offset-2 ${
                      activeCategoryId === 'popular'
                        ? 'bg-[#084799] text-white'
                        : 'bg-white text-[#18181b] shadow-sm hover:bg-[#f4f4f5]'
                    }`}
                  >
                    <span aria-hidden="true">🔥</span>
                    Popüler
                  </button>
                )}
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => scrollToSection(cat.id)}
                    className={`flex-shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#084799] focus-visible:ring-offset-2 ${
                      activeCategoryId === cat.id
                        ? 'bg-[#084799] text-white'
                        : 'bg-white text-[#18181b] shadow-sm hover:bg-[#f4f4f5]'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </nav>
            )}

        {/* Menu sections */}
        <div className="mt-5 space-y-8">
          {popularItems.length > 0 && (
            <section id="section-popular">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[18px] font-bold text-[#18181b]">
                  <span className="mr-1.5" aria-hidden="true">🔥</span>
                  Popüler
                </h2>
                <span className="text-[12px] font-medium text-[#71717a]">
                  En çok sipariş edilenler
                </span>
              </div>
              <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 lg:-mx-8 lg:px-8 lg:grid lg:grid-cols-2 lg:overflow-visible">
                {popularItems.map((item) => (
                  <div
                    key={`popular-${item.id}`}
                    className="w-[260px] flex-shrink-0 lg:w-auto"
                  >
                    <MenuItemCard
                      item={item}
                      storeCurrency={currency}
                      qty={itemQty(item.id)}
                      onAdd={() => handleAddItem(item)}
                      onIncrease={() => updateQty(item.id, itemQty(item.id) + 1)}
                      onDecrease={() => updateQty(item.id, itemQty(item.id) - 1)}
                      isOrderable={isOrderable}
                      isSyncing={isSyncing}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {itemsByCategory.length === 0 && uncategorized.length === 0 && popularItems.length === 0 ? (
            <div className="rounded-[20px] bg-white px-6 py-12 text-center shadow-sm">
              <p className="text-[16px] font-semibold text-[#18181b]">
                Henüz menü öğesi eklenmemiş
              </p>
              <p className="mt-2 text-[14px] text-[#71717a]">
                Bu restoranın menüsü yakında burada olacak.
              </p>
            </div>
          ) : null}

          {itemsByCategory.map(({ cat, catItems }) => (
            <section key={cat.id} id={`section-${cat.id}`}>
              <h2 className="mb-1 text-[18px] font-bold text-[#18181b]">
                {cat.name}
              </h2>
              {cat.description ? (
                <p className="mb-3 text-[13px] text-[#71717a]">
                  {cat.description}
                </p>
              ) : (
                <div className="mb-3" />
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {catItems.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    storeCurrency={currency}
                    qty={itemQty(item.id)}
                    onAdd={() => handleAddItem(item)}
                    onIncrease={() => updateQty(item.id, itemQty(item.id) + 1)}
                    onDecrease={() => updateQty(item.id, itemQty(item.id) - 1)}
                    isOrderable={isOrderable}
                    isSyncing={isSyncing}
                  />
                ))}
              </div>
            </section>
          ))}

          {uncategorized.length > 0 && (
            <section id="section-uncategorized">
              <h2 className="mb-3 text-[18px] font-bold text-[#18181b]">
                Diğer
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {uncategorized.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    storeCurrency={currency}
                    qty={itemQty(item.id)}
                    onAdd={() => handleAddItem(item)}
                    onIncrease={() => updateQty(item.id, itemQty(item.id) + 1)}
                    onDecrease={() => updateQty(item.id, itemQty(item.id) - 1)}
                    isOrderable={isOrderable}
                    isSyncing={isSyncing}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
          </>
        )}

        {activeTab === 'reviews' && (
          <ReviewsPanel
            summary={store.reviewSummary ?? null}
            reviews={reviewsData?.reviews ?? []}
          />
        )}
          </div>

          {/* Desktop sticky order sidebar — hidden on mobile (sticky bottom bar covers it). */}
          <aside className="hidden lg:block lg:sticky lg:top-5">
            <div className="rounded-[20px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <h2 className="text-[15px] font-bold text-[#18181b]">Sipariş özeti</h2>
              <dl className="mt-3 space-y-2 text-[13px]">
                {typeof store.estimatedDeliveryMinutes === 'number' && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#71717a]">Teslimat süresi</dt>
                    <dd className="font-semibold text-[#18181b]">
                      {store.estimatedDeliveryMinutes} dk
                    </dd>
                  </div>
                )}
                {typeof store.deliveryFee === 'number' && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#71717a]">Teslimat ücreti</dt>
                    <dd className="font-semibold text-[#18181b]">
                      {store.deliveryFee === 0
                        ? 'Ücretsiz'
                        : `${store.deliveryFee.toFixed(2)} ${currency}`}
                    </dd>
                  </div>
                )}
                {typeof store.minimumOrderAmount === 'number' &&
                  store.minimumOrderAmount > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[#71717a]">Minimum sipariş</dt>
                      <dd className="font-semibold text-[#18181b]">
                        {store.minimumOrderAmount.toFixed(2)} {currency}
                      </dd>
                    </div>
                  )}
              </dl>

              {activeServiceTypes.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {activeServiceTypes.map((type) => (
                    <span
                      key={type.code}
                      className="inline-flex items-center rounded-full bg-[#f4f4f5] px-2.5 py-1 text-[11.5px] font-medium text-[#52525b]"
                    >
                      {type.label}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-5 border-t border-[#f0f0ef] pt-4">
                {cartHasItems ? (
                  <button
                    onClick={openCart}
                    className="flex w-full items-center justify-between rounded-[14px] bg-[#084799] px-4 py-3 text-white transition hover:bg-[#063d85] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#084799] focus-visible:ring-offset-2"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[12px] font-bold">
                      {totalItems}
                    </span>
                    <span className="text-[14px] font-semibold">Sepeti Görüntüle</span>
                    <span className="text-[14px] font-semibold">
                      {subtotal.toFixed(2)} {currency}
                    </span>
                  </button>
                ) : notAcceptingOrders ? (
                  <p className="text-[13px] leading-5 text-[#b45309]">
                    Bu restoran şu anda sipariş almıyor. Daha sonra tekrar deneyin.
                  </p>
                ) : (
                  <p className="text-[13px] leading-5 text-[#71717a]">
                    Menüden ürün ekleyerek siparişinizi oluşturun.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Sticky cart bar — visible on mobile when cart has items */}
      {cartHasItems && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#e4e4e7] bg-white p-4 shadow-[0_-4px_16px_rgba(0,0,0,0.07)] sm:hidden">
          <button
            onClick={openCart}
            className="flex w-full items-center justify-between rounded-[14px] bg-[#084799] px-5 py-3.5 text-white transition active:scale-[0.98]"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-[13px] font-bold">
              {totalItems}
            </span>
            <span className="text-[15px] font-semibold">Sepeti Görüntüle</span>
            <span className="text-[15px] font-semibold">
              {subtotal.toFixed(2)} {currency}
            </span>
          </button>
        </div>
      )}

      {/* Public restaurant info drawer */}
      <StoreInfoDrawer
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        store={store}
        currency={currency}
      />

      {/* Store conflict dialog */}
      {conflictItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#18181b]/40 px-5">
          <div className="w-full max-w-[400px] overflow-hidden rounded-[20px] bg-white shadow-[0_24px_64px_rgba(0,0,0,0.2)]">
            <div className="p-6">
              <h3 className="text-[17px] font-bold text-[#18181b]">
                Farklı restoran
              </h3>
              <p className="mt-2 text-[14px] text-[#71717a]">
                Sepetinizde{' '}
                <strong className="text-[#18181b]">{cart.storeName}</strong>{' '}
                restoranından ürünler var. Yeni ürün eklemek için mevcut sepeti
                temizlemeniz gerekiyor.
              </p>
            </div>
            <div className="flex gap-2 border-t border-[#f4f4f5] px-6 py-4">
              <button
                onClick={() => setConflictItem(null)}
                className="flex-1 rounded-[12px] border border-[#e4e4e7] py-3 text-[14px] font-semibold text-[#18181b] transition hover:bg-[#f4f4f5]"
              >
                İptal
              </button>
              <button
                onClick={handleConflictReplace}
                className="flex-1 rounded-[12px] bg-[#ef4444] py-3 text-[14px] font-semibold text-white transition hover:bg-[#dc2626]"
              >
                Sepeti Temizle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4f4f5] px-3 py-1.5 text-[12px] font-medium text-[#52525b]">
      {children}
    </span>
  );
}

function MenuItemCard({
  item,
  storeCurrency,
  qty,
  onAdd,
  onIncrease,
  onDecrease,
  isOrderable,
  isSyncing,
}: {
  item: MenuItem;
  storeCurrency: string;
  qty: number;
  onAdd: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
  isOrderable: boolean;
  isSyncing: boolean;
}) {
  const currency = item.currency ?? storeCurrency;

  return (
    <div className="flex gap-3 rounded-[16px] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
      {/* Image / fallback */}
      <div className="h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-[12px] bg-[#f4f4f5]">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center select-none">
            <span className="text-[22px] font-bold text-[#d4d4d8]">
              {item.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <h3 className="text-[14px] font-semibold leading-tight text-[#18181b]">
          {item.name}
        </h3>
        {item.description ? (
          <p className="mt-1 line-clamp-2 text-[12px] leading-4 text-[#71717a]">
            {item.description}
          </p>
        ) : null}

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="text-[14px] font-bold text-[#18181b]">
            {Number(item.basePrice).toFixed(2)} {currency}
          </span>

          {/* Cart controls */}
          {!isOrderable ? (
            <span className="text-[12px] text-[#a1a1aa]">Kapalı</span>
          ) : qty === 0 ? (
            <button
              onClick={onAdd}
              disabled={isSyncing}
              aria-label={`${item.name} sepete ekle`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#084799] text-white transition hover:bg-[#063d85] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#084799] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onDecrease}
                disabled={isSyncing}
                aria-label="Azalt"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e4e4e7] text-[#18181b] transition hover:bg-[#f4f4f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#084799] focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MinusIcon />
              </button>
              <span className="min-w-[20px] text-center text-[14px] font-bold text-[#18181b]">
                {qty}
              </span>
              <button
                onClick={onIncrease}
                disabled={isSyncing}
                aria-label="Artır"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#084799] text-white transition hover:bg-[#063d85] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#084799] focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlusIcon />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const DAY_LABELS: Record<string, string> = {
  monday: 'Pazartesi',
  tuesday: 'Salı',
  wednesday: 'Çarşamba',
  thursday: 'Perşembe',
  friday: 'Cuma',
  saturday: 'Cumartesi',
  sunday: 'Pazar',
};

function StoreInfoDrawer({
  open,
  onClose,
  store,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  store: Store;
  currency: string;
}) {
  // Escape-to-close + body scroll lock while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const addressParts = [
    store.addressLine1,
    store.addressLine2,
    [store.postalCode, store.city].filter(Boolean).join(' '),
    store.country,
  ].filter((part): part is string => Boolean(part && part.trim()));
  const hasAddress = addressParts.length > 0;
  const openingHours = (store.openingHours ?? []).filter(Boolean);
  const activeServiceTypes = (store.serviceTypes ?? []).filter((t) => t.isActive);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Kapat"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-[#18181b]/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${store.name} bilgileri`}
        className="absolute inset-y-0 right-0 flex h-full w-full max-w-[440px] flex-col bg-white shadow-[0_0_48px_rgba(0,0,0,0.18)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#f0f0ef] px-5 py-4">
          <h2 className="text-[17px] font-bold text-[#18181b]">Restoran bilgileri</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#71717a] transition hover:bg-[#f4f4f5] hover:text-[#18181b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#084799] focus-visible:ring-offset-2"
          >
            <Icon className="h-5 w-5">
              <path d="M6 6l12 12M18 6L6 18" />
            </Icon>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <h3 className="text-[19px] font-bold text-[#18181b]">{store.name}</h3>
          <p className="mt-0.5 text-[13px] text-[#71717a]">{store.category}</p>

          {store.cuisines && store.cuisines.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {store.cuisines.map((cuisine) => (
                <span
                  key={cuisine.id}
                  className="inline-flex items-center gap-1 rounded-full bg-[#f4f4f5] px-2.5 py-1 text-[11.5px] font-medium text-[#52525b]"
                >
                  {cuisine.emoji ? <span>{cuisine.emoji}</span> : null}
                  {cuisine.name}
                </span>
              ))}
            </div>
          )}

          {store.description ? (
            <p className="mt-4 text-[14px] leading-6 text-[#3f3f46]">{store.description}</p>
          ) : null}

          <DrawerSection title="Adres">
            {hasAddress ? (
              <div className="flex gap-2.5 text-[14px] leading-6 text-[#3f3f46]">
                <span className="mt-0.5 flex-shrink-0 text-[#a1a1aa]">
                  <PinIcon />
                </span>
                <span>
                  {addressParts.map((part, idx) => (
                    <span key={idx} className="block">
                      {part}
                    </span>
                  ))}
                </span>
              </div>
            ) : (
              <EmptyHint>Bu bilgi henüz eklenmemiş.</EmptyHint>
            )}
          </DrawerSection>

          <DrawerSection title="İletişim">
            {store.phoneNumber ? (
              <a
                href={`tel:${store.phoneNumber}`}
                className="inline-flex items-center gap-2.5 text-[14px] font-medium text-[#084799] transition hover:underline"
              >
                <span className="text-[#a1a1aa]">
                  <PhoneIcon />
                </span>
                {store.phoneNumber}
              </a>
            ) : (
              <EmptyHint>Bu bilgi henüz eklenmemiş.</EmptyHint>
            )}
          </DrawerSection>

          <DrawerSection title="Servis türleri">
            {activeServiceTypes.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {activeServiceTypes.map((type) => (
                  <span
                    key={type.code}
                    className="inline-flex items-center rounded-full bg-[#084799]/8 px-3 py-1 text-[12px] font-medium text-[#084799]"
                  >
                    {type.label}
                  </span>
                ))}
              </div>
            ) : (
              <EmptyHint>Bu bilgi henüz eklenmemiş.</EmptyHint>
            )}
          </DrawerSection>

          <DrawerSection title="Sipariş bilgileri">
            <ul className="space-y-1.5 text-[14px] text-[#3f3f46]">
              {typeof store.estimatedDeliveryMinutes === 'number' && (
                <li>Tahmini teslimat: {store.estimatedDeliveryMinutes} dk</li>
              )}
              {typeof store.deliveryFee === 'number' && (
                <li>
                  Teslimat ücreti:{' '}
                  {store.deliveryFee === 0
                    ? 'Ücretsiz'
                    : `${store.deliveryFee.toFixed(2)} ${currency}`}
                </li>
              )}
              {typeof store.minimumOrderAmount === 'number' &&
                store.minimumOrderAmount > 0 && (
                  <li>
                    Minimum sipariş: {store.minimumOrderAmount.toFixed(2)} {currency}
                  </li>
                )}
              {typeof store.estimatedDeliveryMinutes !== 'number' &&
                typeof store.deliveryFee !== 'number' &&
                !(store.minimumOrderAmount && store.minimumOrderAmount > 0) && (
                  <EmptyHint>Bu bilgi henüz eklenmemiş.</EmptyHint>
                )}
            </ul>
          </DrawerSection>

          <DrawerSection title="Çalışma saatleri">
            {openingHours.length > 0 ? (
              <ul className="space-y-1 text-[14px] text-[#3f3f46]">
                {openingHours.map((hour, idx) => (
                  <li key={idx} className="flex justify-between gap-4">
                    <span>{DAY_LABELS[hour.dayOfWeek] ?? hour.dayOfWeek}</span>
                    <span className="text-[#71717a]">
                      {hour.isClosed
                        ? 'Kapalı'
                        : `${hour.openTime} – ${hour.closeTime}`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyHint>Bu bilgi henüz eklenmemiş.</EmptyHint>
            )}
          </DrawerSection>
        </div>
      </div>
    </div>
  );
}

function DrawerSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-5 border-t border-[#f0f0ef] pt-4">
      <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#a1a1aa]">
        {title}
      </h4>
      {children}
    </div>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="text-[13px] italic text-[#a1a1aa]">{children}</p>;
}

function ReviewsPanel({
  summary,
  reviews,
}: {
  summary: StoreReviewSummary | null;
  reviews: StoreReview[];
}) {
  const formatter = new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  if (!summary || summary.totalReviews === 0) {
    return (
      <div className="mt-5 rounded-[20px] bg-white px-6 py-12 text-center shadow-sm">
        <p className="text-[16px] font-semibold text-[#18181b]">Henüz yorum yok</p>
        <p className="mt-2 text-[14px] text-[#71717a]">
          Sipariş verdikten sonra deneyiminizi paylaşabilirsiniz.
        </p>
      </div>
    );
  }

  const avg = summary.averageRating ?? 0;
  const filled = Math.round(avg);

  return (
    <div className="mt-5 space-y-4">
      <section className="rounded-[20px] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[36px] font-bold leading-none text-[#18181b]">
              {avg.toFixed(1)}
            </span>
            <span className="mt-1 text-[12px] text-[#71717a]">
              {summary.totalReviews} yorum
            </span>
          </div>
          <div className="flex flex-col">
            <div className="flex" aria-label={`Ortalama puan: ${avg.toFixed(1)}`}>
              {Array.from({ length: 5 }).map((_, idx) => (
                <svg
                  key={idx}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className={`h-5 w-5 ${idx < filled ? 'text-[#f5a623]' : 'text-[#e4e4e7]'}`}
                  fill="currentColor"
                >
                  <path d="M12 2.5l2.95 6 6.6.95-4.78 4.65 1.13 6.55L12 17.6l-5.9 3.05 1.13-6.55L2.45 9.45l6.6-.95L12 2.5z" />
                </svg>
              ))}
            </div>
            <span className="mt-1 text-[12px] text-[#71717a]">
              Yalnızca tamamlanmış siparişler değerlendirilebilir.
            </span>
          </div>
        </div>
      </section>

      <ul className="space-y-3">
        {reviews.map((review) => (
          <li key={review.id} className="rounded-[18px] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f4f5] text-[13px] font-bold text-[#52525b]">
                  {review.authorDisplayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-[13.5px] font-semibold text-[#18181b]">
                    {review.authorDisplayName}
                  </span>
                  <span className="text-[11.5px] text-[#a1a1aa]">
                    {formatter.format(new Date(review.createdAt))}
                  </span>
                </div>
              </div>
              <div className="flex" aria-label={`Puan: ${review.rating}`}>
                {Array.from({ length: 5 }).map((_, idx) => (
                  <svg
                    key={idx}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 ${idx < review.rating ? 'text-[#f5a623]' : 'text-[#e4e4e7]'}`}
                    fill="currentColor"
                  >
                    <path d="M12 2.5l2.95 6 6.6.95-4.78 4.65 1.13 6.55L12 17.6l-5.9 3.05 1.13-6.55L2.45 9.45l6.6-.95L12 2.5z" />
                  </svg>
                ))}
              </div>
            </div>
            {review.title ? (
              <p className="mt-3 text-[14.5px] font-semibold text-[#18181b]">
                {review.title}
              </p>
            ) : null}
            {review.body ? (
              <p className="mt-2 text-[14px] leading-6 text-[#52525b]">{review.body}</p>
            ) : null}

            {review.tenantReplyBody && (
              <div className="mt-4 rounded-[14px] border border-[#e4e4e7] bg-[#fbfaf6] p-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#084799] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-white">
                    Resmi cevap
                  </span>
                  {review.tenantReplyAt ? (
                    <span className="text-[11.5px] text-[#a1a1aa]">
                      {formatter.format(new Date(review.tenantReplyAt))}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-[13.5px] leading-6 text-[#3f3f46]">
                  {review.tenantReplyBody}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#f6f6f4]">
      <HomeHeader />
      <div className="mx-auto max-w-[900px] px-5 py-5">
        <div className="animate-pulse space-y-4">
          <div className="h-[200px] rounded-[22px] bg-[#e4e4e7]" />
          <div className="h-7 w-40 rounded-full bg-[#e4e4e7]" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[100px] rounded-[16px] bg-[#e4e4e7]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
