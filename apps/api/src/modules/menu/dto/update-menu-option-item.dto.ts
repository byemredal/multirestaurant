import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class UpdateMenuOptionItemDto {
  @ApiPropertyOptional({ example: 'Large' })
  @IsString()
  @IsOptional()
  @Length(1, 120)
  name?: string;

  @ApiPropertyOptional({ example: 3.25, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  priceDelta?: number;

  @ApiPropertyOptional({ example: 1, minimum: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
