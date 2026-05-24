export interface Currency {
  id: string;
  code: string;
  displayName: string;
  symbol: string;
  numericCode: string | null;
  decimalDigits: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Language {
  id: string;
  code: string;
  displayName: string;
  nativeDisplayName: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoreCurrency {
  id: string;
  storeId: string;
  currencyId: string;
  isActive: boolean;
  sortOrder: number;
  customLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreLanguage {
  id: string;
  storeId: string;
  languageId: string;
  isActive: boolean;
  sortOrder: number;
  customLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMethod {
  id: string;
  code: string;
  displayName: string;
  iconKey: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceType {
  id: string;
  code: string;
  displayName: string;
  iconKey: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StorePaymentMethodAssignment {
  id: string;
  storeId: string;
  paymentMethodId: string;
  isActive: boolean;
  sortOrder: number;
  customLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreServiceTypeAssignment {
  id: string;
  storeId: string;
  serviceTypeId: string;
  isActive: boolean;
  sortOrder: number;
  customLabel: string | null;
  createdAt: string;
  updatedAt: string;
}
