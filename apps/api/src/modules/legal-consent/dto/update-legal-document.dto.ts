import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import {
  PLATFORM_LEGAL_DOCUMENT_AUDIENCES,
  PlatformLegalDocumentAudience,
} from '../entities/platform-legal-document.entity';

export class UpdateLegalDocumentDto {
  @ApiPropertyOptional({ enum: PLATFORM_LEGAL_DOCUMENT_AUDIENCES })
  @IsOptional()
  @IsIn(PLATFORM_LEGAL_DOCUMENT_AUDIENCES)
  audience?: PlatformLegalDocumentAudience;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
