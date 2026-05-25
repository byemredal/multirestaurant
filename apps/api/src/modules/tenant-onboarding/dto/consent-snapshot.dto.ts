import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsString, Length } from 'class-validator';

export class SaveTenantOnboardingConsentsDto {
  @ApiProperty({
    example: ['privacy_acknowledgement', 'partner_terms_acknowledgement'],
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(2, 100, { each: true })
  acceptedConsentKeys: string[];
}
