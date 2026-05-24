import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { DeliveryModel, TenantType } from '../entities/tenant-account.entity';

export class RegisterTenantDto {
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

  @ApiProperty({
    example: 'TenantPass123',
    description: 'Must include at least one uppercase letter, one lowercase letter, and one digit.',
  })
  @IsString()
  @IsNotEmpty()
  @Length(8, 100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)
  password: string;

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

  @ApiProperty({ enum: DeliveryModel, example: DeliveryModel.OWN_FLEET })
  @IsEnum(DeliveryModel)
  deliveryModel: DeliveryModel;
}
