import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

const toBoolean = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1';

/** Anonymous visitor submits a postal code or address for a session. */
export class CreateSessionAddressDto {
  @ApiPropertyOptional({ description: 'ISO-3166-1 alpha-2 country code.', example: 'CH' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  countryCode?: string;

  @ApiPropertyOptional({ description: 'Postal code to scope discovery.', example: '6300' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9A-Za-z -]{3,12}$/)
  postalCode?: string;

  @ApiPropertyOptional({ example: 'Zug' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Canton / state.', example: 'Zug' })
  @IsOptional()
  @IsString()
  canton?: string;

  @ApiPropertyOptional({ example: 'Bahnhofstrasse' })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional({ example: '12' })
  @IsOptional()
  @IsString()
  houseNumber?: string;

  @ApiPropertyOptional({ example: 47.1662 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 8.5154 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ example: 'Bahnhofstrasse 12, 6300 Zug' })
  @IsOptional()
  @IsString()
  formattedAddress?: string;

  @ApiPropertyOptional({
    enum: ['postal_code', 'autocomplete', 'geolocation', 'manual'],
    example: 'postal_code',
  })
  @IsOptional()
  @IsString()
  @IsIn(['postal_code', 'autocomplete', 'geolocation', 'manual'])
  source?: 'postal_code' | 'autocomplete' | 'geolocation' | 'manual';
}

/** Restaurant discovery query — accepts sessionToken OR postalCode OR lat/lng. */
export class DiscoverRestaurantsDto {
  @ApiPropertyOptional({ description: 'Token of a stored session address.' })
  @IsOptional()
  @IsString()
  @Length(8, 128)
  sessionToken?: string;

  @ApiPropertyOptional({ example: 'CH' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  countryCode?: string;

  @ApiPropertyOptional({ example: '6300' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9A-Za-z -]{3,12}$/)
  postalCode?: string;

  @ApiPropertyOptional({ example: 47.1662 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 8.5154 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ description: 'Only return restaurants open right now.' })
  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean()
  openNow?: boolean;

  @ApiPropertyOptional({ description: 'Only return restaurants with free delivery.' })
  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean()
  freeDelivery?: boolean;

  @ApiPropertyOptional({ description: 'Cap on the matched minimum order amount.', example: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxMinimumOrder?: number;

  @ApiPropertyOptional({
    description: 'Filter by store category / merchant type (case-insensitive).',
    example: 'Pizza',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated cuisine slugs; matches stores tagged with ANY.',
    example: 'kebab,pizza',
  })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value
            .split(',')
            .map((entry) => entry.trim().toLowerCase())
            .filter(Boolean)
        : undefined,
  )
  @IsOptional()
  @IsString({ each: true })
  cuisines?: string[];

  @ApiPropertyOptional({
    description: 'Result ordering. "best_match" uses the ranking engine.',
    enum: ['best_match', 'eta', 'delivery_fee', 'rating', 'distance', 'min_order'],
    example: 'best_match',
  })
  @IsOptional()
  @IsString()
  @IsIn(['best_match', 'eta', 'delivery_fee', 'rating', 'distance', 'min_order'])
  sort?: 'best_match' | 'eta' | 'delivery_fee' | 'rating' | 'distance' | 'min_order';

  @ApiPropertyOptional({ description: 'Maximum results to return.', example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Result offset for pagination.', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
