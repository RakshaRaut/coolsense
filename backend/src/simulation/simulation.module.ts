import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { TelemetryModule } from '../telemetry/telemetry.module.js';
import { SimulatorEngineModule } from './engine/simulation-engine.module.js';
import {
  SimulationController,
  SimulationManagementController,
} from './simulation.controller.js';
import { RealtimeModule } from './realtime.module.js';
import { SimulationScheduler } from './simulation.scheduler.js';
import { SimulationService } from './simulation.service.js';
import { ThingsboardModule } from '../thingsboard/thingsboard.module.js';

@Module({
  imports: [AuthModule, DatabaseModule, RealtimeModule, SimulatorEngineModule, TelemetryModule, ThingsboardModule],
  controllers: [SimulationController, SimulationManagementController],
  providers: [SimulationScheduler, SimulationService],
  exports: [RealtimeModule, SimulationScheduler, SimulationService],
})
export class SimulationModule {}
