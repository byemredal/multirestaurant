import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpsertStoreTermsAddendumDto {
  @ApiProperty({
    description:
      'PlatformLegalDocumentVersion.id this addendum attaches to. Addendum does not ' +
      'override the platform document; it complements it.',
  })
  @IsUUID('4')
  parentDocumentVersionId!: string;

  @ApiProperty({ example: 'Tatlı iadesinde ek koşullar' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  body!: string;

  @ApiPropertyOptional({ default: 'tr' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
