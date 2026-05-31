export type StoreServiceMode =
  | 'delivery_only'
  | 'pickup_only'
  | 'delivery_and_pickup'
  | 'reservation_only';

export interface StoreSetting {
  id: string;
  storeId: string;
  defaultCurrencyId: string;
  defaultLanguageId: string;
  advancedOptionsJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface StoreTaxSetting {
  id: string;
  storeId: string;
  taxRegistrationNumber: string | null;
  priceIncludesTax: boolean;
  defaultVatRate: number;
  serviceChargeRate: number;
  invoiceFooterText: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DiscountRuleType = 'coupon' | 'automatic' | 'loyalty' | 'campaign';
export type DiscountValueType = 'percentage' | 'fixed';

export interface StoreDiscountRule {
  id: string;
  storeId: string;
  name: string;
  ruleType: DiscountRuleType;
  valueType: DiscountValueType;
  valueAmount: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreDeliveryFeeSetting {
  id: string;
  storeId: string;
  baseFee: number;
  freeDeliveryThreshold: number | null;
  surgeFeeEnabled: boolean;
  smallOrderFee: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoreReceiptSetting {
  id: string;
  storeId: string;
  headerText: string | null;
  footerText: string | null;
  showTaxBreakdown: boolean;
  showQrCode: boolean;
  layoutConfigJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface StoreReservationSetting {
  id: string;
  storeId: string;
  enabled: boolean;
  requiresApproval: boolean;
  maxPartySize: number | null;
  defaultSlotMinutes: number;
  leadTimeMinutes: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreContentSetting {
  id: string;
  storeId: string;
  defaultLocale: string;
  socialLinksJson: Record<string, unknown>;
  marketingHeadline: string | null;
  marketingDescription: string | null;
  /**
   * Per-noteType profile copy (MR-DB-HARDENING-01 Slice 7C). Keyed by
   * ProfileNoteType; replaces the legacy StoreProfileNote(+Translation) tables
   * as the active write target. Profile notes are content/marketing, not legal.
   */
  profileNotesJson: Record<string, StoreProfileNoteContent>;
  createdAt: string;
  updatedAt: string;
}

/** One profile note's content as stored under StoreContentSetting.profileNotesJson. */
export interface StoreProfileNoteContent {
  isPublished: boolean;
  translations: Array<{
    locale: string;
    title: string | null;
    body: string;
  }>;
  updatedAt?: string;
}

export type StoreSliderType = 'homepage' | 'campaign' | 'seasonal';

export interface StoreSlider {
  id: string;
  storeId: string;
  name: string;
  sliderType: StoreSliderType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoreSliderItem {
  id: string;
  sliderId: string;
  imageAssetId: string | null;
  title: string | null;
  caption: string | null;
  targetUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LegalDocumentType =
  | 'terms_and_conditions'
  | 'privacy_notice'
  | 'distance_sales';

export interface StoreLegalDocument {
  id: string;
  storeId: string;
  documentType: LegalDocumentType;
  versionLabel: string;
  isPublished: boolean;
  effectiveFrom: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreLegalDocumentTranslation {
  id: string;
  documentId: string;
  locale: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export type ProfileNoteType = 'profile' | 'story' | 'operational';

export interface StoreProfileNote {
  id: string;
  storeId: string;
  noteType: ProfileNoteType;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoreProfileNoteTranslation {
  id: string;
  noteId: string;
  locale: string;
  title: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}
