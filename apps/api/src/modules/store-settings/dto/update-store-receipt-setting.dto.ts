import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString, Length } from 'class-validator';

export class UpdateStoreReceiptSettingDto {
  @ApiPropertyOptional({ example: 'Best Burger Berlin' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  headerText?: string;

  @ApiPropertyOptional({ example: 'Visit again soon.' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  footerText?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  showTaxBreakdown?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  showQrCode?: boolean;

  @ApiPropertyOptional({ example: { logoAlignment: 'center' } })
  @IsOptional()
  @IsObject()
  layoutConfigJson?: Record<string, unknown>;
}
