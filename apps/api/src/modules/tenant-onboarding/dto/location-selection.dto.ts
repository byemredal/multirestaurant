import { IsNumber, IsOptional, IsString, Length, Matches } from 'class-validator';

export class SaveTenantOnboardingLocationSelectionDto {
  @IsString()
  @Length(2, 180)
  locationLabel: string;

  @IsString()
  @Length(2, 240)
  rawInput: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  country?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  city?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 24)
  postalCode?: string | null;

  @IsOptional()
  @IsNumber()
  latitude?: number | null;

  @IsOptional()
  @IsNumber()
  longitude?: number | null;
}
