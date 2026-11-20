import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimulationEngineService } from './engine/simulation-engine.service.js';
import type { SimulationConfig } from './models/simulation-config.model.js';
import type { SimulationState } from './models/simulation-state.model.js';
import { SimulationScheduler } from './simulation.scheduler.js';

describe('SimulationScheduler', () => {
  let scheduler: SimulationScheduler;
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
  const initialState: SimulationState = {
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

  beforeEach(() => {
    vi.useFakeTimers();
    scheduler = new SimulationScheduler(new SimulationEngineService());
  });

  afterEach(async () => {
    await scheduler.onModuleDestroy();
    vi.useRealTimers();
  });

  it('advances independent simulations through the shared engine', async () => {
    const firstTick = vi.fn().mockResolvedValue(undefined);
    const secondTick = vi.fn().mockResolvedValue(undefined);
    scheduler.start('simulation-1', config, initialState, initialState, firstTick);
    scheduler.start('simulation-2', config, initialState, initialState, secondTick);

    await vi.advanceTimersByTimeAsync(1000);

    expect(scheduler.activeCount).toBe(2);
    expect(firstTick).toHaveBeenCalledOnce();
    expect(secondTick).toHaveBeenCalledOnce();
    expect(scheduler.getState('simulation-1')).toMatchObject({
      simulationTime: 1,
      roomTemperature: expect.any(Number),
      energyKwh: expect.any(Number),
    });
    expect(scheduler.getState('simulation-1')?.roomTemperature).toBeLessThan(32);
    expect(scheduler.getState('simulation-1')?.energyKwh).toBeGreaterThan(0);
    expect(scheduler.getState('simulation-2')?.simulationTime).toBe(1);
  });

  it('prevents duplicate timers and waits for an in-flight tick before stopping', async () => {
    let finishTick: (() => void) | undefined;
    const onTick = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishTick = resolve;
        }),
    );
    scheduler.start('simulation-1', config, initialState, initialState, onTick);
    expect(() =>
      scheduler.start('simulation-1', config, initialState, initialState, onTick),
    ).toThrow('already scheduled');

    await vi.advanceTimersByTimeAsync(1000);
    expect(onTick).toHaveBeenCalledOnce();
    let stopped = false;
    const stopping = scheduler.stop('simulation-1').then(() => {
      stopped = true;
    });
    await vi.advanceTimersByTimeAsync(10);
    expect(stopped).toBe(false);
    finishTick?.();
    await vi.advanceTimersByTimeAsync(5);
    await stopping;
    expect(stopped).toBe(true);
    expect(scheduler.activeCount).toBe(0);
  });

  it('clears every execution timer during application shutdown', async () => {
    const onTick = vi.fn().mockResolvedValue(undefined);
    scheduler.start('simulation-1', config, initialState, initialState, onTick);
    scheduler.start('simulation-2', config, initialState, initialState, onTick);

    await scheduler.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(2000);

    expect(scheduler.activeCount).toBe(0);
    expect(onTick).not.toHaveBeenCalled();
  });
});
