import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDeviceDto } from './dto/create-device.dto.js';
import { UpdateDeviceDto } from './dto/update-device.dto.js';
import {
  DeviceHistoryQueryDto,
  TelemetryQueryDto,
} from './dto/telemetry-query.dto.js';
import { ThingsboardService } from '../thingsboard/thingsboard.service.js';
import { SimulationGateway } from '../simulation/simulation.gateway.js';
import { ActivityService } from '../activity/activity.service.js';

@Injectable()
export class DevicesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DevicesService.name);
  private readonly thingsboardRetries = new Map<string, NodeJS.Timeout>();
  private readonly maxThingsboardRetries = 3;
  private syncScan?: NodeJS.Timeout;
  private syncScanInProgress = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly thingsboard: ThingsboardService,
    private readonly gateway: SimulationGateway,
    private readonly activities: ActivityService,
  ) {}

  onModuleInit(): void {
    if (!this.thingsboard.isEnabled()) {
      return;
    }

    void this.syncUnlinkedDevices();
    this.syncScan = setInterval(() => {
      void this.syncUnlinkedDevices();
    }, 30_000);
    this.syncScan.unref();
  }

  onModuleDestroy(): void {
    if (this.syncScan) {
      clearInterval(this.syncScan);
    }
    for (const timer of this.thingsboardRetries.values()) {
      clearTimeout(timer);
    }
    this.thingsboardRetries.clear();
  }

  async create(ownerId: string, input: CreateDeviceDto) {
    const name = input.name.trim();
    const existing = await this.prisma.device.findFirst({
      where: { ownerId, name },
    });
    if (existing) {
      throw new ConflictException('A device with this name already exists');
    }

    const device = await this.prisma.device.create({
      data: {
        ownerId,
        ...input,
        name,
        acType: input.acType ?? 'NON_INVERTER',
        ...(input.initialRoomTemperature !== undefined
          ? { roomTemperature: input.initialRoomTemperature }
          : {}),
      },
    });
    this.gateway.publishDeviceUpdated(ownerId, device);
    void this.activities.record(ownerId, {
      kind: 'device',
      message: `Device "${device.name}" registered`,
      deviceId: device.id,
      deviceName: device.name,
    });

    if (!this.thingsboard.isEnabled()) {
      return device;
    }

    try {
      const syncResult = await this.thingsboard.syncDevice(device.id, ownerId);
      this.clearThingsboardRetry(device.id);
      return {
        ...device,
        thingsboardDeviceId: syncResult.thingsboardDeviceId,
      };
    } catch (error) {
      this.logger.error(
        `ThingsBoard device synchronization failed for ${device.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      this.scheduleThingsboardRetry(device.id, ownerId, 1);
      return device;
    }
  }

  private scheduleThingsboardRetry(
    deviceId: string,
    ownerId: string,
    attempt: number,
  ): void {
    if (
      attempt > this.maxThingsboardRetries ||
      this.thingsboardRetries.has(deviceId)
    ) {
      return;
    }

    const timer = setTimeout(
      () => {
        this.thingsboardRetries.delete(deviceId);
        void this.thingsboard
          .syncDevice(deviceId, ownerId)
          .then(() => {
            this.logger.log(
              `ThingsBoard synchronization recovered for ${deviceId}`,
            );
          })
          .catch((error: unknown) => {
            this.logger.error(
              `ThingsBoard retry ${attempt} failed for ${deviceId}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
            this.scheduleThingsboardRetry(deviceId, ownerId, attempt + 1);
          });
      },
      1000 * 2 ** (attempt - 1),
    );
    timer.unref();
    this.thingsboardRetries.set(deviceId, timer);
  }

  private clearThingsboardRetry(deviceId: string): void {
    const timer = this.thingsboardRetries.get(deviceId);
    if (timer) {
      clearTimeout(timer);
      this.thingsboardRetries.delete(deviceId);
    }
  }

  private async syncUnlinkedDevices(): Promise<void> {
    if (!this.thingsboard.isEnabled() || this.syncScanInProgress) {
      return;
    }

    this.syncScanInProgress = true;
    try {
      const devices = await this.prisma.device.findMany({
        where: { thingsboardDeviceId: null },
        select: { id: true, ownerId: true },
      });

      await Promise.all(
        devices.map(async ({ id, ownerId }) => {
          try {
            await this.thingsboard.syncDevice(id, ownerId);
            this.clearThingsboardRetry(id);
          } catch (error) {
            this.logger.error(
              `ThingsBoard device synchronization failed for ${id}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
            this.scheduleThingsboardRetry(id, ownerId, 1);
          }
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes('P1001') ||
        message.includes("Can't reach database server")
      ) {
        this.logger.warn(
          'ThingsBoard pending-device scan deferred because the database is temporarily unavailable',
        );
      } else {
        this.logger.error(`ThingsBoard pending-device scan failed: ${message}`);
      }
    } finally {
      this.syncScanInProgress = false;
    }
  }

  findAllForUser(ownerId: string) {
    return this.prisma.device.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteOwnedDevice(deviceId: string, ownerId: string): Promise<void> {
    const device = await this.findOwnedDevice(deviceId, ownerId);
    const result = await this.prisma.device.deleteMany({
      where: { id: deviceId, ownerId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Device not found');
    }
    this.clearThingsboardRetry(deviceId);
    this.gateway.publishDeviceDeleted(ownerId, deviceId);
    void this.activities.record(ownerId, {
      kind: 'device',
      message: `Device "${device.name}" removed`,
      deviceId: device.id,
      deviceName: device.name,
    });
  }

  async updateOwnedDevice(
    deviceId: string,
    ownerId: string,
    input: UpdateDeviceDto,
  ) {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException(
        'At least one device field must be provided',
      );
    }

    await this.findOwnedDevice(deviceId, ownerId);

    const updated = await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        ...input,
        ...(input.initialRoomTemperature !== undefined
          ? { roomTemperature: input.initialRoomTemperature }
          : {}),
      },
    });
    this.gateway.publishDeviceUpdated(ownerId, updated);
    void this.activities.record(ownerId, {
      kind: 'device',
      message: `Configuration updated for "${updated.name}"`,
      deviceId: updated.id,
      deviceName: updated.name,
    });

    if (!this.thingsboard.isEnabled()) {
      return updated;
    }

    try {
      await this.thingsboard.syncDevice(deviceId, ownerId);
      this.clearThingsboardRetry(deviceId);
      return updated;
    } catch (error) {
      this.logger.error(
        `ThingsBoard device synchronization failed for ${deviceId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      this.scheduleThingsboardRetry(deviceId, ownerId, 1);
      return updated;
    }
  }

  async findOwnedDevice(deviceId: string, ownerId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, ownerId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    return device;
  }

  async getState(deviceId: string, ownerId: string) {
    const device = await this.findOwnedDevice(deviceId, ownerId);

    return {
      id: device.id,
      power: device.acPower,
      targetTemperature: device.targetTemperature,
      roomTemperature: device.roomTemperature,
      outsideTemperature: device.outsideTemperature,
      mode: device.operatingMode,
      fanSpeed: device.fanSpeed,
      compressorState: device.compressorState,
      fanState: device.fanState,
      coolingCapacity: device.coolingCapacity,
      heatingCapacity: device.heatingCapacity,
      powerWatts: device.powerWatts,
      energyKwh: device.energyKwh,
      simulationTime: device.simulationTime,
      updatedAt: device.updatedAt,
    };
  }

  async getTelemetry(
    deviceId: string,
    ownerId: string,
    query: TelemetryQueryDto,
  ) {
    await this.findOwnedDevice(deviceId, ownerId);

    return this.prisma.telemetry.findMany({
      where: {
        deviceId,
        ...(query.since ? { timestamp: { gte: new Date(query.since) } } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: query.limit,
    });
  }

  async getHistory(
    deviceId: string,
    ownerId: string,
    query: DeviceHistoryQueryDto,
  ) {
    await this.findOwnedDevice(deviceId, ownerId);

    const samples = await this.prisma.telemetry.findMany({
      where: {
        deviceId,
        timestamp: { gte: new Date(Date.now() - query.range * 1000) },
      },
      orderBy: { timestamp: 'desc' },
      take: query.limit,
    });

    return samples.reverse().map((sample) => ({
      t: sample.simulationTime,
      elapsedSec: sample.simulationTime,
      time: sample.timestamp.toISOString(),
      roomTempC: sample.roomTemperature,
      targetTempC: sample.targetTemperature,
      outsideTempC: sample.outsideTemperature,
      humidityPct: sample.roomHumidity,
      powerW: sample.powerWatts,
      energyKwh: sample.energyKwh,
      compressorOn: sample.compressorState,
      compressorModulation: sample.compressorState ? 100 : 0,
      coolingKw: sample.coolingCapacity,
    }));
  }
}
