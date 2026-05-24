/**
 * Customer discovery — availability presentation.
 *
 * Coverage and availability are independent: a restaurant can match the
 * delivery area yet still be unavailable. This maps the backend's
 * machine-readable availability into UI-friendly, never-hidden states.
 */

import type { RestaurantAvailability } from './discovery-types';

export type AvailabilityTone = 'available' | 'warning' | 'muted';

export interface AvailabilityPresentation {
  available: boolean;
  /** Short badge label; null when fully available and open. */
  badge: string | null;
  tone: AvailabilityTone;
  /** Whether the card should still link through to the menu. */
  interactive: boolean;
}

export function describeAvailability(
  availability: RestaurantAvailability,
): AvailabilityPresentation {
  if (availability.available) {
    return {
      available: true,
      badge: availability.openNow ? null : 'Yakında açılıyor',
      tone: 'available',
      interactive: true,
    };
  }

  // Priority: hard-offline → not accepting → closed.
  if (
    availability.reasons.includes('store_unpublished') ||
    availability.reasons.includes('store_inactive')
  ) {
    return {
      available: false,
      badge: 'Hizmet dışı',
      tone: 'muted',
      interactive: false,
    };
  }
  if (availability.reasons.includes('not_accepting_orders')) {
    return {
      available: false,
      badge: 'Sipariş alınmıyor',
      tone: 'warning',
      interactive: true,
    };
  }
  if (availability.reasons.includes('closed_now')) {
    return {
      available: false,
      badge: 'Şu an kapalı',
      tone: 'warning',
      interactive: true,
    };
  }
  return {
    available: false,
    badge: 'Uygun değil',
    tone: 'muted',
    interactive: false,
  };
}
