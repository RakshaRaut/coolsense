import { Module } from '@nestjs/common';
import { SimulationEngineService } from './simulation-engine.service.js';

@Module({
  providers: [SimulationEngineService],
  exports: [SimulationEngineService],
})
export class SimulatorEngineModule {}
