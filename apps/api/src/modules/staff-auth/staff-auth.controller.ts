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
import { StoresService } from '../stores/stores.service';
import { AcceptStaffInviteDto } from './dto/accept-invite.dto';
import { LoginStaffDto } from './dto/login-staff.dto';
import { StaffAuthService } from './staff-auth.service';

@Controller('staff')
@AuthTypes('staff')
@ApiTags('staff-auth')
export class StaffAuthController {
  constructor(
    private readonly staffAuthService: StaffAuthService,
    private readonly authCookieService: AuthCookieService,
    private readonly storesService: StoresService,
  ) {}

  @Post('accept-invite')
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: 'staff-accept-invite', limit: 5, ttlMs: 60_000 })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept a staff invite and set initial password.',
    description:
      'Exchanges a single-use invite token for an active staff session. ' +
      'The token is hashed before lookup, must be unused and unexpired, ' +
      'and is atomically marked used so it cannot be replayed.',
  })
  @ApiBody({ type: AcceptStaffInviteDto })
  @ApiOkResponse({ description: 'Returns a staff access token and rotates the refresh cookie.' })
  @ApiUnauthorizedResponse({ description: 'Invite token is invalid, expired, used, or the staff is inactive.' })
  async acceptInvite(
    @Body() dto: AcceptStaffInviteDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.staffAuthService.acceptInvite(
      { token: dto.token, password: dto.password },
      {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      },
    );
    const csrfToken = this.authCookieService.issueRefreshCookies(
      response,
      session.refreshToken,
    );

    return {
      accessToken: session.accessToken,
      csrfToken,
      staff: session.staff,
    };
  }

  @Post('login')
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: 'staff-login', limit: 5, ttlMs: 60_000 })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with a staff account.' })
  @ApiBody({ type: LoginStaffDto })
  @ApiOkResponse({
    description:
      'Returns a short-lived staff access token and rotates the refresh session into an HttpOnly cookie.',
  })
  @ApiUnauthorizedResponse({ description: 'Credentials, employment status, or store scope is invalid.' })
  async login(
    @Body() dto: LoginStaffDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.staffAuthService.login(dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    const csrfToken = this.authCookieService.issueRefreshCookies(response, session.refreshToken);

    return {
      accessToken: session.accessToken,
      csrfToken,
      staff: session.staff,
    };
  }

  @Post('refresh')
  @Public()
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit({ key: 'staff-refresh', limit: 10, ttlMs: 60_000 })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh a staff session.' })
  @ApiHeader({
    name: 'X-CSRF-Token',
    required: true,
    description: 'Must match the CSRF cookie value for cookie-backed refresh requests.',
  })
  @ApiOkResponse({
    description: 'Rotates the staff refresh cookie and returns a new short-lived access token.',
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

    const session = await this.staffAuthService.refresh(refreshToken, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    const csrfToken = this.authCookieService.issueRefreshCookies(response, session.refreshToken);

    return {
      accessToken: session.accessToken,
      csrfToken,
      staff: session.staff,
    };
  }

  @Post('logout')
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit({ key: 'staff-logout', limit: 10, ttlMs: 60_000 })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Logout a staff session.' })
  @ApiHeader({
    name: 'X-CSRF-Token',
    required: true,
    description: 'Must match the CSRF cookie value for cookie-backed logout requests.',
  })
  @ApiOkResponse({ description: 'Invalidates the authenticated staff refresh cookie.' })
  @ApiForbiddenResponse({ description: 'CSRF validation failed.' })
  @ApiUnauthorizedResponse({ description: 'Staff bearer token is missing or invalid.' })
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = this.authCookieService.getRefreshToken(request);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh session cookie is missing.');
    }

    const result = await this.staffAuthService.logout(refreshToken, request.user.id, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    this.authCookieService.clearRefreshCookies(response);
    return result;
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get the authenticated staff profile + live store scope.' })
  @ApiOkResponse({ description: 'Returns the authenticated staff account summary.' })
  @ApiUnauthorizedResponse({ description: 'Staff bearer token is missing or invalid.' })
  me(@Req() request: AuthenticatedRequest) {
    return this.staffAuthService.getProfile(request.user.id);
  }

  @Get('me/stores')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'List operator-readable store metadata for the authenticated staff session.',
    description:
      'Hydrates the staff JWT store scope into `{id, name, slug, status, isActive}` rows so ' +
      'the staff UI can render store names instead of UUIDs. Strictly limited to the live ' +
      'scope from `request.user.staffStoreScope` — never returns tenant-wide stores.',
  })
  @ApiOkResponse({
    description: 'Returns the assigned stores for this staff session.',
  })
  @ApiUnauthorizedResponse({ description: 'Staff bearer token is missing or invalid.' })
  async myStores(@Req() request: AuthenticatedRequest) {
    const scope = request.user.staffStoreScope ?? [];
    const stores = await this.storesService.listForStaffScope(scope);
    return { stores };
  }
}
