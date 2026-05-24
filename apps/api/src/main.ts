import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { configureApp } from './common/bootstrap/configure-app';
import { configureSwagger } from './common/bootstrap/configure-swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true preserves the unparsed request body buffer (req.rawBody),
  // which the Stripe webhook controller needs for signature verification.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableShutdownHooks();
  const configService = app.get(ConfigService);

  configureApp(app, configService);
  configureSwagger(app);

  const port = configService.get<number>('app.port', 4000);
  await app.listen(port);
  console.log(`Lieferzonen API is running on: ${await app.getUrl()}`);
}

void bootstrap();
