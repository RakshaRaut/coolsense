import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DevicesService } from '../devices/devices.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TelemetryQueryDto } from './dto/telemetry-query.dto.js';
import { TelemetryService } from './telemetry.service.js';

describe('TelemetryService', () => {
  const sample = {
    id: 'telemetry-1',
    deviceId: 'device-1',
    timestamp: new Date('2026-01-01T00:00:00.000Z'),
    simulationTime: 1,
    roomTemperature: 29,
    targetTemperature: 24,
    outsideTemperature: 35,
    roomHumidity: 55,
    acPower: true,
    compressorState: true,
    fanState: true,
    coolingCapacity: 3.5,
    heatingCapacity: 0,
    powerWatts: 1250,
    energyKwh: 0.0003,
    operatingMode: 'COOL',
    fanSpeed: 'AUTO',
  };
  const devices = { findOwnedDevice: vi.fn() };
  const prisma = {
    telemetry: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };
  let service: TelemetryService;

  beforeEach(() => {
    vi.clearAllMocks();
    devices.findOwnedDevice.mockResolvedValue({ id: 'device-1' });
    prisma.telemetry.findFirst.mockResolvedValue(sample);
    prisma.telemetry.findMany.mockResolvedValue([sample]);
    prisma.telemetry.count.mockResolvedValue(1);
    service = new TelemetryService(
      prisma as unknown as PrismaService,
      devices as unknown as DevicesService,
    );
  });

  it('saves generated simulation telemetry through its active transaction', async () => {
    const create = vi.fn().mockResolvedValue(sample);
    const transaction = {
      telemetry: { create },
    } as unknown as Prisma.TransactionClient;
    const data = { ...sample };

    await expect(
      service.saveGeneratedTelemetry(data, transaction),
    ).resolves.toEqual(sample);

    expect(create).toHaveBeenCalledWith({ data });
    expect(prisma.telemetry.create).not.toHaveBeenCalled();
  });

  it('scopes latest telemetry to an owned device and reports empty records', async () => {
    await expect(service.getLatest('device-1', 'user-1')).resolves.toEqual(sample);
    expect(devices.findOwnedDevice).toHaveBeenCalledWith('device-1', 'user-1');

    prisma.telemetry.findFirst.mockResolvedValueOnce(null);
    await expect(service.getLatest('device-1', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('applies date filters and pagination to owned telemetry history', async () => {
    const query = Object.assign(new TelemetryQueryDto(), {
      page: 2,
      limit: 10,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-01-02T00:00:00.000Z',
    });

    await expect(
      service.getHistory('device-1', 'user-1', query),
    ).resolves.toMatchObject({
      data: [sample],
      pagination: { page: 2, limit: 10, total: 1, pages: 1 },
    });
    expect(prisma.telemetry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: {
          deviceId: 'device-1',
          timestamp: {
            gte: new Date(query.startDate!),
            lte: new Date(query.endDate!),
          },
        },
      }),
    );
  });

  it('rejects inverted date ranges before querying telemetry', async () => {
    const query = Object.assign(new TelemetryQueryDto(), {
      page: 1,
      limit: 100,
      startDate: '2026-01-02T00:00:00.000Z',
      endDate: '2026-01-01T00:00:00.000Z',
    });

    await expect(
      service.getHistory('device-1', 'user-1', query),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.telemetry.findMany).not.toHaveBeenCalled();
  });
});
