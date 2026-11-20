import { Module } from '@nestjs/common';
import { ThingsboardService } from './thingsboard.service.js';
import {
  ThingsboardController,
  ThingsboardIntegrationController,
} from './thingsboard.controller.js';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { RealtimeModule } from '../simulation/realtime.module.js';

@Module({
  imports: [DatabaseModule, AuthModule, RealtimeModule],
  providers: [ThingsboardService],
  controllers: [ThingsboardController, ThingsboardIntegrationController],
  exports: [ThingsboardService],
})
export class ThingsboardModule {}
