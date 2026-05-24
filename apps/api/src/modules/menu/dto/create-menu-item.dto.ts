import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Min,
} from 'class-validator';
import { MenuItemAvailabilityType } from '../entities/menu-item.entity';

export class CreateMenuItemDto {
  @ApiPropertyOptional({
    example: '4eddb4d0-7fa9-4d20-9b0c-5bc4ac6a7e75',
    description: 'Optional category identifier for the item.',
  })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ example: 'Harbor Bowl' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 160)
  name: string;

  @ApiPropertyOptional({
    example: 'Warm rice, citrus chicken, and bright herb dressing.',
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @Length(0, 1000)
  description?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/menu/harbor-bowl.jpg',
  })
  @IsString()
  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;

  @ApiProperty({ example: 18.5, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  basePrice: number;

  @ApiProperty({
    example: '8dd128a4-dc0c-49e9-82d1-1e26abf2eef3',
    description: 'Currency catalog id (Currency.id from GET /system/currencies).',
  })
  @IsUUID('4')
  currencyId: string;

  @ApiPropertyOptional({ example: 1, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: MenuItemAvailabilityType,
    example: MenuItemAvailabilityType.INHERIT_STORE_STATUS,
  })
  @IsEnum(MenuItemAvailabilityType)
  @IsOptional()
  availabilityType?: MenuItemAvailabilityType;
}
