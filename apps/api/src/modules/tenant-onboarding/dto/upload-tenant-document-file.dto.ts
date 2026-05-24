import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UploadTenantDocumentFileDto {
  @ApiProperty({ example: 'business_license' })
  @IsString()
  type: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiProperty({ example: '2026-12-31T00:00:00.000Z', required: false })
  @IsOptional()
  @IsString()
  expiresAt?: string;
}
