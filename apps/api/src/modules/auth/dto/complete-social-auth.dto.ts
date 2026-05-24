import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CompleteSocialAuthDto {
  @ApiPropertyOptional({
    description: 'Authorization code returned by the social provider.',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description: 'Opaque state returned by the social provider.',
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({
    description: 'Optional provider error code returned instead of an authorization code.',
  })
  @IsOptional()
  @IsString()
  error?: string;
}
