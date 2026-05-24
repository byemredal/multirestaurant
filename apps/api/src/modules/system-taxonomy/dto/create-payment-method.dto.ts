import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePaymentMethodDto {
  @ApiProperty({ example: 'apple_pay' })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,38}$/)
  code!: string;

  @ApiProperty({ example: 'Apple Pay' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  displayName!: string;

  @ApiPropertyOptional({ example: 'apple-pay' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  iconKey?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
