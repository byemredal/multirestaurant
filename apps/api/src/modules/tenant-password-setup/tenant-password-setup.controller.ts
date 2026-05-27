import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { Public } from '../../common/security/decorators/public.decorator';
import { RateLimit } from '../../common/security/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/security/guards/rate-limit.guard';
import { TenantPasswordSetupService } from './tenant-password-setup.service';

class RedeemPasswordSetupDto {
  @IsString()
  @Length(8, 100, { message: 'Şifre 8-100 karakter olmalıdır.' })
  password!: string;
}

/**
 * Public endpoints for the post-approval password setup magic link.
 * GET → status check (used by the set-password page to render a friendly
 *       error before the user types anything if the link is bad).
 * POST → atomically redeem the token and persist the new password hash.
 */
@Controller('v2/tenant/password-setup')
@Public()
@UseGuards(RateLimitGuard)
@ApiTags('tenant-password-setup')
export class TenantPasswordSetupController {
  constructor(private readonly service: TenantPasswordSetupService) {}

  @Get(':token/status')
  @RateLimit({ key: 'tenant-password-setup-status', limit: 20, ttlMs: 60_000 })
  @ApiOperation({
    summary: 'Whether a password setup token can still be redeemed.',
    description:
      'Returns 200 + status payload regardless of validity (errors are folded ' +
      'into `redeemable: false`) so attackers cannot enumerate valid tokens by ' +
      'response code.',
  })
  @ApiOkResponse({ description: 'Token status (always 200).' })
  async getStatus(@Param('token') rawToken: string) {
    const detail = await this.service.describeRedeemable(rawToken);
    if (!detail) {
      return {
        redeemable: false,
        reason: 'invalid_or_expired_token',
      };
    }
    return {
      redeemable: true,
      tenantEmail: detail.tenantEmail,
      expiresAt: detail.expiresAt.toISOString(),
    };
  }

  @Post(':token/redeem')
  @RateLimit({ key: 'tenant-password-setup-redeem', limit: 5, ttlMs: 60_000 })
  @ApiOperation({ summary: 'Consume a password setup token and persist the new password.' })
  @ApiOkResponse({ description: 'Password persisted; token is now consumed.' })
  async redeem(@Param('token') rawToken: string, @Body() dto: RedeemPasswordSetupDto) {
    if (!rawToken?.trim()) {
      throw new BadRequestException({
        message: 'Bu şifre belirleme bağlantısı geçersiz veya süresi dolmuş.',
        code: 'invalid_or_expired_token',
      });
    }
    const result = await this.service.redeem(rawToken, dto.password);
    return {
      tenantAccountId: result.tenantAccountId,
      passwordSet: true,
    };
  }
}
