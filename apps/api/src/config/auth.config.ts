export const authConfig = () => ({
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? 'phase1-dev-secret',
    accessTokenTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTokenTtl: process.env.JWT_REFRESH_TTL ?? '7d',
    onboardingTokenTtl: process.env.JWT_ONBOARDING_TTL ?? '30d',
    passwordSaltRounds: Number(process.env.PASSWORD_SALT_ROUNDS ?? 10),
    refreshCookieName: process.env.AUTH_REFRESH_COOKIE_NAME ?? 'lz_refresh_token',
    csrfCookieName: process.env.AUTH_CSRF_COOKIE_NAME ?? 'lz_csrf_token',
    csrfHeaderName: process.env.AUTH_CSRF_HEADER_NAME ?? 'X-CSRF-Token',
    refreshCookieSameSite: process.env.AUTH_REFRESH_COOKIE_SAME_SITE ?? 'lax',
    refreshCookieSecure: process.env.AUTH_REFRESH_COOKIE_SECURE,
    refreshCookiePath: process.env.AUTH_REFRESH_COOKIE_PATH ?? '/',
    cookieDomain: process.env.AUTH_COOKIE_DOMAIN ?? '',
  },
});
