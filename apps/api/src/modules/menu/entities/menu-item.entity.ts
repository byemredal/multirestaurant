export enum MenuItemAvailabilityType {
  ALWAYS = 'always',
  INHERIT_STORE_STATUS = 'inherit_store_status',
}

export interface MenuItem {
  id: string;
  storeId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: number;
  currencyId: string;
  sortOrder: number;
  isActive: boolean;
  availabilityType: MenuItemAvailabilityType;
  createdAt: Date;
  updatedAt: Date;
}
