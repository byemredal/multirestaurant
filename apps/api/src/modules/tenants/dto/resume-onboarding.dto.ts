import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Exchanges an onboarding continuation token for an active tenant session. */
export class ResumeOnboardingDto {
  @ApiProperty({ description: 'The onboarding continuation token.' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
