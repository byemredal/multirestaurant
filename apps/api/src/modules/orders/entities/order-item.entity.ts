export interface OrderItem {
  id: string;
  orderId: string;
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
