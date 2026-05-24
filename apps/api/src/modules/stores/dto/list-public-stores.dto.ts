import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class ListPublicStoresDto {
  @ApiPropertyOptional({
    description: 'Delivery mode used by the public discovery surface.',
    example: 'delivery',
    enum: ['delivery', 'collection'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['delivery', 'collection'])
  mode?: 'delivery' | 'collection';

  @ApiPropertyOptional({
    description: 'Postal code used to scope public store discovery.',
    example: '6319',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9A-Za-z -]{3,12}$/)
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Selected storefront shop type / store category.',
    example: 'Pizza',
  })
  @IsOptional()
  @IsString()
  shopType?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated menu category filters from the public storefront.',
    example: 'asian,kebab',
  })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean)
        : undefined,
  )
  @IsOptional()
  categories?: string[];

  @ApiPropertyOptional({
    description: 'Only show stores with free delivery in the matched delivery zone.',
    example: true,
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  @IsBoolean()
  freeDelivery?: boolean;

  @ApiPropertyOptional({
    description: 'Only show recently created stores.',
    example: true,
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  @IsBoolean()
  isNew?: boolean;

  @ApiPropertyOptional({
    description: 'Only show stores currently open.',
    example: true,
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  @IsBoolean()
  openNow?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum minimum order amount accepted by the storefront filter.',
    example: 30,
  })
  @Transform(({ value }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : Number(value),
  )
  @IsOptional()
  @IsNumber()
  maxMinimumOrder?: number;

  @ApiPropertyOptional({
    description: 'Supported storefront sort modes.',
    enum: ['best_match', 'delivery_fee', 'eta', 'minimum_order', 'newest'],
    example: 'best_match',
  })
  @IsOptional()
  @IsString()
  @IsIn(['best_match', 'delivery_fee', 'eta', 'minimum_order', 'newest'])
  sort?:
    | 'best_match'
    | 'delivery_fee'
    | 'eta'
    | 'minimum_order'
    | 'newest';
}
