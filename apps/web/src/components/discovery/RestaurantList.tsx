'use client';

/**
 * Discovery restaurant list: loading skeletons, error+retry, empty/no-coverage,
 * filtered-empty, and ready grid.
 */

import RestaurantCard from './RestaurantCard';
import type {
  DiscoveryRestaurant,
  DiscoveryState,
} from '@/lib/discovery/discovery-types';

interface RestaurantListProps {
  state: DiscoveryState;
  restaurants: DiscoveryRestaurant[];
  error: string | null;
  onRetry: () => void;
  onChangeAddress: () => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

const CARD_ACCENTS = [
  '#eef4fb',
  '#ecfdf3',
  '#fff8ed',
  '#f3eefb',
  '#fff1f0',
  '#e8f6f3',
];

export default function RestaurantList({
  state,
  restaurants,
  error,
  onRetry,
  onChangeAddress,
  hasActiveFilters = false,
  onClearFilters,
}: RestaurantListProps) {
  if (state === 'DISCOVERY_LOADING') {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div
            key={index}
            className="h-[290px] animate-pulse rounded-3xl bg-ink-100"
          />
        ))}
      </div>
    );
  }

  if (state === 'DISCOVERY_ERROR') {
    return (
      <div className="rounded-3xl border border-danger-100 bg-white p-10 text-center shadow-card">
        <h3 className="text-[17px] font-bold text-ink-900">
          Restoranlar yuklenemedi
        </h3>
        <p className="mx-auto mt-2 max-w-[420px] text-[14px] text-ink-500">
          {error ?? 'Beklenmeyen bir hata olustu.'}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex h-11 items-center rounded-full bg-primary px-6 text-[14px] font-semibold text-white transition hover:bg-primary-600"
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  if (state === 'DISCOVERY_EMPTY') {
    return (
      <div className="rounded-3xl border border-ink-100 bg-white p-12 text-center shadow-card">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ink-50 text-ink-400">
          <PinOffIcon />
        </span>
        <h3 className="mt-4 text-[18px] font-bold text-ink-900">
          {hasActiveFilters ? 'Bu filtrelerle restoran bulunamadi' : 'Bu bolgeye teslimat yok'}
        </h3>
        <p className="mx-auto mt-2 max-w-[440px] text-[14px] leading-relaxed text-ink-500">
          {hasActiveFilters
            ? 'Sectigin filtrelerle eslesen restoran yok. Filtreleri temizleyip tekrar deneyebilirsin.'
            : 'Sectigin konuma su anda hizmet veren restoran bulunmuyor. Farkli bir posta kodu veya adres dene.'}
        </p>
        <button
          type="button"
          onClick={hasActiveFilters && onClearFilters ? onClearFilters : onChangeAddress}
          className="mt-5 inline-flex h-11 items-center rounded-full bg-primary px-6 text-[14px] font-semibold text-white transition hover:bg-primary-600"
        >
          {hasActiveFilters ? 'Filtreleri temizle' : 'Adresi degistir'}
        </button>
      </div>
    );
  }

  if (state === 'DISCOVERY_READY') {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {restaurants.map((restaurant, index) => (
          <RestaurantCard
            key={restaurant.id}
            restaurant={restaurant}
            accentColor={CARD_ACCENTS[index % CARD_ACCENTS.length]}
          />
        ))}
      </div>
    );
  }

  return null;
}

function PinOffIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21s-6-4.35-6-10a6 6 0 0 1 .8-3" />
      <path d="M8.5 5.5A6 6 0 0 1 18 11c0 1.4-.37 2.74-.95 4" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
