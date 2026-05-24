import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

export class UpdateStoreProfileNoteTranslationDto {
  @ApiProperty({ example: 'tr' })
  @IsString()
  @Length(2, 16)
  locale!: string;

  @ApiPropertyOptional({ example: 'Hakkimizda' })
  @IsOptional()
  @IsString()
  @Length(0, 160)
  title?: string | null;

  @ApiProperty({ example: 'Aile isletmesi restoran...' })
  @IsString()
  @Length(1, 12000)
  body!: string;
}

export class UpdateStoreProfileNoteDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiProperty({ type: [UpdateStoreProfileNoteTranslationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateStoreProfileNoteTranslationDto)
  translations!: UpdateStoreProfileNoteTranslationDto[];
}
