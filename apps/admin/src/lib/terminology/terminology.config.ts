/**
 * Terminology abstraction.
 *
 * The platform's domain model is `Tenant → Store`, but the visible labels
 * must be swappable per installation without touching pages or components.
 * Pages/components read terms through {@link useTerminology}; they never
 * hard-code "Tenant" / "Store" strings.
 *
 * No backend support is required yet — the active preset is a frontend-only
 * concern resolved at render time.
 */

export type TerminologyKey = 'tenant' | 'store';

export type Term = {
  /** "Tenant" */
  singular: string;
  /** "Tenants" */
  plural: string;
};

export type TerminologyPreset = Record<TerminologyKey, Term>;

export type TerminologyPresetId =
  | 'tenant-store'
  | 'partner-restaurant'
  | 'brand-location'
  | 'merchant-shop';

type PresetMeta = {
  id: TerminologyPresetId;
  /** Human label shown in the terminology switcher. */
  label: string;
  terms: TerminologyPreset;
};

export const terminologyPresets: Record<TerminologyPresetId, PresetMeta> = {
  'tenant-store': {
    id: 'tenant-store',
    label: 'Tenant / Store',
    terms: {
      tenant: { singular: 'Tenant', plural: 'Tenants' },
      store: { singular: 'Store', plural: 'Stores' },
    },
  },
  'partner-restaurant': {
    id: 'partner-restaurant',
    label: 'Partner / Restaurant',
    terms: {
      tenant: { singular: 'Partner', plural: 'Partners' },
      store: { singular: 'Restaurant', plural: 'Restaurants' },
    },
  },
  'brand-location': {
    id: 'brand-location',
    label: 'Brand / Location',
    terms: {
      tenant: { singular: 'Brand', plural: 'Brands' },
      store: { singular: 'Location', plural: 'Locations' },
    },
  },
  'merchant-shop': {
    id: 'merchant-shop',
    label: 'Merchant / Shop',
    terms: {
      tenant: { singular: 'Merchant', plural: 'Merchants' },
      store: { singular: 'Shop', plural: 'Shops' },
    },
  },
};

export const defaultTerminologyPresetId: TerminologyPresetId = 'tenant-store';

export const terminologyPresetList = Object.values(terminologyPresets);

export function getPreset(id: TerminologyPresetId): TerminologyPreset {
  return (terminologyPresets[id] ?? terminologyPresets[defaultTerminologyPresetId]).terms;
}
