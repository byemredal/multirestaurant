import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class SaveTenantOnboardingPlanSelectionDto {
  @ApiProperty({ example: 'growth' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 80)
  planKey: string;
}
