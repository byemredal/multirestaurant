export interface CartItem {
  id: string;
  cartId: string;
  menuItemId: string;
  itemNameSnapshot: string;
  unitBasePriceSnapshot: number;
  currencySnapshot: string;
  quantity: number;
  lineBaseTotal: number;
  lineOptionsTotal: number;
  lineTotal: number;
  selectionSignature: string;
  createdAt: Date;
  updatedAt: Date;
}
