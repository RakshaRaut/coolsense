import { Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { SimulationGateway } from '../simulation/simulation.gateway.js';
import { ActivityService } from './activity.service.js';

describe('ActivityService', () => {
  const createdAt = new Date('2026-11-21T12:00:00.000Z');
  const prisma = {
    activity: { create: vi.fn(), findMany: vi.fn() },
    device: { findFirst: vi.fn() },
  };
  const gateway = { publishActivity: vi.fn() } as {
    publishActivity: ReturnType<typeof vi.fn>;
    activities?: unknown;
  };
  const create = () =>
    new ActivityService(
      prisma as unknown as PrismaService,
      gateway as unknown as SimulationGateway,
    );

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('registers itself as the gateway activity recorder', () => {
    const service = create();
    expect(gateway.activities).toBe(service);
  });

  it('persists, then emits the persisted id and timestamp', async () => {
    prisma.activity.create.mockResolvedValue({
      id: 'activity-1',
      userId: 'user-1',
      kind: 'device',
      message: 'Device "Den" removed',
      deviceId: 'device-1',
      deviceName: 'Den',
      createdAt,
    });

    await create().record('user-1', {
      kind: 'device',
      message: 'Device "Den" removed',
      deviceId: 'device-1',
      deviceName: 'Den',
    });

    expect(prisma.device.findFirst).not.toHaveBeenCalled();
    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        kind: 'device',
        message: 'Device "Den" removed',
        deviceId: 'device-1',
        deviceName: 'Den',
      },
    });
    expect(gateway.publishActivity).toHaveBeenCalledWith('user-1', {
      id: 'activity-1',
      kind: 'device',
      message: 'Device "Den" removed',
      deviceId: 'device-1',
      deviceName: 'Den',
      at: createdAt.toISOString(),
    });
    expect(prisma.activity.create.mock.invocationCallOrder[0]).toBeLessThan(
      gateway.publishActivity.mock.invocationCallOrder[0],
    );
  });

  it('looks up a missing device name, scoped to the owner', async () => {
    prisma.device.findFirst.mockResolvedValue({ name: 'Den' });
    prisma.activity.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'activity-2', ...data, createdAt }),
    );

    await create().record('user-1', {
      kind: 'power',
      message: 'AC turned on',
      deviceId: 'device-1',
    });

    expect(prisma.device.findFirst).toHaveBeenCalledWith({
      where: { id: 'device-1', ownerId: 'user-1' },
      select: { name: true },
    });
    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ deviceName: 'Den' }),
    });
    expect(gateway.publishActivity).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ id: 'activity-2', deviceName: 'Den' }),
    );
  });

  it('logs and swallows persistence errors without emitting', async () => {
    prisma.activity.create.mockRejectedValue(new Error('db down'));

    await expect(
      create().record('user-1', { kind: 'sync', message: 'Synced' }),
    ).resolves.toBeUndefined();
    expect(gateway.publishActivity).not.toHaveBeenCalled();
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining('db down'),
    );
  });

  it('lists the user activities newest first, omitting empty device fields', async () => {
    prisma.activity.findMany.mockResolvedValue([
      {
        id: 'activity-1',
        userId: 'user-1',
        kind: 'sync',
        message: 'Synced',
        deviceId: null,
        deviceName: null,
        createdAt,
      },
    ]);

    await expect(create().list('user-1', 20)).resolves.toEqual([
      { id: 'activity-1', kind: 'sync', message: 'Synced', at: createdAt.toISOString() },
    ]);
    expect(prisma.activity.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  });
});
