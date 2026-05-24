import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

/**
 * Sets the password for a tenant account that was created through the
 * passwordless onboarding flow. After this succeeds the partner can sign in
 * with email + password as usual.
 */
export class SetTenantPasswordDto {
  @ApiProperty({
    example: 'TenantPass123',
    description:
      'Must include at least one uppercase letter, one lowercase letter, and one digit.',
  })
  @IsString()
  @IsNotEmpty()
  @Length(8, 100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)
  password: string;
}
