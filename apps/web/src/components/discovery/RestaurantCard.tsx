'use client';

/**
 * Discovery restaurant card.
 *
 * Renders coverage + availability. Covered-but-unavailable restaurants are
 * shown (dimmed, badged) — never hidden — per the discovery UX rules.
 */

import Link from 'next/link';

import { describeAvailability } from '@/lib/discovery/availability';
import type { DiscoveryRestaurant } from '@/lib/discovery/discovery-types';

interface RestaurantCardProps {
  restaurant: DiscoveryRestaurant;
  accentColor?: string;
}

const CURRENCY = 'CHF';

const TONE_BADGE: Record<string, string> = {
  available: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  muted: 'bg-ink-100 text-ink-600',
};

export default function RestaurantCard({
  restaurant,
  accentColor = '#eef4fb',
}: RestaurantCardProps) {
  const presentation = describeAvailability(restaurant.availability);
  const { coverage, rating } = restaurant;
  const initials = restaurant.name.slice(0, 2).toUpperCase();

  const body = (
    <article
      className={`flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-card transition-all duration-200 ${
        presentation.interactive
          ? 'group-hover:-translate-y-0.5 group-hover:shadow-pop'
          : ''
      } ${presentation.available ? '' : 'opacity-[0.92]'}`}
    >
      {/* Cover */}
      <div
        className="relative flex h-[150px] items-center justify-center"
        style={{ backgroundColor: accentColor }}
      >
        <span
          className={`select-none text-[52px] font-black tracking-tight ${
            presentation.available ? 'opacity-20' : 'opacity-10'
          }`}
        >
          {initials}
        </span>
        {presentation.badge && (
          <span
            className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              TONE_BADGE[presentation.tone]
            }`}
          >
            {presentation.badge}
          </span>
        )}
        {rating.average !== null && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-ink-800 backdrop-blur-sm">
            <StarIcon />
            {rating.average.toFixed(1)}
            <span className="text-ink-400">({rating.count})</span>
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[16px] font-bold leading-tight text-ink-900">
          {restaurant.name}
        </h3>
        <p className="mt-0.5 text-[13px] text-ink-500">{restaurant.category}</p>

        {restaurant.cuisines.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {restaurant.cuisines.slice(0, 3).map((cuisine) => (
              <span
                key={cuisine.slug}
                className="inline-flex items-center gap-1 rounded-full bg-ink-50 px-2 py-0.5 text-[11px] font-medium text-ink-600"
              >
                {cuisine.emoji && <span aria-hidden>{cuisine.emoji}</span>}
                {cuisine.name}
              </span>
            ))}
          </div>
        )}

        {restaurant.description && (
          <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-ink-400">
            {restaurant.description}
          </p>
        )}

        {/* Coverage meta */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-ink-500">
          {coverage.estimatedDeliveryMinutes !== null && (
            <span className="inline-flex items-center gap-1">
              <ClockIcon />
              {coverage.estimatedDeliveryMinutes} dk
            </span>
          )}
          {coverage.deliveryFee !== null && (
            <span>
              {coverage.deliveryFee === 0
                ? 'Ücretsiz teslimat'
                : `${coverage.deliveryFee.toFixed(2)} ${CURRENCY} teslimat`}
            </span>
          )}
          {coverage.minimumOrderAmount !== null &&
            coverage.minimumOrderAmount > 0 && (
              <span>
                Min. {coverage.minimumOrderAmount.toFixed(2)} {CURRENCY}
              </span>
            )}
          {coverage.distanceKm !== null && (
            <span>{coverage.distanceKm.toFixed(1)} km</span>
          )}
        </div>
      </div>
    </article>
  );

  if (!presentation.interactive) {
    return (
      <div aria-label={`${restaurant.name} — şu an uygun değil`}>{body}</div>
    );
  }

  return (
    <Link
      href={`/stores/${restaurant.id}`}
      className="group block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
    >
      {body}
    </Link>
  );
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
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

function ClockIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </Icon>
  );
}

function StarIcon() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-warning-500"
    >
      <path d="M12 2.5l2.95 6.59 7.19.62-5.45 4.78 1.63 7.01L12 17.78l-6.32 3.72 1.63-7.01L1.86 9.71l7.19-.62L12 2.5Z" />
    </svg>
  );
}
