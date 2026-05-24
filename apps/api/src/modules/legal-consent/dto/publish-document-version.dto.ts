import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PLATFORM_LEGAL_DOCUMENT_BODY_FORMATS,
  PlatformLegalDocumentBodyFormat,
} from '../entities/platform-legal-document.entity';

export class PublishDocumentVersionDto {
  @ApiProperty({
    description: 'Human-readable version label, unique per (documentId, locale).',
    example: '2026-05-14-v1',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  versionLabel!: string;

  @ApiProperty({ example: 'tr', description: 'BCP-47 locale code.' })
  @IsString()
  @MinLength(2)
  @MaxLength(16)
  locale!: string;

  @ApiProperty({ example: 'Kullanım Koşulları' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiProperty({ description: 'Full document body in the chosen bodyFormat.' })
  @IsString()
  @MinLength(1)
  body!: string;

  @ApiPropertyOptional({
    enum: PLATFORM_LEGAL_DOCUMENT_BODY_FORMATS,
    default: 'markdown',
  })
  @IsOptional()
  @IsIn(PLATFORM_LEGAL_DOCUMENT_BODY_FORMATS)
  bodyFormat?: PlatformLegalDocumentBodyFormat;

  @ApiPropertyOptional({
    description: 'When the new version becomes legally effective (defaults to now).',
  })
  @IsOptional()
  @IsISO8601()
  effectiveFrom?: string;

  @ApiPropertyOptional({
    description:
      'If true, the current active version for the same (documentId, locale) is superseded ' +
      'at publish time. If false, both versions coexist until explicitly superseded.',
    default: true,
  })
  @IsOptional()
  supersedeCurrent?: boolean;
}
