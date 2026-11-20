import { Module } from '@nestjs/common';

import { AcControlController } from './ac-control.controller.js';
import { AcControlService } from './ac-control.service.js';
import { LegacyAcControlController } from './legacy-ac-control.controller.js';
import { SimulatorEngineModule } from '../simulation/engine/simulation-engine.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { SimulationModule } from '../simulation/simulation.module.js';
import { TelemetryModule } from '../telemetry/telemetry.module.js';

@Module({
  imports: [
    DatabaseModule,
    SimulatorEngineModule,
    SimulationModule,
    TelemetryModule,
  ],
  controllers: [AcControlController, LegacyAcControlController],
  providers: [AcControlService],
  exports: [AcControlService],
})
export class AcControlModule {}
