import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Lieferzonen API')
    .setDescription(
      'Incremental OpenAPI coverage for the active marketplace backend. The spec reflects current real endpoints and only lightly annotated response contracts.',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Use a customer or tenant access token, depending on the protected endpoint.',
      },
      'bearer',
    )
    .addTag('system', 'Health and runtime inspection endpoints.')
    .addTag('customer-auth', 'Customer authentication and session endpoints.')
    .addTag('tenant-auth', 'Tenant authentication and session endpoints.')
    .addTag('tenant-stores', 'Tenant-owned store management endpoints.')
    .addTag('public-stores', 'Customer/public store discovery endpoints.')
    .addTag('tenant-menu', 'Tenant menu management endpoints.')
    .addTag('public-menu', 'Customer/public menu browsing endpoints.')
    .addTag('customer-cart', 'Customer cart interaction endpoints.')
    .addTag('customer-orders', 'Customer order creation and visibility endpoints.')
    .addTag('tenant-orders', 'Tenant-side order handling endpoints.')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });

  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    yamlDocumentUrl: 'api/docs-yaml',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'Lieferzonen API Docs',
  });
}
