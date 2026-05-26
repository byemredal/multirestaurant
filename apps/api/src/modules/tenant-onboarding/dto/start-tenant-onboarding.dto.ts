import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { DeliveryModel, TenantType } from '../../tenants/entities/tenant-business.entity';

export class StartTenantOnboardingAddressMetaDto {
  @ApiProperty({ example: 'Bahnhofstrasse 1, 8001 Zürich, Schweiz' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 500)
  label: string;

  @ApiPropertyOptional({ example: 'Bahnhofstrasse 1' })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  street?: string | null;

  @ApiPropertyOptional({ example: 'Zürich' })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  city?: string | null;

  @ApiPropertyOptional({ example: '8001' })
  @IsOptional()
  @IsString()
  @Length(0, 20)
  postalCode?: string | null;

  @ApiPropertyOptional({ example: 'CH' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string | null;

  @ApiPropertyOptional({ example: 47.376 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @ApiPropertyOptional({ example: 8.541 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @ApiProperty({ example: 'locationiq', enum: ['locationiq', 'manual', 'none'] })
  @IsIn(['locationiq', 'manual', 'none'])
  provider: 'locationiq' | 'manual' | 'none';

  @ApiPropertyOptional({ example: '236789012' })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  providerPlaceId?: string | null;
}

export class StartTenantOnboardingDto {
  @ApiProperty({ example: 'Aylin' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  firstName: string;

  @ApiProperty({ example: 'Demir' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  lastName: string;

  @ApiProperty({ example: '+905551112233' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+\d{1,3}[-\s]?)?\d{10,14}$/)
  phoneNumber: string;

  @ApiProperty({ example: 'tenant@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Aegean Kitchens GmbH' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  companyName: string;

  @ApiProperty({ example: 'Example Street 42, Berlin' })
  @IsString()
  @IsNotEmpty()
  @Length(5, 500)
  companyAddress: string;

  @ApiProperty({ enum: TenantType, example: TenantType.FOOD_SERVICE })
  @IsEnum(TenantType)
  tenantType: TenantType;

  @ApiProperty({ enum: DeliveryModel, example: DeliveryModel.PLATFORM_FLEET })
  @IsEnum(DeliveryModel)
  deliveryModel: DeliveryModel;

  @ApiProperty({
    description:
      'Initial Terms of Service + Privacy Policy acceptance from the partner ' +
      'application form. MUST be `true` — the application is rejected otherwise.',
    example: true,
  })
  @IsBoolean()
  @Equals(true, { message: 'Başvuruyu göndermek için kullanım şartlarını ve gizlilik politikasını kabul etmeniz gerekir.' })
  acceptedTerms: boolean;

  @ApiPropertyOptional({
    description:
      'Optional locale tag captured at acceptance time. Falls back to the active ' +
      'CountryPack locale when omitted.',
  })
  @IsOptional()
  @IsString()
  @Length(2, 16)
  acceptedLocale?: string;

  @ApiPropertyOptional({
    type: StartTenantOnboardingAddressMetaDto,
    description:
      'Normalized parts of the selected address (provider, place id, lat/lon). ' +
      'Empty when the user typed a free-form string without selecting a suggestion.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StartTenantOnboardingAddressMetaDto)
  addressMeta?: StartTenantOnboardingAddressMetaDto;
}
