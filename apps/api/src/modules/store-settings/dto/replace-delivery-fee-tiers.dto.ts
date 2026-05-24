import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class DeliveryFeeTierEntryDto {
  @ApiProperty({ example: 0, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  minDistanceKm!: number;

  @ApiProperty({ example: 2, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  maxDistanceKm!: number;

  @ApiProperty({ example: 15, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000000)
  feeAmount!: number;

  @ApiProperty({ example: 0, required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({ example: true, required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReplaceDeliveryFeeTiersDto {
  @ApiProperty({ type: () => [DeliveryFeeTierEntryDto] })
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DeliveryFeeTierEntryDto)
  tiers!: DeliveryFeeTierEntryDto[];
}
