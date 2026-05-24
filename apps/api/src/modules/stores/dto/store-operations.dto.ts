import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { DayOfWeek } from '../entities/store.entity';

/** A single weekday opening-hours row for a store. */
export class OpeningHourInputDto {
  @ApiProperty({ enum: DayOfWeek })
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  openTime: string;

  @ApiProperty({ example: '22:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  closeTime: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isClosed?: boolean;
}

/** A delivery zone served by a store. */
export class DeliveryZoneInputDto {
  @ApiProperty({ example: 'City Centre' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  name: string;

  @ApiProperty({ example: ['6300', '6301'], type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  postalCodes: string[];

  @ApiPropertyOptional({ example: 5 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  radiusKm?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  minimumOrderAmount?: number;

  @ApiPropertyOptional({ example: 2.5 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  deliveryFee?: number;

  @ApiPropertyOptional({ example: 35 })
  @IsNumber()
  @Min(0)
  @Max(300)
  @IsOptional()
  estimatedDeliveryMinutes?: number;
}
