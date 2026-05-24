export type AuthSubjectType = 'customer' | 'tenant' | 'admin';

export interface AuthSubjectClaims {
  [key: string]: string | boolean | number | undefined;
}

export interface AuthSubjectSnapshot {
  id: string;
  email: string;
  type: AuthSubjectType;
  claims?: AuthSubjectClaims;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  type: AuthSubjectType;
  scope: 'access';
  claims?: AuthSubjectClaims;
}

export interface RefreshTokenPayload {
  sub: string;
  type: AuthSubjectType;
  scope: 'refresh';
  sessionId: string;
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
}
