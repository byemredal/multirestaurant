import { ApiProperty } from '@nestjs/swagger';

export class PublicStoreServiceTypeDto {
  @ApiProperty({ example: 'delivery', enum: ['delivery', 'pickup', 'dine_in'] })
  code: 'delivery' | 'pickup' | 'dine_in';

  @ApiProperty({ example: 'Teslimat' })
  label: string;

  @ApiProperty({ example: true })
  isActive: boolean;
}

export class PublicStoreDto {
  @ApiProperty({ example: '2472b721-8fcb-436d-b912-ebe6ac984653' })
  id: string;

  @ApiProperty({ example: 'Phase 10 Demo Kitchen' })
  name: string;

  @ApiProperty({ example: 'phase-10-demo-kitchen' })
  slug: string;

  @ApiProperty({ example: 'Mediterranean' })
  category: string;

  @ApiProperty({
    example: 'A live browse and cart smoke test store.',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    example: 'https://cdn.example.com/stores/phase-10-demo-kitchen.jpg',
    nullable: true,
  })
  imageUrl: string | null;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty({ example: 'ready_for_review' })
  onboardingStatus: string;

  @ApiProperty({
    example: true,
    description:
      'Whether the store is currently accepting orders. When false, the store is not surfaced as orderable/open (supportsDelivery and supportsCollection are forced to false).',
  })
  acceptingOrders: boolean;

  @ApiProperty({ example: true })
  supportsDelivery: boolean;

  @ApiProperty({ example: true })
  supportsCollection: boolean;

  @ApiProperty({ type: () => [PublicStoreServiceTypeDto] })
  serviceTypes: PublicStoreServiceTypeDto[];

  @ApiProperty({ example: 4.9, nullable: true })
  deliveryFee: number | null;

  @ApiProperty({ example: 25, nullable: true })
  minimumOrderAmount: number | null;

  @ApiProperty({ example: 35, nullable: true })
  estimatedDeliveryMinutes: number | null;

  @ApiProperty({ example: 'EUR' })
  currency: string;

  @ApiProperty({ example: '2026-04-08T14:06:41.240Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-04-08T14:06:41.240Z' })
  updatedAt: string;
}

export class PublicStoreListResponseDto {
  @ApiProperty({ type: () => [PublicStoreDto] })
  stores: PublicStoreDto[];
}

export class PublicStoreResponseDto {
  @ApiProperty({ type: () => PublicStoreDto })
  store: PublicStoreDto;
}
