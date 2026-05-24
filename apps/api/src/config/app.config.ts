export const appConfig = () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 4000),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    corsOrigins: (process.env.CORS_ORIGINS ??
      'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3051,http://127.0.0.1:3051,http://localhost:3060,http://127.0.0.1:3060,http://localhost:3070,http://127.0.0.1:3070')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    bootstrapKey: process.env.BOOTSTRAP_KEY ?? '',
  },
});
