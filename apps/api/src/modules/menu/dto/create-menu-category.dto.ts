import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Length, Min } from 'class-validator';

export class CreateMenuCategoryDto {
  @ApiProperty({ example: 'Bowls' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  name: string;

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

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
