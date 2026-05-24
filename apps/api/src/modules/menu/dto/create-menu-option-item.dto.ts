import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateMenuOptionItemDto {
  @ApiProperty({ example: 'Large' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  name: string;

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

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
