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

export class CreateServiceTypeDto {
  @ApiProperty({ example: 'curbside' })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,38}$/)
  code!: string;

  @ApiProperty({ example: 'Curbside Pickup' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  displayName!: string;

  @ApiPropertyOptional({ example: 'car' })
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
