import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

export class UploadTenantDocumentDto {
  @ApiProperty({ example: 'business_license' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: 'license.pdf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiProperty({ example: 120045 })
  @IsInt()
  @Min(1)
  sizeBytes: number;

  @ApiProperty({ example: 'https://cdn.example.com/uploads/license.pdf' })
  @IsUrl()
  publicUrl: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiProperty({ example: '2026-12-31T00:00:00.000Z', required: false })
  @IsOptional()
  @IsString()
  expiresAt?: string;
}
