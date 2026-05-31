export enum StoreStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum StoreOnboardingStatus {
  PROFILE_PENDING = 'profile_pending',
  READY_FOR_STORE_SETUP = 'ready_for_store_setup',
  READY_FOR_REVIEW = 'ready_for_review',
}

export enum DayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday',
}

export interface StoreOpeningHour {
  id: string;
  dayOfWeek: DayOfWeek;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface StoreDeliveryZone {
  id: string;
  name: string;
  postalCodes: string[];
  radiusKm: number | null;
  minimumOrderAmount: number | null;
  deliveryFee: number | null;
  estimatedDeliveryMinutes: number | null;
}

/**
 * A Store is a complete operational location: brand identity, menu scope
 * and the location/contact/operational data for that operating site.
 */
export interface Store {
  id: string;
  ownerTenantId: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  imageUrl: string | null;
  status: StoreStatus;
  onboardingStatus: StoreOnboardingStatus;
  isActive: boolean;
  /**
   * Operational order-acceptance switch. When false the store stays listable
   * (browse) but the public storefront does not surface it as orderable/open.
   * See MR-DB-HARDENING-01 Slice 1 (public read path) / Slice 1B (this setter).
   */
  acceptingOrders: boolean;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  phoneNumber: string | null;
  openingHours: StoreOpeningHour[];
  deliveryZones: StoreDeliveryZone[];
  createdAt: Date;
  updatedAt: Date;
}
