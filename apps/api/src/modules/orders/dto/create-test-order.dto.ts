import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * Tenant tarafından operasyonel test için tetiklenen sipariş.
 * Gerçek customer akışı kullanılmaz — backend lazy-init bir
 * "tenant test customer" hesabı üzerinden gerçek Order kaydı yazar.
 * Realtime stream, metrics ve audio pulse zinciri böylece gerçek
 * lifecycle üzerinden test edilebilir.
 */
export class CreateTestOrderDto {
  @ApiProperty({ description: 'Test siparişinin yazılacağı, tenant\'a ait store id.' })
  @IsUUID('4')
  storeId!: string;

  @ApiProperty({
    description:
      'Siparişe eklenecek menu item id listesi. Her id quantity=1 olarak eklenir, opsiyonlar es geçilir.',
    type: [String],
    minItems: 1,
    maxItems: 10,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  menuItemIds!: string[];

  @ApiPropertyOptional({
    description: 'Sipariş servis tipi snapshot — "pickup" (default) veya "delivery".',
    enum: ['pickup', 'delivery'],
  })
  @IsOptional()
  @IsIn(['pickup', 'delivery'])
  serviceType?: 'pickup' | 'delivery';

  @ApiPropertyOptional({
    description: 'OrderStatusEvent.note olarak kaydedilecek opsiyonel açıklama.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
