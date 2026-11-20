import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SimulationGateway } from './simulation.gateway.js';

// Own module so DevicesModule and ThingsboardModule can emit without importing
// SimulationModule (which already depends on both: a circular import).
@Module({
  imports: [AuthModule],
  providers: [SimulationGateway],
  exports: [SimulationGateway],
})
export class RealtimeModule {}
