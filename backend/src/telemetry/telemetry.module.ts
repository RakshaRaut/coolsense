import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { DevicesModule } from '../devices/devices.module.js';
import { TelemetryController } from './telemetry.controller.js';
import { TelemetryRetentionService } from './telemetry-retention.service.js';
import { TelemetryService } from './telemetry.service.js';

@Module({
  imports: [AuthModule, DatabaseModule, DevicesModule],
  controllers: [TelemetryController],
  providers: [TelemetryService, TelemetryRetentionService],
  exports: [TelemetryService],
})
export class TelemetryModule {}