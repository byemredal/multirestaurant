import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class SaveTenantOnboardingAddressDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  addressLine1: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  addressLine2?: string | null;

  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  city: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  region?: string | null;

  @IsString()
  @IsNotEmpty()
  @Length(2, 24)
  postalCode: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{2}$/)
  country: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  building?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  floor?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  door?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  addressNote?: string | null;
}
