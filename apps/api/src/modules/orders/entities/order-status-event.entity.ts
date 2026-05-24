import { OrderStatus } from './order.entity';

export interface OrderStatusEvent {
  id: string;
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorType: 'customer' | 'tenant' | 'system';
  actorId: string;
  note: string | null;
  createdAt: Date;
}
