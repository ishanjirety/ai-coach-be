import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { AppConfigService } from './config/app-config.service.js';

async function bootstrap() {
  // Buffer logs until the pino logger is ready so bootstrap logs aren't lost.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const logger = app.get(Logger);
  app.useLogger(logger);

  const config = app.get(AppConfigService);

  // Chat requests carry the whole conversation; the 100kb default is tight.
  app.useBodyParser('json', { limit: '1mb' });
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get('CORS_ORIGINS'),
    exposedHeaders: ['x-request-id'],
  });
  app.enableShutdownHooks();

  const port = config.get('PORT');
  await app.listen(port);
  logger.log(`DSA Coach BE listening on http://localhost:${port}/api`);
}

await bootstrap();
