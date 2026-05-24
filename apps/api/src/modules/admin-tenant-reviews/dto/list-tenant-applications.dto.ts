import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { TenantOnboardingApplicationStatus } from '../../tenant-onboarding/entities/tenant-onboarding.entity';

export class ListTenantApplicationsDto {
  @ApiPropertyOptional({ example: 'under_review' })
  @IsOptional()
  @IsIn([
    'draft',
    'submitted',
    'under_review',
    'revision_required',
    'approved',
    'rejected',
    'active',
    'suspended',
  ])
  status?: TenantOnboardingApplicationStatus;

  @ApiPropertyOptional({ example: 'Berlin' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'food_service' })
  @IsOptional()
  @IsString()
  businessType?: string;

  @ApiPropertyOptional({ enum: ['complete', 'incomplete'] })
  @IsOptional()
  @IsIn(['complete', 'incomplete'])
  completeness?: 'complete' | 'incomplete';
}
