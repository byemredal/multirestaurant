import { IsBoolean, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class VerifyTenantOnboardingBusinessRegistrationDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 80)
  registrationNumber: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  country?: string;
}

export class SaveTenantOnboardingBusinessDetailsDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 80)
  registrationNumber: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  registeredBusinessName: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  legalForm?: string | null;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  taxNumber?: string | null;

  @IsOptional()
  @IsBoolean()
  vatRegistered?: boolean;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  vatNumber?: string | null;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{2}$/)
  registrationCountry: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 300)
  registeredAddress: string;

  @IsOptional()
  @IsString()
  @Length(2, 160)
  authorityName?: string | null;
}
