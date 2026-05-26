import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Min,
} from 'class-validator';

export class CreateComplianceDocumentRequirementDto {
  @ApiProperty({ example: 'CH' })
  @IsString()
  @Length(2, 2)
  country!: string;

  @ApiProperty({ example: 'de-CH' })
  @IsString()
  @Length(2, 16)
  language!: string;

  @ApiProperty({ example: 'commercial_register_extract' })
  @IsString()
  @Length(1, 80)
  documentType!: string;

  @ApiProperty({ example: 'Ticaret sicili özeti' })
  @IsString()
  @Length(1, 180)
  label!: string;

  @ApiProperty({ example: 'Üretime geçmeden önce hukuk ekibi tarafından doğrulanmalıdır.' })
  @IsString()
  @Length(1, 1000)
  description!: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  required!: boolean;

  @ApiProperty({ type: [String], example: ['pdf', 'jpg', 'jpeg', 'png'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  acceptedFormats!: string[];

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  guidanceOnly?: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  active!: boolean;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class UpdateComplianceDocumentRequirementDto extends PartialType(
  CreateComplianceDocumentRequirementDto,
) {}

export class CreateComplianceConsentDefinitionDto {
  @ApiProperty({ example: 'CH' })
  @IsString()
  @Length(2, 2)
  country!: string;

  @ApiProperty({ example: 'de-CH' })
  @IsString()
  @Length(2, 16)
  language!: string;

  @ApiProperty({ example: 'privacy_acknowledgement' })
  @IsString()
  @Length(1, 100)
  consentKey!: string;

  @ApiProperty({ example: 'Gizlilik bildirimi okundu ve kabul edildi' })
  @IsString()
  @Length(1, 240)
  label!: string;

  @ApiProperty({ example: 'Nihai metin hukuk incelemesinden sonra yayımlanacaktır.' })
  @IsString()
  @Length(1, 1000)
  description!: string;

  @ApiProperty({ example: 'privacy_notice' })
  @IsString()
  @Length(1, 100)
  documentCode!: string;

  @ApiProperty({ example: 'placeholder-v1' })
  @IsString()
  @Length(1, 80)
  documentVersion!: string;

  @ApiPropertyOptional({ example: 'https://example.org/privacy', nullable: true })
  @IsOptional()
  @IsUrl({ require_tld: false })
  documentUrl?: string | null;

  @ApiProperty({ example: true })
  @IsBoolean()
  required!: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  active!: boolean;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class UpdateComplianceConsentDefinitionDto extends PartialType(
  CreateComplianceConsentDefinitionDto,
) {}
