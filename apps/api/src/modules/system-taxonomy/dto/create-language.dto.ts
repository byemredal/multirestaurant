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

export class CreateLanguageDto {
  @ApiProperty({ example: 'fr-FR', description: 'BCP-47 language tag.' })
  @IsString()
  @Matches(/^[a-z]{2,3}(-[A-Z]{2})?$/)
  code!: string;

  @ApiProperty({ example: 'French (France)' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;

  @ApiProperty({ example: 'Français' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nativeDisplayName!: string;

  @ApiPropertyOptional({ example: 40, default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
