import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import {
  DeliveryZoneInputDto,
  OpeningHourInputDto,
} from './store-operations.dto';

export class CreateStoreDto {
  @ApiProperty({ example: 'Harbor Kitchen' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 160)
  name: string;

  @ApiPropertyOptional({
    example: 'harbor-kitchen',
    description: 'Optional slug. Generated from name when omitted.',
  })
  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/)
  slug?: string;

  @ApiProperty({ example: 'Mediterranean' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 80)
  category: string;

  @ApiPropertyOptional({
    example: 'Seasonal bowls, grilled plates, and house-made sauces.',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/stores/harbor-kitchen.jpg',
  })
  @IsString()
  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;

  // --- Operational / location data for the store ---

  @ApiPropertyOptional({ example: 'Kirchenstrasse 12' })
  @IsString()
  @IsOptional()
  @Length(5, 200)
  addressLine1?: string;

  @ApiPropertyOptional({ example: 'Floor 2' })
  @IsString()
  @IsOptional()
  @Length(0, 200)
  addressLine2?: string;

  @ApiPropertyOptional({ example: 'Zug' })
  @IsString()
  @IsOptional()
  @Length(2, 120)
  city?: string;

  @ApiPropertyOptional({ example: '6300' })
  @IsString()
  @IsOptional()
  @Length(2, 20)
  postalCode?: string;

  @ApiPropertyOptional({ example: 'Switzerland' })
  @IsString()
  @IsOptional()
  @Length(2, 120)
  country?: string;

  @ApiPropertyOptional({ example: 47.1661 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: 8.5163 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ example: '+41 41 711 00 01' })
  @IsString()
  @IsOptional()
  @Matches(/^(\+\d{1,3}[-\s]?)?\d{10,14}$/)
  phoneNumber?: string;

  @ApiPropertyOptional({ type: [OpeningHourInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpeningHourInputDto)
  @IsOptional()
  openingHours?: OpeningHourInputDto[];

  @ApiPropertyOptional({ type: [DeliveryZoneInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryZoneInputDto)
  @IsOptional()
  deliveryZones?: DeliveryZoneInputDto[];
}
