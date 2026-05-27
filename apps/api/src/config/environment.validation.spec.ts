import { validateEnvironment } from './environment.validation';

describe('validateEnvironment production security gate', () => {
  const base = {
    DATABASE_URL: 'postgresql://postgres:secret@db:5432/lieferzonen',
    JWT_SECRET: 'jwt-secret-with-at-least-thirty-two-characters',
  };

  it('keeps development configuration usable without SMTP wiring', () => {
    expect(validateEnvironment({ ...base, NODE_ENV: 'development' })).toMatchObject({
      NODE_ENV: 'development',
      EMAIL_TRANSPORT: 'log',
    });
  });

  it('rejects production configuration that still contains unsafe placeholders', () => {
    expect(() =>
      validateEnvironment({
        ...base,
        NODE_ENV: 'production',
        JWT_SECRET: 'change-me-at-least-32-characters-now',
        BOOTSTRAP_KEY: 'bootstrap-key-with-more-than-thirty-two-chars',
        STATE_TOKEN_SECRET: 'state-token-secret-with-thirty-two-chars',
        PASSWORD_SETUP_TOKEN_SECRET: 'password-secret-with-thirty-two-chars',
        ONBOARDING_OTP_SECRET: 'otp-secret-with-more-than-thirty-two-chars',
        CORS_ORIGINS: 'https://tenant.example.com',
        TENANT_APP_URL: 'https://tenant.example.com',
        WEB_APP_BASE_URL: 'https://web.example.com',
        EMAIL_TRANSPORT: 'smtp',
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587,
        SMTP_USER: 'mailer',
        SMTP_PASSWORD: 'smtp-password',
        EMAIL_FROM_ADDRESS: 'mail@example.com',
      }),
    ).toThrow(/JWT_SECRET is not a production secret/);
  });

  it('accepts a complete production mail and secret configuration', () => {
    expect(
      validateEnvironment({
        ...base,
        NODE_ENV: 'production',
        BOOTSTRAP_KEY: 'bootstrap-key-with-more-than-thirty-two-chars',
        STATE_TOKEN_SECRET: 'state-token-secret-with-more-than-32-characters',
        PASSWORD_SETUP_TOKEN_SECRET: 'password-token-secret-with-more-than-32-chars',
        ONBOARDING_OTP_SECRET: 'onboarding-otp-secret-with-more-than-32-chars',
        CORS_ORIGINS: 'https://tenant.example.com,https://admin.example.com',
        TENANT_APP_URL: 'https://tenant.example.com',
        WEB_APP_BASE_URL: 'https://web.example.com',
        EMAIL_TRANSPORT: 'smtp',
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587,
        SMTP_USER: 'mailer',
        SMTP_PASSWORD: 'smtp-password',
        EMAIL_FROM_ADDRESS: 'mail@example.com',
      }),
    ).toMatchObject({ NODE_ENV: 'production', EMAIL_TRANSPORT: 'smtp' });
  });
});
