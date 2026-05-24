import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCurrencyDto {
  @ApiProperty({ example: 'CHF', description: 'ISO 4217 alphabetic code.' })
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  code!: string;

  @ApiProperty({ example: 'Swiss Franc' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;

  @ApiProperty({ example: 'CHF' })
  @IsString()
  @MinLength(1)
  @MaxLength(8)
  symbol!: string;

  @ApiPropertyOptional({ example: '756' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  numericCode?: string;

  @ApiPropertyOptional({ example: 2, default: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  decimalDigits?: number;

  @ApiPropertyOptional({ example: 50, default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
