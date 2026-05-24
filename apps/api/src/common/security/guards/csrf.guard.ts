import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthCookieService } from '../auth-cookie.service';
import { SecurityLoggerService } from '../security-logger.service';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly authCookieService: AuthCookieService,
    private readonly securityLogger: SecurityLoggerService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const refreshToken = this.authCookieService.getRefreshToken(request);
    const csrfCookieToken = this.authCookieService.getCsrfCookieToken(request);
    const csrfHeaderToken = this.authCookieService.getCsrfHeaderToken(request);

    if (!refreshToken) {
      this.securityLogger.logUnauthorized({
        path: request.originalUrl,
        method: request.method,
        ip: request.ip,
        reason: 'missing_refresh_cookie',
      });
      throw new UnauthorizedException('Refresh session cookie is missing.');
    }

    if (!csrfCookieToken || !csrfHeaderToken || csrfCookieToken !== csrfHeaderToken) {
      this.securityLogger.logForbidden({
        path: request.originalUrl,
        method: request.method,
        ip: request.ip,
        reason: 'csrf_validation_failed',
      });
      throw new ForbiddenException('CSRF validation failed.');
    }

    return true;
  }
}
