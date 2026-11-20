import { Test, TestingModule } from '@nestjs/testing';
import type { Device } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { SimulationGateway } from '../simulation/simulation.gateway.js';
import { SimulationService } from '../simulation/simulation.service.js';
import { SimulationEngineService } from '../simulation/engine/simulation-engine.service.js';
import { TelemetryService } from '../telemetry/telemetry.service.js';
import { AcControlService } from './ac-control.service.js';

describe('AcControlService', () => {
  let service: AcControlService;
  const now = new Date('2026-01-01T00:00:00.000Z');
  const device: Device = {
    id: 'device-1',
    ownerId: 'owner-1',
    name: 'Living room AC',
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
    simulationTime: 0,
    simulationStatus: 'idle',
    simulationStartedAt: null,
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
    thingsboardDeviceId: null,
    createdAt: now,
    updatedAt: now,
  };
  const transaction = {
    device: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
  const prisma = {
    $transaction: vi.fn(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  };
  const simulationService = {
    syncDeviceControl: vi.fn().mockResolvedValue(undefined),
  };
  const telemetryService = {
    saveGeneratedTelemetry: vi.fn().mockResolvedValue({}),
  };
  const gateway = {
    publishAcState: vi.fn(),
    publishCommandStatus: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    transaction.device.findFirst.mockResolvedValue(device);
    transaction.device.update.mockImplementation(
      ({ data }: { data: Partial<Device> }) =>
        Promise.resolve({ ...device, ...data }),
    );
    telemetryService.saveGeneratedTelemetry.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcControlService,
        { provide: PrismaService, useValue: prisma },
        SimulationEngineService,
        { provide: SimulationService, useValue: simulationService },
        { provide: TelemetryService, useValue: telemetryService },
        { provide: SimulationGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get<AcControlService>(AcControlService);
  });

  it('updates control state through the simulation engine and persists the result', async () => {
    const updated = await service.setPower('device-1', 'owner-1', {
      power: true,
    });

    expect(transaction.device.findFirst).toHaveBeenCalledWith({
      where: { id: 'device-1', ownerId: 'owner-1' },
    });
    expect(transaction.device.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'device-1' },
        data: expect.objectContaining({
          acPower: true,
          compressorState: true,
          coolingCapacity: 3.5,
          powerWatts: 1250,
          simulationTime: 1,
        }),
      }),
    );
    expect(updated).toMatchObject({
      acPower: true,
      compressorState: true,
      coolingCapacity: 3.5,
    });
    expect(telemetryService.saveGeneratedTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: device.id,
        acPower: true,
        roomTemperature: expect.any(Number),
      }),
      transaction,
    );
    expect(simulationService.syncDeviceControl).toHaveBeenCalledWith(
      device.id,
      expect.objectContaining({ acPower: true }),
    );
    expect(gateway.publishAcState).toHaveBeenCalledWith(
      'owner-1',
      device.id,
      expect.objectContaining({ acPower: true }),
    );
    expect(gateway.publishCommandStatus).toHaveBeenCalledWith(
      'owner-1',
      device.id,
      true,
      { acPower: true },
    );
  });

  it('does not access a device owned by another user', async () => {
    transaction.device.findFirst.mockResolvedValue(null);

    await expect(
      service.setPower('device-1', 'other-user', { power: true }),
    ).rejects.toThrow('Device not found');
    expect(transaction.device.update).not.toHaveBeenCalled();
  });
});
