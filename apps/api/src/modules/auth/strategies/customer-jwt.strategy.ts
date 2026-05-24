import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AccessTokenPayload } from '../../../common/security/auth-subject.type';
import { AuthService } from '../auth.service';

@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(Strategy, 'jwt-customer') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('auth.jwtSecret'),
    });
  }

  async validate(payload: AccessTokenPayload) {
    if (payload.type !== 'customer' || payload.scope !== 'access') {
      throw new UnauthorizedException('Customer access token is invalid.');
    }

    const account = await this.authService.validateCustomer(payload.sub);
    if (!account) {
      throw new UnauthorizedException('Customer account is inactive or missing.');
    }

    return {
      id: account.id,
      email: account.email,
      type: 'customer' as const,
    };
  }
}
