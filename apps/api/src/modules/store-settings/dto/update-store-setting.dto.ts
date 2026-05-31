import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class UpdateStoreSettingDto {
  @ApiPropertyOptional({ example: { autoAcceptOrders: false } })
  @IsOptional()
  @IsObject()
  advancedOptionsJson?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Operational order-acceptance switch. When false the store stays listable but the public storefront does not surface it as orderable/open.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  acceptingOrders?: boolean;
}
