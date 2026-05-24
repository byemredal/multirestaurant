import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateTenantOperationsInfoDto {
  @ApiProperty({ example: 'Berlin' })
  @IsString()
  @IsNotEmpty()
  primaryCity: string;

  @ApiProperty({ example: '10115' })
  @IsString()
  @IsNotEmpty()
  primaryPostalCode: string;

  @ApiProperty({ example: 'platform_fleet' })
  @IsString()
  @IsNotEmpty()
  deliveryModel: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  supportsPickup: boolean;

  @ApiProperty({ example: 'Mon-Fri 09:00-22:00', required: false })
  @IsOptional()
  @IsString()
  openingHoursSummary?: string;

  @ApiProperty({ example: '2026-05-01T00:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  estimatedGoLiveDate?: string;
}
