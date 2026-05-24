import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { SUPPORTED_SETUP_COUNTRIES } from '../setup.constants';

export class InitializePlatformDto {
  @ApiProperty({ example: 'Lieferzonen' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  platformName: string;

  @ApiProperty({ example: 'support@lieferzonen.com' })
  @IsEmail()
  @IsNotEmpty()
  supportEmail: string;

  @ApiPropertyOptional({
    description: 'Optional logo as a data URL or hosted URL.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  logoUrl?: string;

  @ApiProperty({ example: 'CH', enum: SUPPORTED_SETUP_COUNTRIES })
  @IsIn(SUPPORTED_SETUP_COUNTRIES)
  primaryCountry: string;

  @ApiProperty({ example: 'owner@lieferzonen.com' })
  @IsEmail()
  @IsNotEmpty()
  adminEmail: string;

  @ApiProperty({ example: 'ChangeMe123' })
  @IsString()
  @IsNotEmpty()
  @Length(8, 100)
  adminPassword: string;

  @ApiPropertyOptional({ example: 'Platform' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  adminFirstName?: string;

  @ApiPropertyOptional({ example: 'Owner' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  adminLastName?: string;
}
