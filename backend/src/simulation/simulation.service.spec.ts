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
