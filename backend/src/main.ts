import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule, ObserveInstrument } from './app.module.js';
import { allowedOrigins } from './common/allowed-origins.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  const config = app.get(ConfigService);

  app.enableCors({
    origin: allowedOrigins(config.get<string>('FRONTEND_URL', '')),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.enableShutdownHooks();

  // Global API prefix
  app.setGlobalPrefix('api/v1');

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const portValue = config.get<string>('PORT', '3000');
  const port = Number(portValue);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  await app.listen(port);

  console.log(`CoolSense backend running on http://localhost:${port}`);
}

await bootstrap();
