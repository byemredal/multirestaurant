import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AccessTokenPayload } from '../../../common/security/auth-subject.type';
import { StaffAuthService } from '../staff-auth.service';

@Injectable()
export class StaffJwtStrategy extends PassportStrategy(Strategy, 'jwt-staff') {
  constructor(
    configService: ConfigService,
    private readonly staffAuthService: StaffAuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('auth.jwtSecret'),
    });
  }

  async validate(payload: AccessTokenPayload) {
    if (payload.type !== 'staff' || payload.scope !== 'access') {
      throw new UnauthorizedException('Staff access token is invalid.');
    }

    const session = await this.staffAuthService.validateStaff(payload.sub);
    if (!session) {
      throw new UnauthorizedException('Staff account is inactive or has no active membership.');
    }

    return {
      id: session.account.id,
      email: session.account.email,
      type: 'staff' as const,
      staffStoreScope: [...session.storeScope],
    };
  }
}
