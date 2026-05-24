import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class UpdateStoreLocalizationDto {
  @ApiPropertyOptional({ description: 'Currency catalog id to set as the store default.' })
  @IsOptional()
  @IsUUID('4')
  defaultCurrencyId?: string;

  @ApiPropertyOptional({ description: 'Language catalog id to set as the store default.' })
  @IsOptional()
  @IsUUID('4')
  defaultLanguageId?: string;
}
