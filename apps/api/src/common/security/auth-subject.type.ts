/**
 * The four authentication surfaces in the platform. Each surface owns a
 * distinct identity table (CustomerAccount / TenantAccount / StaffAccount /
 * AdminAccount) and a distinct login flow. SubjectType is what stops a
 * token issued for one surface from being silently honored on another:
 *
 *   - SessionTokenService refuses to verify an access/refresh token whose
 *     `type` does not match the surface asking for it.
 *   - RefreshSession.subjectType is CHECK-constrained at the DB level
 *     (see migration 0002) so a rotated session cannot cross surfaces.
 *   - AccessTokenGuard rejects requests that pass through a controller
 *     whose `@AuthTypes(...)` does not include the token's type.
 *
 * Staff is structurally a first-class subject after MR-ARCH-02. The
 * runtime controllers + JWT strategy for staff login land in a follow-up
 * slice; until then, the AccessTokenGuard fails closed on `type === 'staff'`
 * — the type is reserved so issued staff tokens cannot accidentally be
 * accepted as another surface's token.
 */
export type AuthSubjectType = 'customer' | 'tenant' | 'staff' | 'admin';

export const AUTH_SUBJECT_TYPES: readonly AuthSubjectType[] = [
  'customer',
  'tenant',
  'staff',
  'admin',
] as const;

export interface AuthSubjectClaims {
  [key: string]: string | string[] | boolean | number | undefined;
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
