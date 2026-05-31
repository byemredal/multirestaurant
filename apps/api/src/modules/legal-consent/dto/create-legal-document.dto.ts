import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PLATFORM_LEGAL_DOCUMENT_AUDIENCES,
  PlatformLegalDocumentAudience,
} from '../entities/platform-legal-document.entity';

export class CreateLegalDocumentDto {
  @ApiProperty({ description: 'LegalDocumentType.id (system taxonomy).' })
  @IsUUID('4')
  typeId!: string;

  @ApiProperty({
    description:
      'Stable identifier for this document concept. Used for public lookups; must be unique.',
    example: 'platform-terms-of-service',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  @Matches(/^[a-z0-9][a-z0-9_-]*$/, {
    message: 'code must be lowercase alphanumeric with - or _ separators.',
  })
  code!: string;

  @ApiPropertyOptional({
    description:
      'ISO-3166-1 alpha-2 country scope. Defaults to the active installation ' +
      'country when omitted. Two countries may share the same typeCode as ' +
      'distinct documents.',
    example: 'TR',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/, { message: 'countryCode must be a 2-letter ISO code.' })
  countryCode?: string;

  @ApiProperty({ enum: PLATFORM_LEGAL_DOCUMENT_AUDIENCES, example: 'customer' })
  @IsIn(PLATFORM_LEGAL_DOCUMENT_AUDIENCES)
  audience!: PlatformLegalDocumentAudience;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
