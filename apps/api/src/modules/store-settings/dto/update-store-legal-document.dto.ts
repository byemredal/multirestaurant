import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

export class UpdateStoreLegalDocumentTranslationDto {
  @ApiProperty({ example: 'tr' })
  @IsString()
  @Length(2, 16)
  locale!: string;

  @ApiProperty({ example: 'Kullanim Sartlari' })
  @IsString()
  @Length(1, 160)
  title!: string;

  @ApiProperty({ example: 'Teslimat kosullari...' })
  @IsString()
  @Length(1, 20000)
  body!: string;
}

export class UpdateStoreLegalDocumentDto {
  @ApiPropertyOptional({ example: 'v1.0' })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  versionLabel?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ example: '2026-04-17T00:00:00.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string | null;

  @ApiProperty({ type: [UpdateStoreLegalDocumentTranslationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateStoreLegalDocumentTranslationDto)
  translations!: UpdateStoreLegalDocumentTranslationDto[];
}
