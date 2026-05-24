import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class CreateStoreSliderItemDto {
  @ApiPropertyOptional({ example: 'f3ef9d1e-0b5e-4dc4-92f0-eeeeeeeeeeee', nullable: true })
  @IsOptional()
  @IsUUID('4')
  imageAssetId?: string | null;

  @ApiPropertyOptional({ example: 'Spring campaign' })
  @IsOptional()
  @IsString()
  @Length(0, 160)
  title?: string | null;

  @ApiPropertyOptional({ example: 'Fresh seasonal menu' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  caption?: string | null;

  @ApiPropertyOptional({ example: '/campaigns/spring-sale' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  targetUrl?: string | null;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
