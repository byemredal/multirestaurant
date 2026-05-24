export enum OrderStatus {
  PENDING_PAYMENT = 'pending_payment',
  PAYMENT_PROCESSING = 'payment_processing',
  PAYMENT_FAILED = 'payment_failed',
  PENDING_CONFIRMATION = 'pending_confirmation',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY = 'ready',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export interface Order {
  id: string;
  customerAccountId: string;
  storeId: string;
  status: OrderStatus;
  rejectedReason: string | null;
  statusNote: string | null;
  lastStatusChangedAt: Date | null;
  lastStatusChangedByType: 'customer' | 'tenant' | 'system' | null;
  subtotalAmount: number;
  totalAmount: number;
  currencyId: string | null;
  currencySnapshot: string;
  serviceTypeId: string | null;
  serviceTypeSnapshot: string;
  paymentMethodId: string | null;
  paymentMethodSnapshot: string | null;
  deliveryFeeAmount: number;
  deliveryDistanceKm: number | null;
  createdAt: Date;
  updatedAt: Date;
}
