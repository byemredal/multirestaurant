import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class UpdateStoreTaxSettingDto {
  @ApiPropertyOptional({ example: 'DE123456789' })
  @IsOptional()
  @IsString()
  @Length(2, 80)
  taxRegistrationNumber?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  priceIncludesTax?: boolean;

  @ApiPropertyOptional({ example: 19 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultVatRate?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  serviceChargeRate?: number;

  @ApiPropertyOptional({ example: 'Thank you for your order.' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  invoiceFooterText?: string;
}
