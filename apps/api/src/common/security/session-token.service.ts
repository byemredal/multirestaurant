import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import {
  AccessTokenPayload,
  AuthSubjectSnapshot,
  AuthSubjectType,
  IssuedSession,
  RefreshTokenPayload,
} from './auth-subject.type';
import { RefreshSessionRecord, RefreshSessionsStore } from './refresh-sessions.store';

@Injectable()
export class SessionTokenService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly refreshSessionsStore: RefreshSessionsStore,
  ) {}

  async issueSession(subject: AuthSubjectSnapshot): Promise<IssuedSession> {
    const accessTokenTtl = this.configService.get<string>('auth.accessTokenTtl', '15m');
    const refreshTokenTtl = this.configService.get<string>('auth.refreshTokenTtl', '7d');
    const sessionId = randomUUID();
    const accessPayload: AccessTokenPayload = {
      sub: subject.id,
      email: subject.email,
      type: subject.type,
      scope: 'access',
      claims: subject.claims,
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: subject.id,
      type: subject.type,
      scope: 'refresh',
      sessionId,
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      expiresIn: accessTokenTtl as any,
    });
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      expiresIn: refreshTokenTtl as any,
    });

    const decoded = this.jwtService.decode(refreshToken) as { exp?: number } | null;
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date();

    const session: RefreshSessionRecord = {
      id: sessionId,
      token: refreshToken,
      subjectId: subject.id,
      subjectType: subject.type,
      expiresAt,
      isRevoked: false,
      createdAt: new Date(),
      revokedAt: null,
    };

    await this.refreshSessionsStore.save(session);

    return { accessToken, refreshToken };
  }

  async rotateRefreshToken(
    refreshToken: string,
    subject: AuthSubjectSnapshot,
  ): Promise<IssuedSession> {
    const payload = await this.verifyRefreshToken(refreshToken, subject.type);
    const existingSession = await this.refreshSessionsStore.findActive(
      refreshToken,
      subject.type,
    );

    if (!existingSession || existingSession.id !== payload.sessionId) {
      throw new UnauthorizedException('Refresh session is invalid or revoked.');
    }

    await this.refreshSessionsStore.revoke(refreshToken);
    return this.issueSession(subject);
  }

  async revokeRefreshToken(
    refreshToken: string,
    subjectType: AuthSubjectType,
  ): Promise<boolean> {
    const activeSession = await this.refreshSessionsStore.findActive(
      refreshToken,
      subjectType,
    );
    if (!activeSession) {
      return false;
    }

    await this.refreshSessionsStore.revoke(refreshToken);
    return true;
  }

  /**
   * Issues a long-lived, single-purpose onboarding continuation token. It is
   * NOT an access token — its `scope` is `onboarding`, so `verifyAccessToken`
   * (and therefore every authenticated API route) rejects it. It can only be
   * exchanged for a real session through the public onboarding resume
   * endpoint, which lets a partner continue a half-finished application later.
   */
  async issueOnboardingToken(subjectId: string): Promise<string> {
    const ttl = this.configService.get<string>('auth.onboardingTokenTtl', '30d');
    return this.jwtService.signAsync(
      { sub: subjectId, type: 'tenant', scope: 'onboarding' },
      { expiresIn: ttl as any },
    );
  }

  async verifyOnboardingToken(token: string): Promise<{ sub: string }> {
    const payload = await this.jwtService.verifyAsync<{
      sub: string;
      type: string;
      scope: string;
    }>(token);

    if (payload.scope !== 'onboarding' || payload.type !== 'tenant') {
      throw new UnauthorizedException('Onboarding continuation token is invalid.');
    }

    return { sub: payload.sub };
  }

  async verifyAccessToken(
    token: string,
    subjectType: AuthSubjectType,
  ): Promise<AccessTokenPayload> {
    const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);

    if (payload.scope !== 'access' || payload.type !== subjectType) {
      throw new UnauthorizedException('Access token does not match the requested subject.');
    }

    return payload;
  }

  async verifyRefreshToken(
    token: string,
    subjectType: AuthSubjectType,
  ): Promise<RefreshTokenPayload> {
    const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(token);

    if (payload.scope !== 'refresh' || payload.type !== subjectType) {
      throw new UnauthorizedException('Refresh token does not match the requested subject.');
    }

    return payload;
  }
}
