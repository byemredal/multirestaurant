import { ApiProperty } from '@nestjs/swagger';

export class CartStoreSummaryDto {
  @ApiProperty({ example: '2472b721-8fcb-436d-b912-ebe6ac984653' })
  id: string;

  @ApiProperty({ example: 'Phase 10 Demo Kitchen', nullable: true })
  name: string | null;
}

export class CartItemOptionSelectionResponseDto {
  @ApiProperty({ example: 'b8fb582d-f78a-4fb5-9f74-375cdd9123e3' })
  id: string;

  @ApiProperty({ example: 'a1d47eaf-3263-45b5-b96c-43f83a7614fb' })
  cartItemId: string;

  @ApiProperty({ example: '924331c8-ed1f-472b-889d-eaa2b9498c7f' })
  optionGroupId: string;

  @ApiProperty({ example: '21e66e53-fc33-4406-9ed5-55e4c39aaa88' })
  optionItemId: string;

  @ApiProperty({ example: 'Size' })
  optionGroupNameSnapshot: string;

  @ApiProperty({ example: 'Large' })
  optionItemNameSnapshot: string;

  @ApiProperty({ example: 3.25 })
  optionPriceDeltaSnapshot: number;

  @ApiProperty({ example: '2026-04-08T14:06:41.268Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-04-08T14:06:41.268Z' })
  updatedAt: string;
}

export class CartItemResponseDto {
  @ApiProperty({ example: 'a1d47eaf-3263-45b5-b96c-43f83a7614fb' })
  id: string;

  @ApiProperty({ example: '6c74ddef-491a-4ed4-8598-a9652737588d' })
  cartId: string;

  @ApiProperty({ example: 'e7da8e47-b4da-4a09-b3d3-13bca41787da' })
  menuItemId: string;

  @ApiProperty({ example: 'Harbor Bowl' })
  itemNameSnapshot: string;

  @ApiProperty({ example: 18.5 })
  unitBasePriceSnapshot: number;

  @ApiProperty({ example: 'USD' })
  currencySnapshot: string;

  @ApiProperty({ example: 3 })
  quantity: number;

  @ApiProperty({ example: 55.5 })
  lineBaseTotal: number;

  @ApiProperty({ example: 9.75 })
  lineOptionsTotal: number;

  @ApiProperty({ example: 65.25 })
  lineTotal: number;

  @ApiProperty({ example: '924331c8-ed1f-472b-889d-eaa2b9498c7f:21e66e53-fc33-4406-9ed5-55e4c39aaa88' })
  selectionSignature: string;

  @ApiProperty({ example: '2026-04-08T14:06:41.268Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-04-08T14:06:41.268Z' })
  updatedAt: string;

  @ApiProperty({ type: () => [CartItemOptionSelectionResponseDto] })
  selectedOptions: CartItemOptionSelectionResponseDto[];
}

export class CartResponseDto {
  @ApiProperty({ example: '6c74ddef-491a-4ed4-8598-a9652737588d' })
  id: string;

  @ApiProperty({ example: 'a4aac52a-820d-4404-a64d-12052b06b839' })
  customerAccountId: string;

  @ApiProperty({ example: '2472b721-8fcb-436d-b912-ebe6ac984653' })
  storeId: string;

  @ApiProperty({ type: () => CartStoreSummaryDto })
  store: CartStoreSummaryDto;

  @ApiProperty({ example: 65.25 })
  subtotalAmount: number;

  @ApiProperty({ example: 65.25 })
  totalAmount: number;

  @ApiProperty({ example: 'USD' })
  currency: string;

  @ApiProperty({ example: 'Phase 10 Demo Kitchen', nullable: true })
  storeName: string | null;

  @ApiProperty({ example: 3 })
  itemCount: number;

  @ApiProperty({ example: true })
  hasItems: boolean;

  @ApiProperty({ example: true })
  canUpdateCart: boolean;

  @ApiProperty({ example: true })
  canCheckout: boolean;

  @ApiProperty({ example: '2026-04-08T14:06:41.268Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-04-08T14:06:41.268Z' })
  updatedAt: string;

  @ApiProperty({ type: () => [CartItemResponseDto] })
  items: CartItemResponseDto[];
}

export class ActiveCartResponseDto {
  @ApiProperty({
    type: () => CartResponseDto,
    nullable: true,
  })
  cart: CartResponseDto | null;
}
