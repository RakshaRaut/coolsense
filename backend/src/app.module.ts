import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { fileURLToPath } from 'node:url';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { SimulatorEngineModule } from './simulation/engine/simulation-engine.module.js';
import { DevicesModule } from './devices/devices.module.js';
import { AcControlModule } from './ac-control/ac-control.module.js';
import { SimulationModule } from './simulation/simulation.module.js';
import { TelemetryModule } from './telemetry/telemetry.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { ThingsboardModule } from './thingsboard/thingsboard.module.js';
import { ActivityModule } from './activity/activity.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: fileURLToPath(new URL('../../.env', import.meta.url)),
    }),
    DatabaseModule,
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com,
    // then run `npx @nestjs/observe link` to write your key pair into .env.
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'backend',
    }),
    AuthModule,
    UsersModule,
    SimulatorEngineModule,
    DevicesModule,
    AcControlModule,
    SimulationModule,
    TelemetryModule,
    AnalyticsModule,
    ThingsboardModule,
    ActivityModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
