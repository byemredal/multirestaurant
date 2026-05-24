export interface Cart {
  id: string;
  customerAccountId: string;
  storeId: string;
  subtotalAmount: number;
  totalAmount: number;
  currencyId: string | null;
  currencySnapshot: string;
  serviceTypeId: string | null;
  serviceTypeSnapshot: string;
  paymentMethodId: string | null;
  paymentMethodSnapshot: string | null;
  deliveryDistanceKm: number | null;
  createdAt: Date;
  updatedAt: Date;
}
