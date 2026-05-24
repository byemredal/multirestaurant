import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterCustomerDto {
  @ApiProperty({ example: 'customer@example.com', maxLength: 100 })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(100)
  email: string;

  @ApiProperty({ example: 'Lina', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Weber', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({
    example: 'CustomerPass123',
    minLength: 6,
    description: 'Required unless loginPreference is true.',
  })
  @ValidateIf((dto: RegisterCustomerDto) => dto.loginPreference === false)
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Current foundation keeps this optional. Password login remains the primary path.',
  })
  @IsBoolean()
  @IsOptional()
  loginPreference?: boolean = false;

  @ApiPropertyOptional({ example: '+905551112233', maxLength: 20 })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: '1996-05-12',
    description: 'ISO-8601 birth date string.',
  })
  @IsDateString()
  @IsOptional()
  birthDate?: string;
}
