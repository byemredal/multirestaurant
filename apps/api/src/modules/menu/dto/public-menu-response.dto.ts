import { ApiProperty } from '@nestjs/swagger';

export class PublicMenuCategoryDto {
  @ApiProperty({ example: '8dd128a4-dc0c-49e9-82d1-1e26abf2eef3' })
  id: string;

  @ApiProperty({ example: '2472b721-8fcb-436d-b912-ebe6ac984653' })
  storeId: string;

  @ApiProperty({ example: 'Bowls' })
  name: string;

  @ApiProperty({
    example: 'Balanced plates for the customer browse surface.',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    example: 'https://cdn.example.com/menu/bowls.jpg',
    nullable: true,
  })
  imageUrl: string | null;

  @ApiProperty({ example: 1 })
  sortOrder: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2026-04-08T14:06:41.248Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-04-08T14:06:41.248Z' })
  updatedAt: string;
}

export class PublicMenuCategoriesResponseDto {
  @ApiProperty({ type: () => [PublicMenuCategoryDto] })
  categories: PublicMenuCategoryDto[];
}

export class PublicMenuOptionItemDto {
  @ApiProperty({ example: '21e66e53-fc33-4406-9ed5-55e4c39aaa88' })
  id: string;

  @ApiProperty({ example: '924331c8-ed1f-472b-889d-eaa2b9498c7f' })
  optionGroupId: string;

  @ApiProperty({ example: 'Large' })
  name: string;

  @ApiProperty({ example: 3.25 })
  priceDelta: number;

  @ApiProperty({ example: 1 })
  sortOrder: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2026-04-08T14:06:41.268Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-04-08T14:06:41.268Z' })
  updatedAt: string;
}

export class PublicMenuOptionGroupDto {
  @ApiProperty({ example: '924331c8-ed1f-472b-889d-eaa2b9498c7f' })
  id: string;

  @ApiProperty({ example: 'e7da8e47-b4da-4a09-b3d3-13bca41787da' })
  menuItemId: string;

  @ApiProperty({ example: 'Size' })
  name: string;

  @ApiProperty({ example: 'Choose one serving size.', nullable: true })
  description: string | null;

  @ApiProperty({ example: 1 })
  minSelections: number;

  @ApiProperty({ example: 1 })
  maxSelections: number;

  @ApiProperty({ example: true })
  isRequired: boolean;

  @ApiProperty({ example: 1 })
  sortOrder: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2026-04-08T14:06:41.262Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-04-08T14:06:41.262Z' })
  updatedAt: string;

  @ApiProperty({ type: () => [PublicMenuOptionItemDto] })
  options: PublicMenuOptionItemDto[];
}

export class PublicMenuItemDto {
  @ApiProperty({ example: 'e7da8e47-b4da-4a09-b3d3-13bca41787da' })
  id: string;

  @ApiProperty({ example: '2472b721-8fcb-436d-b912-ebe6ac984653' })
  storeId: string;

  @ApiProperty({
    example: '8dd128a4-dc0c-49e9-82d1-1e26abf2eef3',
    nullable: true,
  })
  categoryId: string | null;

  @ApiProperty({ example: 'Harbor Bowl' })
  name: string;

  @ApiProperty({
    example: 'Warm rice, citrus chicken, and bright herb dressing.',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    example: 'https://cdn.example.com/menu/harbor-bowl.jpg',
    nullable: true,
  })
  imageUrl: string | null;

  @ApiProperty({ example: 18.5 })
  basePrice: number;

  @ApiProperty({ example: '8dd128a4-dc0c-49e9-82d1-1e26abf2eef3' })
  currencyId: string;

  @ApiProperty({ example: 'CHF' })
  currencyCode: string;

  @ApiProperty({ example: 'CHF' })
  currencySymbol: string;

  @ApiProperty({ example: 1 })
  sortOrder: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 'inherit_store_status' })
  availabilityType: string;

  @ApiProperty({ example: 'Bowls', nullable: true, required: false })
  categoryName?: string | null;

  @ApiProperty({ example: '2026-04-08T14:06:41.255Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-04-08T14:06:41.255Z' })
  updatedAt: string;
}

export class PublicMenuItemsResponseDto {
  @ApiProperty({ type: () => [PublicMenuItemDto] })
  items: PublicMenuItemDto[];
}

export class PublicMenuItemDetailDto extends PublicMenuItemDto {
  @ApiProperty({ type: () => [PublicMenuOptionGroupDto] })
  optionGroups: PublicMenuOptionGroupDto[];
}

export class PublicMenuItemResponseDto {
  @ApiProperty({ type: () => PublicMenuItemDetailDto })
  item: PublicMenuItemDetailDto;
}
