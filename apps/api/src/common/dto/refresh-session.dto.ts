import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshSessionDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh-token',
    description: 'Refresh token issued during login or register flows.',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
