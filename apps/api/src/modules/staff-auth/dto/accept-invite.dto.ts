import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class AcceptStaffInviteDto {
  @ApiProperty({
    description:
      'Raw single-use invite token issued by POST /tenants/me/staff. ' +
      'Server hashes the value before lookup; raw value is NEVER stored.',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'StaffPass123' })
  @IsString()
  @IsNotEmpty()
  @Length(8, 100)
  password: string;
}
