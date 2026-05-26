import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Req,
  Res,
  Post,
  Sse,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
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
import { LoginTenantDto } from './dto/login-tenant.dto';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { ResumeOnboardingDto } from './dto/resume-onboarding.dto';
import { SetTenantPasswordDto } from './dto/set-tenant-password.dto';
import { StartOnboardingDto } from './dto/start-onboarding.dto';
import { TenantsService } from './tenants.service';

@Controller('tenants')
@AuthTypes('tenant')
@ApiTags('tenant-auth')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register a tenant account.' })
  @ApiBody({ type: RegisterTenantDto })
  @ApiOkResponse({
    description:
      'Creates a tenant account, returns an access token, and stores the refresh session in an HttpOnly cookie.',
  })
  async register(
    @Body() dto: RegisterTenantDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.tenantsService.register(dto);
    const csrfToken = this.authCookieService.issueRefreshCookies(response, session.refreshToken);

    return {
      accessToken: session.accessToken,
      csrfToken,
      tenant: session.tenant,
    };
  }

  @Post('onboarding/start')
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: 'tenant-onboarding-start', limit: 5, ttlMs: 60_000 })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a passwordless tenant onboarding application.' })
  @ApiBody({ type: StartOnboardingDto })
  @ApiOkResponse({
    description:
      'Creates a passwordless tenant account, returns an access token plus a ' +
      'long-lived onboarding continuation token, and stores the refresh session.',
  })
  async startOnboarding(
    @Body() dto: StartOnboardingDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.tenantsService.startOnboarding(dto);
    const csrfToken = this.authCookieService.issueRefreshCookies(response, session.refreshToken);

    return {
      accessToken: session.accessToken,
      csrfToken,
      continuationToken: session.continuationToken,
      tenant: session.tenant,
    };
  }

  @Post('onboarding/resume')
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: 'tenant-onboarding-resume', limit: 10, ttlMs: 60_000 })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume an onboarding application from a continuation token.' })
  @ApiBody({ type: ResumeOnboardingDto })
  @ApiOkResponse({
    description: 'Exchanges a valid onboarding continuation token for an active session.',
  })
  @ApiUnauthorizedResponse({ description: 'The continuation token is missing, invalid, or expired.' })
  async resumeOnboarding(
    @Body() dto: ResumeOnboardingDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.tenantsService.resumeOnboarding(dto.token);
    const csrfToken = this.authCookieService.issueRefreshCookies(response, session.refreshToken);

    return {
      accessToken: session.accessToken,
      csrfToken,
      continuationToken: session.continuationToken,
      tenant: session.tenant,
    };
  }

  @Post('login')
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: 'tenant-login', limit: 5, ttlMs: 60_000 })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with a tenant account.' })
  @ApiBody({ type: LoginTenantDto })
  @ApiOkResponse({
    description:
      'Returns a short-lived access token and rotates the refresh session into an HttpOnly cookie.',
  })
  async login(
    @Body() dto: LoginTenantDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.tenantsService.login(dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    const csrfToken = this.authCookieService.issueRefreshCookies(response, session.refreshToken);

    return {
      accessToken: session.accessToken,
      csrfToken,
      tenant: session.tenant,
    };
  }

  @Post('refresh')
  @Public()
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit({ key: 'tenant-refresh', limit: 10, ttlMs: 60_000 })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh a tenant session.' })
  @ApiHeader({
    name: 'X-CSRF-Token',
    required: true,
    description: 'Must match the CSRF cookie value for cookie-backed refresh requests.',
  })
  @ApiOkResponse({
    description:
      'Rotates the tenant refresh cookie and returns a new short-lived access token.',
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

    const session = await this.tenantsService.refresh(refreshToken, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    const csrfToken = this.authCookieService.issueRefreshCookies(response, session.refreshToken);

    return {
      accessToken: session.accessToken,
      csrfToken,
      tenant: session.tenant,
    };
  }

  @Post('logout')
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit({ key: 'tenant-logout', limit: 10, ttlMs: 60_000 })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Logout a tenant session.' })
  @ApiHeader({
    name: 'X-CSRF-Token',
    required: true,
    description: 'Must match the CSRF cookie value for cookie-backed logout requests.',
  })
  @ApiOkResponse({ description: 'Invalidates the authenticated tenant refresh cookie.' })
  @ApiForbiddenResponse({ description: 'CSRF validation failed.' })
  @ApiUnauthorizedResponse({ description: 'Tenant bearer token is missing or invalid.' })
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = this.authCookieService.getRefreshToken(request);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh session cookie is missing.');
    }

    const result = await this.tenantsService.logout(refreshToken, request.user.id, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    this.authCookieService.clearRefreshCookies(response);
    return result;
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get the authenticated tenant profile.' })
  @ApiOkResponse({ description: 'Returns the currently authenticated tenant account summary.' })
  @ApiUnauthorizedResponse({ description: 'Tenant bearer token is missing or invalid.' })
  me(@Req() request: AuthenticatedRequest) {
    return this.tenantsService.getProfile(request.user.id);
  }

  @Post('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Set or replace the authenticated tenant password.',
    description:
      'Used after approval so an account created through passwordless ' +
      'onboarding can sign in with email + password.',
  })
  @ApiBody({ type: SetTenantPasswordDto })
  @ApiOkResponse({ description: 'Returns the updated tenant account summary.' })
  @ApiUnauthorizedResponse({ description: 'Tenant bearer token is missing or invalid.' })
  setPassword(
    @Req() request: AuthenticatedRequest,
    @Body() dto: SetTenantPasswordDto,
  ) {
    return this.tenantsService.setPassword(request.user.id, dto.password);
  }

  @Sse('me/status/stream')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Server-Sent Events stream of the tenant lifecycle status.',
    description:
      'Emits an immediate snapshot, then one event per status transition. ' +
      'Since browsers cannot set headers on EventSource, the access token may ' +
      'also be passed as the `access_token` query parameter.',
  })
  @ApiUnauthorizedResponse({ description: 'Tenant access token is missing or invalid.' })
  statusStream(@Req() request: AuthenticatedRequest): Observable<MessageEvent> {
    return this.tenantsService.streamStatus(request.user.id);
  }
}
