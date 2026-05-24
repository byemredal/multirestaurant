import { ApiProperty } from '@nestjs/swagger';
import { CartItemResponseDto } from '../../cart/dto/cart-response.dto';

export class CheckoutBlockingIssueResponseDto {
  @ApiProperty({ example: 'MENU_ITEM_PRICE_CHANGED' })
  code: string;

  @ApiProperty({ example: 'Price changed for \"Harbor Bowl\".' })
  message: string;

  @ApiProperty({ example: 'menu_item', nullable: true })
  entityType: string | null;

  @ApiProperty({ example: 'e7da8e47-b4da-4a09-b3d3-13bca41787da', nullable: true })
  entityId: string | null;

  @ApiProperty({ example: 'Harbor Bowl', nullable: true })
  entityName: string | null;

  @ApiProperty({ example: true })
  canRetry: boolean;
}

export class OrderStatusEventResponseDto {
  @ApiProperty({ example: '90eb9536-2e71-44dc-8751-ea770eea52e1' })
  id: string;

  @ApiProperty({ example: 'f86a705f-9c63-4bb1-bd79-7ed93a4d69f8' })
  orderId: string;

  @ApiProperty({ example: null, nullable: true })
  fromStatus: string | null;

  @ApiProperty({ example: 'confirmed' })
  toStatus: string;

  @ApiProperty({ example: 'tenant' })
  actorType: string;

  @ApiProperty({ example: 'a4aac52a-820d-4404-a64d-12052b06b839' })
  actorId: string;

  @ApiProperty({ example: 'Kitchen accepted and queued the order.', nullable: true })
  note: string | null;

  @ApiProperty({ example: '2026-04-08T14:06:41.268Z' })
  createdAt: string;
}

export class CustomerOrderOptionSelectionResponseDto {
  @ApiProperty({ example: 'b8fb582d-f78a-4fb5-9f74-375cdd9123e3' })
  id: string;

  @ApiProperty({ example: 'a1d47eaf-3263-45b5-b96c-43f83a7614fb' })
  orderItemId: string;

  @ApiProperty({ example: '924331c8-ed1f-472b-889d-eaa2b9498c7f' })
  optionGroupId: string;

  @ApiProperty({ example: '21e66e53-fc33-4406-9ed5-55e4c39aaa88' })
  optionItemId: string;

  @ApiProperty({ example: 'Size' })
  optionGroupNameSnapshot: string;

  @ApiProperty({ example: 'Large' })
  optionItemNameSnapshot: string;

  @ApiProperty({ example: 2.5 })
  optionPriceDeltaSnapshot: number;

  @ApiProperty({ example: '2026-04-08T14:06:41.268Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-04-08T14:06:41.268Z' })
  updatedAt: string;
}

export class CustomerOrderItemResponseDto {
  @ApiProperty({ example: 'a1d47eaf-3263-45b5-b96c-43f83a7614fb' })
  id: string;

  @ApiProperty({ example: '6c74ddef-491a-4ed4-8598-a9652737588d' })
  orderId: string;

  @ApiProperty({ example: 'e7da8e47-b4da-4a09-b3d3-13bca41787da' })
  menuItemId: string;

  @ApiProperty({ example: 'Stabilized Bowl' })
  itemNameSnapshot: string;

  @ApiProperty({ example: 17.5 })
  unitBasePriceSnapshot: number;

  @ApiProperty({ example: 'USD' })
  currencySnapshot: string;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: 35 })
  lineBaseTotal: number;

  @ApiProperty({ example: 5 })
  lineOptionsTotal: number;

  @ApiProperty({ example: 40 })
  lineTotal: number;

  @ApiProperty({ example: '924331c8-ed1f-472b-889d-eaa2b9498c7f:21e66e53-fc33-4406-9ed5-55e4c39aaa88' })
  selectionSignature: string;

  @ApiProperty({ example: '2026-04-08T14:06:41.268Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-04-08T14:06:41.268Z' })
  updatedAt: string;

  @ApiProperty({ type: () => [CustomerOrderOptionSelectionResponseDto] })
  selectedOptions: CustomerOrderOptionSelectionResponseDto[];
}

export class CustomerOrderResponseDto {
  @ApiProperty({ example: 'f86a705f-9c63-4bb1-bd79-7ed93a4d69f8' })
  id: string;

  @ApiProperty({ example: 'a4aac52a-820d-4404-a64d-12052b06b839' })
  customerAccountId: string;

  @ApiProperty({ example: '2472b721-8fcb-436d-b912-ebe6ac984653' })
  storeId: string;

  @ApiProperty({ example: 'Harbor Kitchen' })
  storeName: string;

  @ApiProperty({ example: 'pending_payment' })
  status: string;

  @ApiProperty({ example: null, nullable: true })
  rejectedReason: string | null;

  @ApiProperty({ example: null, nullable: true })
  statusNote: string | null;

  @ApiProperty({ example: '2026-04-08T14:06:41.268Z', nullable: true })
  lastStatusChangedAt: string | null;

  @ApiProperty({ example: 'customer', nullable: true })
  lastStatusChangedByType: string | null;

  @ApiProperty({ example: 40 })
  subtotalAmount: number;

  @ApiProperty({ example: 40 })
  totalAmount: number;

  @ApiProperty({ example: 'USD' })
  currency: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: true })
  canCustomerCancel: boolean;

  @ApiProperty({ example: '2026-04-08T14:06:41.268Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-04-08T14:06:41.268Z' })
  updatedAt: string;

  @ApiProperty({ type: () => [CustomerOrderItemResponseDto] })
  items: CustomerOrderItemResponseDto[];

  @ApiProperty({ type: () => [OrderStatusEventResponseDto] })
  timeline: OrderStatusEventResponseDto[];
}

export class CustomerOrderEnvelopeResponseDto {
  @ApiProperty({ type: () => CustomerOrderResponseDto })
  order: CustomerOrderResponseDto;
}

export class CustomerOrderListItemResponseDto {
  @ApiProperty({ example: 'f86a705f-9c63-4bb1-bd79-7ed93a4d69f8' })
  id: string;

  @ApiProperty({ example: '2472b721-8fcb-436d-b912-ebe6ac984653' })
  storeId: string;

  @ApiProperty({ example: 'Harbor Kitchen' })
  storeName: string;

  @ApiProperty({ example: 'pending_confirmation' })
  status: string;

  @ApiProperty({ example: 2 })
  itemCount: number;

  @ApiProperty({ example: 40 })
  totalAmount: number;

  @ApiProperty({ example: 'USD' })
  currency: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: false })
  canCustomerCancel: boolean;

  @ApiProperty({ example: '2026-04-10T10:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-04-10T10:05:00.000Z', nullable: true })
  lastStatusChangedAt: string | null;
}

export class CustomerOrderListResponseDto {
  @ApiProperty({ type: () => [CustomerOrderListItemResponseDto] })
  orders: CustomerOrderListItemResponseDto[];
}

export class OrderValidationCartSummaryDto {
  @ApiProperty({ example: '6c74ddef-491a-4ed4-8598-a9652737588d' })
  id: string;

  @ApiProperty({ example: 'a4aac52a-820d-4404-a64d-12052b06b839' })
  customerAccountId: string;

  @ApiProperty({ example: '2472b721-8fcb-436d-b912-ebe6ac984653' })
  storeId: string;

  @ApiProperty({ example: 40 })
  subtotalAmount: number;

  @ApiProperty({ example: 40 })
  totalAmount: number;

  @ApiProperty({ example: 'USD' })
  currency: string;

  @ApiProperty({ example: '2026-04-08T14:06:41.268Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-04-08T14:06:41.268Z' })
  updatedAt: string;
}

export class OrderValidationResultDto {
  @ApiProperty({ example: true })
  isValid: boolean;

  @ApiProperty({ example: false })
  hasBlockingIssues: boolean;

  @ApiProperty({ example: true })
  canCheckout: boolean;

  @ApiProperty({ example: true })
  canUpdateCart: boolean;

  @ApiProperty({ example: true })
  canRetryCheckout: boolean;

  @ApiProperty({ example: 'checkout', nullable: true })
  nextAction: string | null;

  @ApiProperty({
    type: () => [String],
    example: [],
  })
  issues: string[];

  @ApiProperty({ type: () => [CheckoutBlockingIssueResponseDto] })
  blockingIssues: CheckoutBlockingIssueResponseDto[];

  @ApiProperty({ type: () => OrderValidationCartSummaryDto, nullable: true })
  cart: OrderValidationCartSummaryDto | null;

  @ApiProperty({ type: () => [CartItemResponseDto] })
  cartItems: CartItemResponseDto[];
}

export class OrderValidationResponseDto {
  @ApiProperty({ type: () => OrderValidationResultDto })
  validation: OrderValidationResultDto;
}

export class CheckoutReadinessResponseDto {
  @ApiProperty({ example: true })
  isReady: boolean;

  @ApiProperty({ example: false })
  hasBlockingIssues: boolean;

  @ApiProperty({ example: true })
  canCheckout: boolean;

  @ApiProperty({ example: true })
  canUpdateCart: boolean;

  @ApiProperty({ example: true })
  canRetryCheckout: boolean;

  @ApiProperty({ example: 'checkout' })
  nextAction: string;

  @ApiProperty({ type: () => [String], example: [] })
  reasons: string[];

  @ApiProperty({ type: () => [CheckoutBlockingIssueResponseDto] })
  blockingIssues: CheckoutBlockingIssueResponseDto[];

  @ApiProperty({ example: 40, nullable: true })
  subtotalAmount: number | null;

  @ApiProperty({ example: 40, nullable: true })
  totalAmount: number | null;

  @ApiProperty({ example: 'USD', nullable: true })
  currency: string | null;

  @ApiProperty({ example: null, nullable: true })
  existingPendingPaymentOrderId: string | null;

  @ApiProperty({ example: null, nullable: true })
  pendingPaymentExpiresAt: string | null;

  @ApiProperty({ type: () => OrderValidationCartSummaryDto, nullable: true })
  cart: OrderValidationCartSummaryDto | null;

  @ApiProperty({ type: () => [CartItemResponseDto] })
  cartItems: CartItemResponseDto[];
}
