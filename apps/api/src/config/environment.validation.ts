import * as Joi from 'joi';

const environmentSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(4000),
  API_PREFIX: Joi.string().trim().min(1).default('api/v1'),
  CORS_ORIGINS: Joi.string().default(
    `${process.env.CORS_ORIGINS}`,
  ),
  DATABASE_URL: Joi.string()
    .trim()
    .pattern(/^postgres(ql)?:\/\/.+/)
    .required(),
  JWT_SECRET: Joi.string().min(16).required(),
  BOOTSTRAP_KEY: Joi.string().allow('').optional(),
  STATE_TOKEN_SECRET: Joi.string().allow('').optional(),
  PASSWORD_SETUP_TOKEN_SECRET: Joi.string().allow('').optional(),
  ONBOARDING_OTP_SECRET: Joi.string().allow('').optional(),
  JWT_ACCESS_TTL: Joi.string().trim().min(2).default('15m'),
  JWT_REFRESH_TTL: Joi.string().trim().min(2).default('7d'),
  PASSWORD_SALT_ROUNDS: Joi.number().integer().min(4).max(15).default(10),
  AUTH_REFRESH_COOKIE_NAME: Joi.string().trim().min(3).default('lz_refresh_token'),
  AUTH_CSRF_COOKIE_NAME: Joi.string().trim().min(3).default('lz_csrf_token'),
  AUTH_CSRF_HEADER_NAME: Joi.string().trim().min(3).default('X-CSRF-Token'),
  AUTH_REFRESH_COOKIE_SAME_SITE: Joi.string()
    .valid('strict', 'lax', 'none')
    .default('lax'),
  AUTH_REFRESH_COOKIE_SECURE: Joi.string().valid('true', 'false').optional(),
  AUTH_REFRESH_COOKIE_PATH: Joi.string().trim().min(1).default('/'),
  AUTH_COOKIE_DOMAIN: Joi.string().allow('').optional(),
  // Stripe — optional at boot so the API still starts without payment
  // credentials. PaymentsService enforces presence at request time.
  STRIPE_SECRET_KEY: Joi.string().allow('').optional(),
  STRIPE_WEBHOOK_SECRET: Joi.string().allow('').optional(),
  STRIPE_PUBLISHABLE_KEY: Joi.string().allow('').optional(),
  WEB_APP_BASE_URL: Joi.string().trim().uri().default('http://localhost:3000'),
  TENANT_APP_URL: Joi.string().trim().uri().optional(),
  EMAIL_TRANSPORT: Joi.string().valid('log', 'smtp').default('log'),
  EMAIL_FROM_ADDRESS: Joi.string().trim().email().allow('').optional(),
  EMAIL_FROM_NAME: Joi.string().trim().allow('').optional(),
  SMTP_HOST: Joi.string().trim().allow('').optional(),
  SMTP_PORT: Joi.number().port().optional(),
  SMTP_USER: Joi.string().trim().allow('').optional(),
  SMTP_PASSWORD: Joi.string().allow('').optional(),
  SMTP_SECURE: Joi.string().valid('true', 'false').optional(),
});

export function validateEnvironment(config: Record<string, unknown>) {
  const { error, value } = environmentSchema.validate(config, {
    abortEarly: false,
    allowUnknown: true,
  });

  if (error) {
    throw new Error(`Environment validation failed: ${error.message}`);
  }

  if (value.NODE_ENV === 'production') {
    const requiredProductionValues = [
      'JWT_SECRET',
      'BOOTSTRAP_KEY',
      'STATE_TOKEN_SECRET',
      'PASSWORD_SETUP_TOKEN_SECRET',
      'ONBOARDING_OTP_SECRET',
      'CORS_ORIGINS',
      'TENANT_APP_URL',
      'WEB_APP_BASE_URL',
      'SMTP_HOST',
      'SMTP_USER',
      'SMTP_PASSWORD',
      'EMAIL_FROM_ADDRESS',
    ] as const;
    const missing = requiredProductionValues.filter(
      (key) => typeof value[key] !== 'string' || value[key].trim().length === 0,
    );
    if (missing.length > 0) {
      throw new Error(`Production environment validation failed: missing ${missing.join(', ')}`);
    }
    if (value.EMAIL_TRANSPORT !== 'smtp') {
      throw new Error('Production environment validation failed: EMAIL_TRANSPORT must be smtp.');
    }
    if (!Number.isInteger(value.SMTP_PORT) || value.SMTP_PORT <= 0) {
      throw new Error('Production environment validation failed: missing SMTP_PORT');
    }

    const secretKeys = ['JWT_SECRET', 'BOOTSTRAP_KEY', 'STATE_TOKEN_SECRET', 'PASSWORD_SETUP_TOKEN_SECRET', 'ONBOARDING_OTP_SECRET'] as const;
    for (const key of secretKeys) {
      const secret = String(value[key]);
      if (secret.length < 32 || /change-me|local-dev|phase\d|placeholder/i.test(secret)) {
        throw new Error(`Production environment validation failed: ${key} is not a production secret.`);
      }
    }
    for (const key of ['CORS_ORIGINS', 'TENANT_APP_URL', 'WEB_APP_BASE_URL'] as const) {
      if (/localhost|127\.0\.0\.1|undefined|change-me/i.test(String(value[key]))) {
        throw new Error(`Production environment validation failed: ${key} contains a local address.`);
      }
    }
    if (/change-me|placeholder/i.test(String(value.SMTP_PASSWORD))) {
      throw new Error('Production environment validation failed: SMTP_PASSWORD is not a production secret.');
    }
  }

  return value;
}
