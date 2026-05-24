import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class DeliveryAddressInputDto {
  @ApiPropertyOptional({ example: 'Bahnhofstrasse 12' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @ApiPropertyOptional({ example: 'Kat 3, Daire 7' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @ApiPropertyOptional({ example: 'Zürich' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: '8001' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ example: 'CH' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  country?: string;
}

export class CreateCustomerOrderDto {
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

  @ApiPropertyOptional({ example: 3.4, minimum: 0, maximum: 1000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  deliveryDistanceKm?: number;

  @ApiPropertyOptional({
    type: DeliveryAddressInputDto,
    description:
      'Teslimat adresi snapshot — sipariş anındaki gerçekliği donduran kayıt. ' +
      'Sağlanmazsa kolon NULL kalır (müşteri profili sonradan kullanılabilir).',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryAddressInputDto)
  deliveryAddress?: DeliveryAddressInputDto;

  @ApiPropertyOptional({
    example: '+41 79 123 45 67',
    description:
      'Müşterinin sipariş anındaki telefon numarası. Sağlanmazsa CustomerAccount.phoneNumber fallback olarak yazılır.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  customerPhone?: string;

  @ApiPropertyOptional({
    example: 'Apartmana giriş kodu: 4321. Üst kattaki kapı.',
    description: 'Kurye için serbest metin not. 500 karakteri aşamaz.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  courierNotes?: string;
}
