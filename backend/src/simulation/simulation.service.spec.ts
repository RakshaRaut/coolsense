import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { TelemetryService } from '../telemetry/telemetry.service.js';
import type { ThingsboardService } from '../thingsboard/thingsboard.service.js';
import type { SimulationGateway } from './simulation.gateway.js';
import { Prisma } from '@prisma/client';
import { SimulationEngineService } from './engine/simulation-engine.service.js';
import { SimulationScheduler } from './simulation.scheduler.js';
import { SimulationService } from './simulation.service.js';
import {
  InsulationLevel,
  type StartSimulationDto,
} from './dto/simulation.dto.js';

describe('SimulationService', () => {
  it('stops the ticker when its simulation row was deleted while running', async () => {
    const transaction = {
      simulation: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const prisma = {
      $transaction: vi.fn((run: (tx: typeof transaction) => unknown) =>
        run(transaction),
      ),
    };
    const scheduler = { stop: vi.fn().mockResolvedValue(undefined) };
    const gateway = { publishState: vi.fn() };
    const service = new SimulationService(
      prisma as unknown as PrismaService,
      scheduler as unknown as SimulationScheduler,
      gateway as unknown as SimulationGateway,
      {} as TelemetryService,
      {} as ThingsboardService,
      { get: () => '5000' } as unknown as ConfigService,
    );

    await (
      service as unknown as {
        persistTick: (...args: unknown[]) => Promise<void>;
      }
    ).persistTick('sim-1', {}, {}, new Date(), false);

    expect(scheduler.stop).toHaveBeenCalledWith('sim-1');
    expect(gateway.publishState).not.toHaveBeenCalled();
  });

  it('writes telemetry at most every TELEMETRY_INTERVAL_MS while publishing every tick', async () => {
    const transaction = {
      simulation: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ status: 'RUNNING', deviceId: 'device-1' }),
        update: vi.fn().mockResolvedValue({ device: { ownerId: 'owner-1' } }),
      },
      device: { update: vi.fn().mockResolvedValue({}) },
      simulationSnapshot: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn((run: (tx: typeof transaction) => unknown) =>
        run(transaction),
      ),
    };
    const telemetry = { saveGeneratedTelemetry: vi.fn() };
    const gateway = { publishState: vi.fn() };
    const service = new SimulationService(
      prisma as unknown as PrismaService,
      {} as SimulationScheduler,
      gateway as unknown as SimulationGateway,
      telemetry as unknown as TelemetryService,
      { isEnabled: () => false } as unknown as ThingsboardService,
      { get: () => '5000' } as unknown as ConfigService,
    );
    const internals = service as unknown as {
      toSession: () => object;
      persistTick: (...args: unknown[]) => Promise<void>;
    };
    internals.toSession = () => ({});

    const start = Date.parse('2026-01-01T00:00:00Z');
    for (let second = 0; second <= 10; second++) {
      await internals.persistTick(
        'sim-1',
        { energyKwh: second },
        {},
        new Date(start + second * 1000),
        false,
      );
    }

    expect(gateway.publishState).toHaveBeenCalledTimes(11);
    expect(transaction.device.update).toHaveBeenCalledTimes(11);
    expect(
      telemetry.saveGeneratedTelemetry.mock.calls.map(
        (call) => (call[0] as { energyKwh: number }).energyKwh,
      ),
    ).toEqual([0, 5, 10]);
  });

  it('writes a final telemetry row when a running simulation stops', async () => {
    const record = {
      id: 'sim-1',
      deviceId: 'device-1',
      status: 'RUNNING',
      currentState: {},
      device: { ownerId: 'owner-1' },
    };
    const transaction = {
      simulation: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(record),
      },
      device: { update: vi.fn() },
    };
    const prisma = {
      simulation: { findFirst: vi.fn().mockResolvedValue(record) },
      $transaction: vi.fn((run: (tx: typeof transaction) => unknown) =>
        run(transaction),
      ),
    };
    const telemetry = { saveGeneratedTelemetry: vi.fn() };
    const service = new SimulationService(
      prisma as unknown as PrismaService,
      {
        stop: vi.fn().mockResolvedValue({ energyKwh: 1.5 }),
      } as unknown as SimulationScheduler,
      { publishLifecycle: vi.fn() } as unknown as SimulationGateway,
      telemetry as unknown as TelemetryService,
      {} as ThingsboardService,
      { get: () => '5000' } as unknown as ConfigService,
    );
    (service as unknown as { toSession: () => object }).toSession = () => ({});

    await service.stopSimulation('owner-1', 'sim-1');

    expect(telemetry.saveGeneratedTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'device-1', energyKwh: 1.5 }),
      transaction,
    );
  });

  it('refuses to start a second running simulation on the same device', async () => {
    const prisma = {
      simulation: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: 'sim-2', deviceId: 'device-1', status: 'CREATED' })
          .mockResolvedValueOnce({ id: 'sim-1' }),
      },
      $transaction: vi.fn(),
    };
    const service = new SimulationService(
      prisma as unknown as PrismaService,
      { has: () => false } as unknown as SimulationScheduler,
      {} as SimulationGateway,
      {} as TelemetryService,
      {} as ThingsboardService,
      { get: () => '5000' } as unknown as ConfigService,
    );

    await expect(service.startSimulation('user-1', 'sim-2')).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('SimulationService session and start inputs', () => {
  const device = {
    id: 'device-1',
    name: 'Bedroom AC',
    ownerId: 'owner-1',
    acType: 'INVERTER',
    roomVolume: 50,
    outsideTemperature: 35,
    initialRoomTemperature: 32,
    targetTemperature: 24,
    ratedCoolingCapacity: 3.5,
    ratedHeatingCapacity: 3.5,
    ratedPowerWatts: 1000,
    heatLoadKw: 0.5,
    thermostatDifferential: 0.5,
    simulationSpeed: 1,
    thermalCapacityKwhPerC: 1,
    thermalConductanceKwPerC: 0.08,
    fanPowerWatts: 50,
    simulationTime: 0,
    roomTemperature: 32,
    roomHumidity: 60,
    acPower: false,
    compressorState: false,
    fanState: false,
    coolingCapacity: 0,
    heatingCapacity: 0,
    powerWatts: 0,
    energyKwh: 0,
    operatingMode: 'COOL',
    fanSpeed: 'AUTO',
  };

  function makeService(prisma: object, scheduler: object = {}) {
    return new SimulationService(
      prisma as unknown as PrismaService,
      scheduler as unknown as SimulationScheduler,
      {} as SimulationGateway,
      {} as TelemetryService,
      {} as ThingsboardService,
      { get: () => '5000' } as unknown as ConfigService,
    );
  }

  // Runs POST /simulation/start on a device with no simulation; returns what create() persisted.
  async function startWith(input: Partial<StartSimulationDto>) {
    const prisma = {
      device: { findFirst: vi.fn().mockResolvedValue(device) },
      simulation: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'sim-1' }),
      },
      simulationSnapshot: { create: vi.fn() },
    };
    const service = makeService(prisma);
    Object.assign(service, {
      findOne: vi.fn().mockResolvedValue({ id: 'sim-1' }),
      startSimulation: vi.fn(),
      toSession: () => ({}),
    });
    await service.start('owner-1', { deviceId: 'device-1', speed: 1, ...input });
    const { data } = prisma.simulation.create.mock.calls[0][0] as {
      data: {
        config: Record<string, number>;
        initialState: Record<string, number>;
      };
    };
    return data;
  }

  it('returns a reset (CREATED) simulation as an idle session', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: 'sim-1',
      deviceId: 'device-1',
      status: 'CREATED',
      config: device,
      currentState: device,
      startedAt: null,
    });
    const service = makeService({ simulation: { findFirst } });

    const session = await service.getSession('owner-1', 'device-1');

    expect(session).toMatchObject({ id: 'sim-1', status: 'idle' });
    expect(findFirst.mock.calls[0][0].where).not.toHaveProperty('status');
  });

  it('keeps the device defaults when start inputs are omitted', async () => {
    const { config, initialState } = await startWith({});

    expect(config).toMatchObject({
      initialRoomTemperature: 32,
      thermalConductanceKwPerC: 0.08,
      heatLoadKw: 0.5,
    });
    expect(initialState).toMatchObject({
      roomTemperature: 32,
      roomHumidity: 60,
    });
  });

  it.each([
    ['initialState', 'roomTemperature', 'roomTempC', { roomTempC: 26 }, 26],
    ['config', 'initialRoomTemperature', 'roomTempC', { roomTempC: 26 }, 26],
    ['initialState', 'roomHumidity', 'humidityPct', { environment: { humidityPct: 75 } }, 75],
    ['config', 'thermalConductanceKwPerC', 'poor insulation', { environment: { insulation: InsulationLevel.POOR } }, 0.128],
    ['config', 'thermalConductanceKwPerC', 'good insulation', { environment: { insulation: InsulationLevel.GOOD } }, 0.048],
    ['config', 'thermalConductanceKwPerC', 'excellent insulation', { environment: { insulation: InsulationLevel.EXCELLENT } }, 0.028],
    ['config', 'heatLoadKw', 'occupancy', { environment: { occupancy: 3 } }, 0.8],
    ['config', 'heatLoadKw', 'windowExposure', { environment: { windowExposure: 0.5 } }, 0.69],
    ['config', 'heatLoadKw', 'heatGainW + occupancy + windowExposure', { environment: { heatGainW: 200, occupancy: 2, windowExposure: 1 } }, 0.78],
  ] as const)('sets %s.%s from %s', async (target, field, _, input, expected) => {
    const data = await startWith(input as Partial<StartSimulationDto>);

    expect(data[target][field]).toBeCloseTo(expected, 9);
  });

  // POST /simulation/start while the device's latest simulation is in `status`.
  function startExisting(status: string) {
    const record = {
      id: 'sim-1',
      deviceId: 'device-1',
      status,
      config: { ...device, initialRoomTemperature: 30 },
      currentState: device,
      initialState: device,
      device,
    };
    const transaction = {
      simulation: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(record),
      },
      device: { update: vi.fn() },
    };
    const prisma = {
      device: { findFirst: vi.fn().mockResolvedValue(device) },
      simulation: {
        // latestForDevice, findOne, then assertDeviceIdle (no other RUNNING run).
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(record)
          .mockResolvedValueOnce(record)
          .mockResolvedValueOnce(null),
        create: vi.fn(),
      },
      $transaction: vi.fn((run: (tx: typeof transaction) => unknown) =>
        run(transaction),
      ),
    };
    const service = makeService(prisma, { has: () => false });
    const resumeSimulation = vi.fn().mockResolvedValue(record);
    Object.assign(service, {
      resumeSimulation,
      schedule: vi.fn(),
      publishLifecycle: vi.fn(),
      toSession: (simulation: object) => simulation,
    });
    const result = service.start('owner-1', {
      deviceId: 'device-1',
      speed: 5,
      roomTempC: 27,
      environment: {
        humidityPct: 72,
        insulation: InsulationLevel.POOR,
        occupancy: 4,
      },
    });
    return { result, record, prisma, transaction, resumeSimulation };
  }

  it('restarts a reset (CREATED) simulation in place with the new start inputs', async () => {
    const { result, prisma, transaction } = startExisting('CREATED');
    await result;

    expect(prisma.simulation.create).not.toHaveBeenCalled();
    const { where, data } = transaction.simulation.updateMany.mock.calls[0][0];
    expect(where).toEqual({ id: 'sim-1', status: 'CREATED' });
    expect(data.status).toBe('RUNNING');
    expect(data.config).toMatchObject({
      initialRoomTemperature: 27,
      simulationSpeed: 5,
      thermalConductanceKwPerC: expect.closeTo(0.128, 9),
      heatLoadKw: expect.closeTo(0.9, 9),
    });
    expect(data.initialState).toMatchObject({
      roomTemperature: 27,
      roomHumidity: 72,
      acPower: false,
    });
    expect(data.currentState).toMatchObject({
      roomTemperature: 27,
      roomHumidity: 72,
      acPower: true,
    });
    expect(transaction.device.update.mock.calls[0][0].data).toMatchObject({
      roomTemperature: 27,
      roomHumidity: 72,
      simulationStatus: 'running',
      simulationSpeed: 5,
    });
  });

  it('returns a RUNNING simulation unchanged (idempotent start)', async () => {
    const { result, record, prisma, resumeSimulation } =
      startExisting('RUNNING');

    await expect(result).resolves.toBe(record);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.simulation.create).not.toHaveBeenCalled();
    expect(resumeSimulation).not.toHaveBeenCalled();
  });

  it('resumes a PAUSED simulation and ignores the new start inputs', async () => {
    const { result, prisma, resumeSimulation } = startExisting('PAUSED');
    await result;

    expect(resumeSimulation).toHaveBeenCalledWith('owner-1', 'sim-1');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.simulation.create).not.toHaveBeenCalled();
  });
});

describe('SimulationService concurrency', () => {
  const config = {
    acType: 'NON_INVERTER' as const,
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
  const state = {
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
  const settings = { get: () => '5000' } as unknown as ConfigService;

  it('keeps an AC command that lands while a tick is persisting', async () => {
    vi.useFakeTimers();
    const scheduler = new SimulationScheduler(new SimulationEngineService());
    const writes: string[] = [];
    let finishTick: (() => void) | undefined;
    const onTick = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishTick = () => {
            writes.push('tick');
            resolve();
          };
        }),
    );
    const prisma = {
      simulation: {
        findMany: vi.fn().mockResolvedValue([{ id: 'sim-1', config }]),
        update: vi.fn(() => {
          writes.push('command');
          return Promise.resolve({});
        }),
      },
      device: { update: vi.fn().mockResolvedValue({}) },
    };
    const service = new SimulationService(
      prisma as unknown as PrismaService,
      scheduler,
      {} as SimulationGateway,
      {} as TelemetryService,
      {} as ThingsboardService,
      settings,
    );
    try {
      scheduler.start('sim-1', config, state, state, onTick);
      await vi.advanceTimersByTimeAsync(1000);
      expect(onTick).toHaveBeenCalledOnce(); // tick computed acPower=true, its DB write is in flight

      const command = service.syncDeviceControl('device-1', {
        ...state,
        acPower: false,
      });
      await vi.advanceTimersByTimeAsync(0);
      finishTick?.();
      await command;

      expect(writes).toEqual(['tick', 'command']);
      expect(prisma.device.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ acPower: false }),
        }),
      );
      expect(scheduler.getState('sim-1')?.acPower).toBe(false);
    } finally {
      await scheduler.onModuleDestroy();
      vi.useRealTimers();
    }
  });

  it('maps the RUNNING-per-device unique violation to the existing 409', async () => {
    const prisma = {
      simulation: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'sim-2',
            deviceId: 'device-1',
            status: 'CREATED',
            config,
            currentState: state,
            initialState: state,
          })
          .mockResolvedValueOnce(null) // pre-check passes: the race window
          .mockResolvedValueOnce({ id: 'sim-1' }), // the winner, read after P2002
      },
      $transaction: vi.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      ),
    };
    const service = new SimulationService(
      prisma as unknown as PrismaService,
      { has: () => false } as unknown as SimulationScheduler,
      {} as SimulationGateway,
      {} as TelemetryService,
      {} as ThingsboardService,
      settings,
    );

    const result = service.startSimulation('user-1', 'sim-2');
    await expect(result).rejects.toThrow(ConflictException);
    await expect(result).rejects.toThrow(
      'Simulation sim-1 is already running on this device',
    );
  });
});
