import { SimulationEngineService } from '../dist/simulation/engine/simulation-engine.service.js';
import type { SimulationState } from '../dist/simulation/models/simulation-state.model.js';
import type { SimulationConfig } from '../dist/simulation/models/simulation-config.model.js';

const engine = new SimulationEngineService();

const config: SimulationConfig = {
  acType: 'NON_INVERTER',

  roomVolume: 30,
  outsideTemperature: 35,
  initialRoomTemperature: 32,

  targetTemperature: 24,

  ratedCoolingCapacity: 3.5,
  ratedPowerWatts: 1200,

  heatLoadKw: 0.5,

  thermostatDifferential: 1,

  simulationSpeed: 10,

  thermalCapacityKwhPerC: 1.5,
  thermalConductanceKwPerC: 0.08,

  fanPowerWatts: 50,
};

let state: SimulationState = {
  simulationTime: 0,

  roomTemperature: config.initialRoomTemperature,
  roomHumidity: 60,
  outsideTemperature: config.outsideTemperature,

  targetTemperature: config.targetTemperature,

  acPower: true,
  compressorState: false,
  fanState: true,

  coolingCapacity: 0,
  heatingCapacity: 0,
  powerWatts: 0,
  energyKwh: 0,

  operatingMode: 'COOL',
  fanSpeed: 'AUTO',
};

const dtSeconds = 10;

console.log('Starting CoolSense AC simulation...\n');

for (let i = 0; i < 360; i++) {
  state = engine.step(state, config, dtSeconds);

  if (i % 30 === 0) {
    console.log({
      timeMinutes: state.simulationTime / 60,
      roomTemperature: state.roomTemperature.toFixed(2),
      compressor: state.compressorState ? 'ON' : 'OFF',
      coolingCapacity: state.coolingCapacity.toFixed(2),
      powerWatts: state.powerWatts.toFixed(0),
      energyKwh: state.energyKwh.toFixed(4),
    });
  }
}

console.log('\nSimulation completed.');
console.log('Final state:', state);