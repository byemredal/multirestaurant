import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class StorePaymentMethodAssignmentEntryDto {
  @ApiProperty({ description: 'PaymentMethod.id from /system/payment-methods.' })
  @IsUUID('4')
  paymentMethodId!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: 'Nakit (kapıda)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  customLabel?: string | null;
}

export class ReplaceStorePaymentMethodsDto {
  @ApiProperty({ type: () => [StorePaymentMethodAssignmentEntryDto] })
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => StorePaymentMethodAssignmentEntryDto)
  paymentMethods!: StorePaymentMethodAssignmentEntryDto[];
}

export class StoreServiceTypeAssignmentEntryDto {
  @ApiProperty({ description: 'ServiceType.id from /system/service-types.' })
  @IsUUID('4')
  serviceTypeId!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: 'Hızlı Teslimat' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  customLabel?: string | null;
}

export class ReplaceStoreServiceTypesDto {
  @ApiProperty({ type: () => [StoreServiceTypeAssignmentEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => StoreServiceTypeAssignmentEntryDto)
  serviceTypes!: StoreServiceTypeAssignmentEntryDto[];
}
