import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthCookieService } from '../../common/security/auth-cookie.service';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { Public } from '../../common/security/decorators/public.decorator';
import { RateLimit } from '../../common/security/decorators/rate-limit.decorator';
import { CsrfGuard } from '../../common/security/guards/csrf.guard';
import { RateLimitGuard } from '../../common/security/guards/rate-limit.guard';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { AdminAuthService } from './admin-auth.service';
import { LoginAdminDto } from './dto/login-admin.dto';

@Controller('admin/auth')
@AuthTypes('admin')
@ApiTags('admin-auth')
export class AdminAuthController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @Post('login')
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: 'admin-login', limit: 5, ttlMs: 60_000 })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with an admin account.' })
  @ApiBody({ type: LoginAdminDto })
  async login(
    @Body() dto: LoginAdminDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.adminAuthService.login(dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    const csrfToken = this.authCookieService.issueRefreshCookies(response, session.refreshToken);

    return {
      accessToken: session.accessToken,
      csrfToken,
      admin: session.admin,
    };
  }

  @Post('refresh')
  @Public()
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit({ key: 'admin-refresh', limit: 10, ttlMs: 60_000 })
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: 'X-CSRF-Token',
    required: true,
    description: 'Must match the CSRF cookie value for cookie-backed refresh requests.',
  })
  @ApiForbiddenResponse({ description: 'CSRF validation failed.' })
  @ApiUnauthorizedResponse({ description: 'Refresh cookie is missing or invalid.' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = this.authCookieService.getRefreshToken(request);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh session cookie is missing.');
    }

    const session = await this.adminAuthService.refresh(refreshToken, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    const csrfToken = this.authCookieService.issueRefreshCookies(response, session.refreshToken);

    return {
      accessToken: session.accessToken,
      csrfToken,
      admin: session.admin,
    };
  }

  @Post('logout')
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit({ key: 'admin-logout', limit: 10, ttlMs: 60_000 })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiHeader({
    name: 'X-CSRF-Token',
    required: true,
    description: 'Must match the CSRF cookie value for cookie-backed logout requests.',
  })
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = this.authCookieService.getRefreshToken(request);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh session cookie is missing.');
    }

    const result = await this.adminAuthService.logout(refreshToken, request.user.id, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    this.authCookieService.clearRefreshCookies(response);
    return result;
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get the authenticated admin profile.' })
  @ApiOkResponse({ description: 'Returns the authenticated admin account summary.' })
  me(@Req() request: AuthenticatedRequest) {
    return this.adminAuthService.getProfile(request.user.id);
  }
}
