export interface OrderItemOptionSelection {
  id: string;
  orderItemId: string;
  optionGroupId: string;
  optionItemId: string;
  optionGroupNameSnapshot: string;
  optionItemNameSnapshot: string;
  optionPriceDeltaSnapshot: number;
  createdAt: Date;
  updatedAt: Date;
}
