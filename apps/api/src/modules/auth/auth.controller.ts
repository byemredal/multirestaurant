import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Req,
  Res,
  Post,
  Query,
  UseGuards,
  UnauthorizedException,
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
import { AuthService } from './auth.service';
import { CompleteSocialAuthDto } from './dto/complete-social-auth.dto';
import { LoginCustomerDto } from './dto/login-customer.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';

@Controller('auth')
@AuthTypes('customer')
@ApiTags('customer-auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register a customer account.' })
  @ApiBody({ type: RegisterCustomerDto })
  @ApiOkResponse({
    description:
      'Creates a customer account, returns an access token, and stores the refresh session in an HttpOnly cookie.',
  })
  async register(
    @Body() dto: RegisterCustomerDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.register(dto);
    const csrfToken = this.authCookieService.issueRefreshCookies(response, session.refreshToken);

    return {
      accessToken: session.accessToken,
      csrfToken,
      account: session.account,
    };
  }

  @Post('login')
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: 'customer-login', limit: 5, ttlMs: 60_000 })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with a customer account.' })
  @ApiBody({ type: LoginCustomerDto })
  @ApiOkResponse({
    description:
      'Returns a short-lived access token and rotates the refresh session into an HttpOnly cookie.',
  })
  async login(
    @Body() dto: LoginCustomerDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.login(dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    const csrfToken = this.authCookieService.issueRefreshCookies(response, session.refreshToken);

    return {
      accessToken: session.accessToken,
      csrfToken,
      account: session.account,
    };
  }

  @Post('refresh')
  @Public()
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit({ key: 'customer-refresh', limit: 10, ttlMs: 60_000 })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh a customer session.' })
  @ApiHeader({
    name: 'X-CSRF-Token',
    required: true,
    description: 'Must match the CSRF cookie value for cookie-backed refresh requests.',
  })
  @ApiOkResponse({
    description:
      'Rotates the customer refresh cookie and returns a new short-lived access token.',
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

    const session = await this.authService.refresh(refreshToken, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    const csrfToken = this.authCookieService.issueRefreshCookies(response, session.refreshToken);

    return {
      accessToken: session.accessToken,
      csrfToken,
      account: session.account,
    };
  }

  @Post('logout')
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit({ key: 'customer-logout', limit: 10, ttlMs: 60_000 })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Logout a customer session.' })
  @ApiHeader({
    name: 'X-CSRF-Token',
    required: true,
    description: 'Must match the CSRF cookie value for cookie-backed logout requests.',
  })
  @ApiOkResponse({ description: 'Invalidates the authenticated customer refresh cookie.' })
  @ApiForbiddenResponse({ description: 'CSRF validation failed.' })
  @ApiUnauthorizedResponse({ description: 'Customer bearer token is missing or invalid.' })
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = this.authCookieService.getRefreshToken(request);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh session cookie is missing.');
    }

    const result = await this.authService.logout(refreshToken, request.user.id, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    this.authCookieService.clearRefreshCookies(response);
    return result;
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get the authenticated customer profile.' })
  @ApiOkResponse({ description: 'Returns the currently authenticated customer account summary.' })
  @ApiUnauthorizedResponse({ description: 'Customer bearer token is missing or invalid.' })
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.getProfile(request.user.id);
  }

  @Get('rewards')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get customer rewards summary.' })
  @ApiOkResponse({ description: 'Returns the currently available rewards summary for the authenticated customer.' })
  @ApiUnauthorizedResponse({ description: 'Customer bearer token is missing or invalid.' })
  rewards(@Req() request: AuthenticatedRequest) {
    return this.authService.getRewards(request.user.id);
  }

  @Get('stampcards')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get customer stamp card summary.' })
  @ApiOkResponse({ description: 'Returns stamp card availability for the authenticated customer.' })
  @ApiUnauthorizedResponse({ description: 'Customer bearer token is missing or invalid.' })
  stampCards(@Req() request: AuthenticatedRequest) {
    return this.authService.getStampCards(request.user.id);
  }

  @Get('help')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get customer help and support links.' })
  @ApiOkResponse({ description: 'Returns help channels and FAQ entries for the authenticated customer.' })
  @ApiUnauthorizedResponse({ description: 'Customer bearer token is missing or invalid.' })
  help(@Req() request: AuthenticatedRequest) {
    return this.authService.getHelp(request.user.id);
  }

  @Get('oauth/:provider/start')
  @Public()
  @ApiOperation({ summary: 'Start a customer social auth flow.' })
  @ApiOkResponse({ description: 'Returns the provider authorization URL for the selected social flow.' })
  socialStart(
    @Param('provider') provider: string,
    @Query('mode') mode?: string,
    @Query('returnTo') returnTo?: string,
  ) {
    if (provider !== 'google' && provider !== 'facebook') {
      throw new BadRequestException('Unsupported social auth provider.');
    }

    const normalizedMode = mode === 'signup' ? 'signup' : 'login';
    return this.authService.getSocialAuthorizationUrl(provider, normalizedMode, returnTo);
  }

  @Post('oauth/:provider/complete')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a customer social auth flow.' })
  @ApiBody({ type: CompleteSocialAuthDto })
  @ApiOkResponse({
    description:
      'Exchanges the provider authorization code, links or creates the customer account, and stores the refresh session in an HttpOnly cookie.',
  })
  async socialComplete(
    @Param('provider') provider: string,
    @Body() dto: CompleteSocialAuthDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (provider !== 'google' && provider !== 'facebook') {
      throw new BadRequestException('Unsupported social auth provider.');
    }

    const session = await this.authService.completeSocialAuthorization(provider, dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    const csrfToken = this.authCookieService.issueRefreshCookies(
      response,
      session.refreshToken,
    );

    return {
      accessToken: session.accessToken,
      csrfToken,
      account: session.account,
      returnTo: session.returnTo,
    };
  }
}
