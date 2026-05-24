import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AccessTokenPayload } from '../../../common/security/auth-subject.type';
import { TenantsService } from '../tenants.service';

@Injectable()
export class TenantJwtStrategy extends PassportStrategy(Strategy, 'jwt-tenant') {
  constructor(
    configService: ConfigService,
    private readonly tenantsService: TenantsService,
  ) {
    super({
      // Browsers cannot set an Authorization header on EventSource, so the SSE
      // status stream falls back to the `access_token` query parameter.
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('access_token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('auth.jwtSecret'),
    });
  }

  async validate(payload: AccessTokenPayload) {
    if (payload.type !== 'tenant' || payload.scope !== 'access') {
      throw new UnauthorizedException('Tenant access token is invalid.');
    }

    const account = await this.tenantsService.validateTenant(payload.sub);
    if (!account) {
      throw new UnauthorizedException('Tenant account is inactive or missing.');
    }

    return {
      id: account.id,
      email: account.email,
      type: 'tenant' as const,
    };
  }
}
