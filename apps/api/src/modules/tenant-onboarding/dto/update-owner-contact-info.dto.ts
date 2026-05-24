import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateTenantOwnerContactInfoDto {
  @ApiProperty({ example: 'Aylin Demir' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'owner@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '+905551112233' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ example: 'Founder', required: false })
  @IsOptional()
  @IsString()
  roleTitle?: string;

  @ApiProperty({ example: 80, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ownershipPercentage?: number;
}
