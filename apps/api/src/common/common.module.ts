import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { HealthController } from './controllers/health.controller';
import { AuthCookieService } from './security/auth-cookie.service';
import { CsrfGuard } from './security/guards/csrf.guard';
import { RateLimitGuard } from './security/guards/rate-limit.guard';
import { PasswordService } from './security/password.service';
import { RefreshSessionsStore } from './security/refresh-sessions.store';
import { SecurityLoggerService } from './security/security-logger.service';
import { SessionTokenService } from './security/session-token.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('auth.jwtSecret'),
      }),
    }),
  ],
  controllers: [HealthController],
  providers: [
    PasswordService,
    RefreshSessionsStore,
    SessionTokenService,
    SecurityLoggerService,
    AuthCookieService,
    CsrfGuard,
    RateLimitGuard,
  ],
  exports: [
    JwtModule,
    PasswordService,
    RefreshSessionsStore,
    SessionTokenService,
    SecurityLoggerService,
    AuthCookieService,
    CsrfGuard,
    RateLimitGuard,
  ],
})
export class CommonModule {}
