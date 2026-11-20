import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller.js';
import { DevicesService } from './devices.service.js';
import { DatabaseModule } from '../database/database.module.js';
import { ThingsboardModule } from '../thingsboard/thingsboard.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { RealtimeModule } from '../simulation/realtime.module.js';
import { ActivityModule } from '../activity/activity.module.js';

@Module({
  imports: [DatabaseModule, AuthModule, RealtimeModule, ThingsboardModule, ActivityModule],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
