import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class UpdateTenantBusinessInfoDto {
  @ApiProperty({ example: 'Aegean Kitchens GmbH' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  businessName: string;

  @ApiProperty({ example: 'food_service' })
  @IsString()
  @IsNotEmpty()
  businessType: string;

  @ApiProperty({ example: 'HRB-12345', required: false })
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiProperty({ example: 'TAX-12345', required: false })
  @IsOptional()
  @IsString()
  taxNumber?: string;

  @ApiProperty({ example: 'Example Street 42' })
  @IsString()
  @IsNotEmpty()
  addressLine1: string;

  @ApiProperty({ example: 'Floor 2', required: false })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiProperty({ example: 'Berlin' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: '10115' })
  @IsString()
  @IsNotEmpty()
  postalCode: string;

  @ApiProperty({ example: 'DE' })
  @IsString()
  @IsNotEmpty()
  country: string;
}
