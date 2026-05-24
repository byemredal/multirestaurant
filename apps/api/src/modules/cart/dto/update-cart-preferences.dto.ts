import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class UpdateCartPreferencesDto {
  @ApiPropertyOptional({
    description: 'ServiceType.id from /system/service-types.',
  })
  @IsOptional()
  @IsUUID('4')
  serviceTypeId?: string;

  @ApiPropertyOptional({
    description: 'PaymentMethod.id from /system/payment-methods.',
  })
  @IsOptional()
  @IsUUID('4')
  paymentMethodId?: string;

  @ApiPropertyOptional({ example: 3.4, minimum: 0, maximum: 1000, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  deliveryDistanceKm?: number | null;
}
