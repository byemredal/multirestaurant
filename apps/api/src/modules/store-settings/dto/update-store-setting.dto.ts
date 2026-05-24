import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class UpdateStoreSettingDto {
  @ApiPropertyOptional({ example: { autoAcceptOrders: false } })
  @IsOptional()
  @IsObject()
  advancedOptionsJson?: Record<string, unknown>;
}
