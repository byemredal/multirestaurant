export interface CartItemOptionSelection {
  id: string;
  cartItemId: string;
  optionGroupId: string;
  optionItemId: string;
  optionGroupNameSnapshot: string;
  optionItemNameSnapshot: string;
  optionPriceDeltaSnapshot: number;
  createdAt: Date;
  updatedAt: Date;
}
