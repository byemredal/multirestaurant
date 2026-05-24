import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from '../filters/http-exception.filter';

export function configureApp(
  app: INestApplication,
  configService: ConfigService,
): void {
  app.setGlobalPrefix(configService.get<string>('app.apiPrefix', 'api/v1'));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.disable('x-powered-by');

  app.use((request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    next();
  });

  const corsOrigins = configService.get<string[]>('app.corsOrigins', []);
  if (corsOrigins.includes('*')) {
    throw new Error('CORS_ORIGINS must be an explicit allow-list. Wildcard origins are not allowed.');
  }

  if (corsOrigins.length > 0) {
    const allowedOrigins = new Set(corsOrigins);
    app.enableCors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin ${origin} is not allowed by CORS.`), false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-CSRF-Token',
        'X-Bootstrap-Key',
      ],
    });
  }
}
