import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Min,
} from 'class-validator';

export class UpdateMenuCategoryDto {
  @ApiPropertyOptional({ example: 'Bowls' })
  @IsString()
  @IsOptional()
  @Length(2, 120)
  name?: string;

  @ApiPropertyOptional({ example: 'Balanced plates for lunch and dinner.' })
  @IsString()
  @IsOptional()
  @Length(0, 400)
  description?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/menu/bowls.jpg' })
  @IsString()
  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;

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
