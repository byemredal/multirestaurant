import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class SendTenantOnboardingPhoneVerificationDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9\s().-]{7,20}$/)
  phoneNumber: string;
}

export class SendTenantOnboardingPhoneVerificationByTokenDto extends SendTenantOnboardingPhoneVerificationDto {
  @IsString()
  @IsNotEmpty()
  stateToken: string;
}

export class VerifyTenantOnboardingPhoneDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code: string;
}

export class VerifyTenantOnboardingPhoneByTokenDto extends VerifyTenantOnboardingPhoneDto {
  @IsString()
  @IsNotEmpty()
  stateToken: string;
}

export class ResendTenantOnboardingPhoneVerificationDto {
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9\s().-]{7,20}$/)
  phoneNumber?: string;
}
