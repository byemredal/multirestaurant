import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class SaveTenantOnboardingBankDetailsDto {
  @ApiProperty({ example: 'Zurcher Kantonalbank' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 160)
  bankName: string;

  @ApiProperty({ example: 'Aegean Kitchens GmbH' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  accountHolderName: string;

  @ApiProperty({
    description:
      'IBAN. ISO-13616 outer shape only at the DTO layer; the service additionally ' +
      'enforces the active CountryPack ibanCountryCode + ibanLength (e.g. CH21 / TR26).',
    example: 'CH9300762011623852957',
  })
  @IsString()
  @IsNotEmpty()
  @Length(8, 34)
  @Matches(/^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/)
  iban: string;

  @ApiProperty({
    description: 'ISO-4217 currency. Defaults to the active CountryPack currency.',
    example: 'CHF',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}

export class SaveTenantOnboardingBillingAddressDto {
  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  useBusinessAddress?: boolean;

  @ApiProperty({ example: 'Aegean Kitchens GmbH' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  billingName: string;

  @ApiProperty({ example: 'CH' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 2)
  country: string;

  @ApiProperty({ example: 'Zurich' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  city: string;

  @ApiProperty({ example: '8001' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 20)
  postalCode: string;

  @ApiProperty({ example: 'Bahnhofstrasse 10' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 240)
  addressLine1: string;

  @ApiProperty({ example: '2nd floor', required: false })
  @IsOptional()
  @IsString()
  @Length(1, 240)
  addressLine2?: string;
}
