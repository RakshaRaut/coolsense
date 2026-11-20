import { describe, expect, it } from 'vitest';
import type { SimulationConfig } from '../models/simulation-config.model.js';
import type { SimulationState } from '../models/simulation-state.model.js';
import { SimulationEngineService } from './simulation-engine.service.js';

describe('SimulationEngineService', () => {
  const service = new SimulationEngineService();
  const config: SimulationConfig = {
    acType: 'NON_INVERTER',
    roomVolume: 30,
    outsideTemperature: 35,
    initialRoomTemperature: 32,
    targetTemperature: 24,
    ratedCoolingCapacity: 3.5,
    ratedHeatingCapacity: 3.5,
    ratedPowerWatts: 1200,
    heatLoadKw: 0.5,
    thermostatDifferential: 1,
    simulationSpeed: 1,
    thermalCapacityKwhPerC: 1.5,
    thermalConductanceKwPerC: 0.08,
    fanPowerWatts: 50,
  };
  const state: SimulationState = {
    simulationTime: 0,
    roomTemperature: 32,
    roomHumidity: 60,
    outsideTemperature: 35,
    targetTemperature: 24,
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

  it('simulates heating mode without applying cooling', () => {
    const next = service.step(
      { ...state, roomTemperature: 20, operatingMode: 'HEAT' },
      config,
      60,
    );

    expect(next.compressorState).toBe(true);
    expect(next.coolingCapacity).toBe(0);
    expect(next.heatingCapacity).toBe(3.5);
    expect(next.roomTemperature).toBeGreaterThan(20);
  });

  it('runs the fan without the compressor in fan-only mode', () => {
    const next = service.step({ ...state, operatingMode: 'FAN' }, config, 60);

    expect(next.compressorState).toBe(false);
    expect(next.coolingCapacity).toBe(0);
    expect(next.heatingCapacity).toBe(0);
    expect(next.powerWatts).toBe(50);
  });

  it('cools and dehumidifies the room while accumulating energy', () => {
    const next = service.step(state, config, 600);

    expect(next.compressorState).toBe(true);
    expect(next.roomTemperature).toBeLessThan(state.roomTemperature);
    expect(next.roomHumidity).toBeLessThan(state.roomHumidity);
    expect(next.powerWatts).toBeGreaterThan(0);
    expect(next.energyKwh).toBeGreaterThan(state.energyKwh);
  });

  it('rejects non-positive timesteps', () => {
    expect(() => service.step(state, config, 0)).toThrow(
      'dtSeconds must be greater than zero',
    );
  });
});
