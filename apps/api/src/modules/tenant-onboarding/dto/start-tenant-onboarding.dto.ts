import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { DeliveryModel, TenantType } from '../../tenants/entities/tenant-business.entity';

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
}
