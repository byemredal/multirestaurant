export interface StorePaymentMethod {
  id: string;
  storeId: string;
  paymentMethodId: string;
  isActive: boolean;
  sortOrder: number;
  customLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StorePaymentMethodView extends StorePaymentMethod {
  code: string;
  displayName: string;
  iconKey: string | null;
}

export interface StoreServiceType {
  id: string;
  storeId: string;
  serviceTypeId: string;
  isActive: boolean;
  sortOrder: number;
  customLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreServiceTypeView extends StoreServiceType {
  code: string;
  displayName: string;
  iconKey: string | null;
}

export interface StoreOrderingPolicy {
  id: string;
  storeId: string;
  minOrderAmount: number;
  acceptsDelivery: boolean;
  acceptsPickup: boolean;
  currencyCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoreDeliveryFeeTier {
  id: string;
  storeId: string;
  minDistanceKm: number;
  maxDistanceKm: number;
  feeAmount: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
