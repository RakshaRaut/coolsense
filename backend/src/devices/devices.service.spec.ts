import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { DevicesService } from './devices.service.js';
import { ThingsboardService } from '../thingsboard/thingsboard.service.js';
import { SimulationGateway } from '../simulation/simulation.gateway.js';

describe('DevicesService', () => {
  let service: DevicesService;
  const prisma = {
    device: {
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  };
  const thingsboard = {
    isEnabled: vi.fn(),
    syncDevice: vi.fn(),
  };
  const gateway = {
    publishDeviceUpdated: vi.fn(),
    publishDeviceDeleted: vi.fn(),
    publishActivity: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    thingsboard.isEnabled.mockReturnValue(false);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ThingsboardService, useValue: thingsboard },
        { provide: SimulationGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get<DevicesService>(DevicesService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a device bound to its owner', async () => {
    const device = { id: 'device-1', ownerId: 'user-1', name: 'Living room' };
    prisma.device.create.mockResolvedValue(device);

    await expect(
      service.create('user-1', { name: 'Living room' }),
    ).resolves.toEqual(device);
    expect(prisma.device.create).toHaveBeenCalledWith({
      data: {
        ownerId: 'user-1',
        name: 'Living room',
        acType: 'NON_INVERTER',
      },
    });
  });

  it('persists device configuration and initializes the room temperature', async () => {
    prisma.device.create.mockResolvedValue({});

    await service.create('user-1', {
      name: 'Living room',
      initialRoomTemperature: 26,
      roomVolume: 55,
      roomHumidity: 45,
    });

    expect(prisma.device.create).toHaveBeenCalledWith({
      data: {
        ownerId: 'user-1',
        name: 'Living room',
        acType: 'NON_INVERTER',
        initialRoomTemperature: 26,
        roomVolume: 55,
        roomHumidity: 45,
        roomTemperature: 26,
      },
    });
  });

  it('synchronizes a newly persisted device when ThingsBoard is enabled', async () => {
    const device = {
      id: 'device-1',
      ownerId: 'user-1',
      name: 'Living room',
      thingsboardDeviceId: null,
    };
    thingsboard.isEnabled.mockReturnValue(true);
    thingsboard.syncDevice.mockResolvedValue({
      enabled: true,
      synced: true,
      deviceId: 'device-1',
      thingsboardDeviceId: 'tb-device-1',
    });
    prisma.device.create.mockResolvedValue(device);

    await expect(
      service.create('user-1', { name: 'Living room' }),
    ).resolves.toMatchObject({ thingsboardDeviceId: 'tb-device-1' });
    expect(thingsboard.syncDevice).toHaveBeenCalledWith('device-1', 'user-1');
  });

  it('synchronizes configuration updates without failing the local update', async () => {
    const device = {
      id: 'device-1',
      ownerId: 'user-1',
      name: 'Living room',
    };
    const updated = { ...device, targetTemperature: 22 };
    prisma.device.findFirst.mockResolvedValue(device);
    prisma.device.update.mockResolvedValue(updated);
    thingsboard.isEnabled.mockReturnValue(true);
    thingsboard.syncDevice.mockResolvedValue({
      enabled: true,
      synced: true,
      deviceId: 'device-1',
      thingsboardDeviceId: 'tb-device-1',
    });

    await expect(
      service.updateOwnedDevice('device-1', 'user-1', {
        targetTemperature: 22,
      }),
    ).resolves.toMatchObject({ targetTemperature: 22 });
    expect(thingsboard.syncDevice).toHaveBeenCalledWith('device-1', 'user-1');
  });

  it('reconciles devices left unsynchronized when ThingsBoard was unavailable', async () => {
    prisma.device.findMany.mockResolvedValue([
      { id: 'device-1', ownerId: 'user-1' },
    ]);
    thingsboard.isEnabled.mockReturnValue(true);
    thingsboard.syncDevice.mockResolvedValue({
      enabled: true,
      synced: true,
      deviceId: 'device-1',
      thingsboardDeviceId: 'tb-device-1',
    });

    service.onModuleInit();
    await vi.waitFor(() => {
      expect(thingsboard.syncDevice).toHaveBeenCalledWith(
        'device-1',
        'user-1',
      );
    });
    service.onModuleDestroy();
  });

  it('keeps local creation successful and retries a failed ThingsBoard sync', async () => {
    vi.useFakeTimers();
    const device = {
      id: 'device-1',
      ownerId: 'user-1',
      name: 'Living room',
      thingsboardDeviceId: null,
    };
    thingsboard.isEnabled.mockReturnValue(true);
    thingsboard.syncDevice.mockRejectedValueOnce(new Error('offline'));
    prisma.device.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(device);
    prisma.device.create.mockResolvedValue(device);

    await expect(
      service.create('user-1', { name: 'Living room' }),
    ).resolves.toEqual(device);
    expect(prisma.device.create).toHaveBeenCalledOnce();

    thingsboard.syncDevice.mockResolvedValue({
      enabled: true,
      synced: true,
      deviceId: 'device-1',
      thingsboardDeviceId: 'tb-device-1',
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(thingsboard.syncDevice).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('pushes device:updated and an activity to the owner on create and update', async () => {
    const device = { id: 'device-1', ownerId: 'user-1', name: 'Living room' };
    const updated = { ...device, targetTemperature: 22 };
    prisma.device.create.mockResolvedValue(device);
    prisma.device.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(device);
    prisma.device.update.mockResolvedValue(updated);

    await service.create('user-1', { name: 'Living room' });
    await service.updateOwnedDevice('device-1', 'user-1', {
      targetTemperature: 22,
    });

    expect(gateway.publishDeviceUpdated).toHaveBeenNthCalledWith(1, 'user-1', device);
    expect(gateway.publishDeviceUpdated).toHaveBeenNthCalledWith(2, 'user-1', updated);
    expect(gateway.publishActivity).toHaveBeenNthCalledWith(
      1,
      'user-1',
      'device',
      'Device "Living room" registered',
      device,
    );
    expect(gateway.publishActivity).toHaveBeenNthCalledWith(
      2,
      'user-1',
      'device',
      'Configuration updated for "Living room"',
      updated,
    );
  });

  it('pushes device:deleted and an activity only after an owned delete', async () => {
    const device = { id: 'device-1', ownerId: 'user-1', name: 'Living room' };
    prisma.device.findFirst.mockResolvedValueOnce(device);
    prisma.device.deleteMany.mockResolvedValueOnce({ count: 1 });

    await service.deleteOwnedDevice('device-1', 'user-1');

    expect(gateway.publishDeviceDeleted).toHaveBeenCalledWith('user-1', 'device-1');
    expect(gateway.publishActivity).toHaveBeenCalledWith(
      'user-1',
      'device',
      'Device "Living room" removed',
      device,
    );

    prisma.device.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.deleteOwnedDevice('device-2', 'user-1'),
    ).rejects.toThrow('Device not found');
    expect(gateway.publishDeviceDeleted).toHaveBeenCalledOnce();
  });

  it('returns not found when the device is not owned by the user', async () => {
    prisma.device.findFirst.mockResolvedValue(null);

    await expect(service.findOwnedDevice('device-1', 'user-1')).rejects.toThrow(
      'Device not found',
    );
    expect(prisma.device.findFirst).toHaveBeenCalledWith({
      where: { id: 'device-1', ownerId: 'user-1' },
    });
  });
});
