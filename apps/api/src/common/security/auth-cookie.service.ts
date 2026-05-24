import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { Request, Response, CookieOptions } from 'express';
import { parseCookieHeader } from './cookie.util';

@Injectable()
export class AuthCookieService {
  constructor(private readonly configService: ConfigService) {}

  issueRefreshCookies(response: Response, refreshToken: string): string {
    const csrfToken = randomBytes(24).toString('hex');

    response.cookie(this.refreshCookieName, refreshToken, {
      ...this.baseCookieOptions,
      httpOnly: true,
    });
    response.cookie(this.csrfCookieName, csrfToken, {
      ...this.baseCookieOptions,
      httpOnly: false,
    });

    return csrfToken;
  }

  clearRefreshCookies(response: Response): void {
    response.clearCookie(this.refreshCookieName, this.baseCookieOptions);
    response.clearCookie(this.csrfCookieName, this.baseCookieOptions);
  }

  getRefreshToken(request: Request): string | null {
    return this.readCookies(request)[this.refreshCookieName] ?? null;
  }

  getCsrfCookieToken(request: Request): string | null {
    return this.readCookies(request)[this.csrfCookieName] ?? null;
  }

  getCsrfHeaderToken(request: Request): string | null {
    const headerValue = request.headers[this.csrfHeaderName.toLowerCase()];
    if (Array.isArray(headerValue)) {
      return headerValue[0] ?? null;
    }

    return headerValue ?? null;
  }

  get csrfHeaderName(): string {
    return this.configService.get<string>('auth.csrfHeaderName', 'X-CSRF-Token');
  }

  private get refreshCookieName(): string {
    return this.configService.get<string>('auth.refreshCookieName', 'lz_refresh_token');
  }

  private get csrfCookieName(): string {
    return this.configService.get<string>('auth.csrfCookieName', 'lz_csrf_token');
  }

  private get baseCookieOptions(): CookieOptions {
    const explicitSecure = this.configService.get<string>('auth.refreshCookieSecure');
    const sameSite = this.configService.get<string>('auth.refreshCookieSameSite', 'lax');

    return {
      path: this.configService.get<string>('auth.refreshCookiePath', '/'),
      domain: this.configService.get<string>('auth.cookieDomain') || undefined,
      sameSite: sameSite as CookieOptions['sameSite'],
      secure:
        explicitSecure === 'true' ||
        (explicitSecure === undefined &&
          this.configService.get<string>('app.nodeEnv', 'development') === 'production'),
    };
  }

  private readCookies(request: Request): Record<string, string> {
    return parseCookieHeader(request.headers.cookie);
  }
}
