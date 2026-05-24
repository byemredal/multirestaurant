import { ApiProperty } from '@nestjs/swagger';

export class PublicDiscoveryFacetDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  count: number;
}

export class PublicDiscoveryFiltersDto {
  @ApiProperty()
  freeDeliveryCount: number;

  @ApiProperty()
  collectionCount: number;

  @ApiProperty()
  newCount: number;
}

export class PublicDiscoveryMetadataResponseDto {
  @ApiProperty({ type: () => [PublicDiscoveryFacetDto] })
  shopTypes: PublicDiscoveryFacetDto[];

  @ApiProperty({ type: () => [PublicDiscoveryFacetDto] })
  categories: PublicDiscoveryFacetDto[];

  @ApiProperty({ type: () => PublicDiscoveryFiltersDto })
  filters: PublicDiscoveryFiltersDto;
}
