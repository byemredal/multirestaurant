import type { FulfillmentMode } from '@/lib/home-discovery';

export type StoredRegionSelection = {
  mode: FulfillmentMode;
  slug: string;
};

const REGION_STORAGE_KEY = 'home.region-selection';

function canUseStorage() {
  return typeof window !== 'undefined';
}

export function readStoredRegionSelection(): StoredRegionSelection | null {
  if (!canUseStorage()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(REGION_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as StoredRegionSelection;

    if (!parsed.slug || (parsed.mode !== 'delivery' && parsed.mode !== 'collection')) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredRegionSelection(selection: StoredRegionSelection) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(REGION_STORAGE_KEY, JSON.stringify(selection));
}

export function clearStoredRegionSelection() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(REGION_STORAGE_KEY);
}
