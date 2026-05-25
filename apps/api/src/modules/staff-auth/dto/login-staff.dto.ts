import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginStaffDto {
  @ApiProperty({ example: 'cashier@store.example' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'StaffPass123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
