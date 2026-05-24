import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class SaveTenantOnboardingAuthorizedPersonDto {
  @ApiProperty({ example: 'Ada Browser' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'ada@example.test' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '+41791234567' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ example: 'Authorized representative', required: false })
  @IsOptional()
  @IsString()
  roleTitle?: string;

  @ApiProperty({ example: 100, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ownershipPercentage?: number;
}
