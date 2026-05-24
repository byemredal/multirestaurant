import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateStoreDeliveryFeeSettingDto {
  @ApiPropertyOptional({ example: 2.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000)
  baseFee?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000)
  freeDeliveryThreshold?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  surgeFeeEnabled?: boolean;

  @ApiPropertyOptional({ example: 1.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000)
  smallOrderFee?: number;
}
