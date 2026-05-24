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
});

export function validateEnvironment(config: Record<string, unknown>) {
  const { error, value } = environmentSchema.validate(config, {
    abortEarly: false,
    allowUnknown: true,
  });

  if (error) {
    throw new Error(`Environment validation failed: ${error.message}`);
  }

  return value;
}
