import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export const discountRuleTypes = ['coupon', 'automatic', 'loyalty', 'campaign'] as const;
export const discountValueTypes = ['percentage', 'fixed'] as const;

export class CreateDiscountRuleDto {
  @ApiProperty({ example: 'Lunch campaign' })
  @IsString()
  @Length(2, 160)
  name: string;

  @ApiProperty({ enum: discountRuleTypes, example: 'automatic' })
  @IsIn(discountRuleTypes)
  ruleType: (typeof discountRuleTypes)[number];

  @ApiProperty({ enum: discountValueTypes, example: 'percentage' })
  @IsIn(discountValueTypes)
  valueType: (typeof discountValueTypes)[number];

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0)
  @Max(1000000)
  valueAmount: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '2026-04-13T09:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2026-04-30T21:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
