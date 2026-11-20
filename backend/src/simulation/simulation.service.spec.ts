import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { TelemetryService } from '../telemetry/telemetry.service.js';
import type { ThingsboardService } from '../thingsboard/thingsboard.service.js';
import type { SimulationGateway } from './simulation.gateway.js';
import type { SimulationScheduler } from './simulation.scheduler.js';
import { SimulationService } from './simulation.service.js';

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
