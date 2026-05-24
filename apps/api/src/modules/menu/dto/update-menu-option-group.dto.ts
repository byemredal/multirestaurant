import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class UpdateMenuOptionGroupDto {
  @ApiPropertyOptional({ example: 'Size' })
  @IsString()
  @IsOptional()
  @Length(2, 120)
  name?: string;

  @ApiPropertyOptional({ example: 'Choose one serving size.' })
  @IsString()
  @IsOptional()
  @Length(0, 400)
  description?: string;

  @ApiPropertyOptional({ example: 1, minimum: 0, maximum: 50 })
  @IsInt()
  @Min(0)
  @Max(50)
  @IsOptional()
  minSelections?: number;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 50 })
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  maxSelections?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

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
