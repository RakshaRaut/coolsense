import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DevicesService } from '../devices/devices.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { TelemetryQueryDto } from './dto/telemetry-query.dto.js';

@Injectable()
export class TelemetryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly devices: DevicesService,
  ) {}

  saveGeneratedTelemetry(
    data: Prisma.TelemetryUncheckedCreateInput,
    transaction?: Prisma.TransactionClient,
  ) {
    if (transaction) {
      return transaction.telemetry.create({ data });
    }
    return this.prisma.telemetry.create({ data });
  }

  async getLatest(deviceId: string, ownerId: string) {
    await this.devices.findOwnedDevice(deviceId, ownerId);
    const telemetry = await this.prisma.telemetry.findFirst({
      where: { deviceId },
      orderBy: { timestamp: 'desc' },
    });

    if (!telemetry) {
      throw new NotFoundException('Telemetry not found');
    }
    return telemetry;
  }

  async getHistory(
    deviceId: string,
    ownerId: string,
    query: TelemetryQueryDto,
  ) {
    return this.getPaginatedTelemetry(deviceId, ownerId, query);
  }

  async getTemperatureHistory(
    deviceId: string,
    ownerId: string,
    query: TelemetryQueryDto,
  ) {
    const result = await this.getPaginatedTelemetry(deviceId, ownerId, query);
    return {
      ...result,
      data: result.data.map((sample) => ({
        id: sample.id,
        deviceId: sample.deviceId,
        timestamp: sample.timestamp,
        simulationTime: sample.simulationTime,
        roomTemperature: sample.roomTemperature,
        targetTemperature: sample.targetTemperature,
        outsideTemperature: sample.outsideTemperature,
        roomHumidity: sample.roomHumidity,
      })),
    };
  }

  async getEnergyHistory(
    deviceId: string,
    ownerId: string,
    query: TelemetryQueryDto,
  ) {
    const result = await this.getPaginatedTelemetry(deviceId, ownerId, query);
    return {
      ...result,
      data: result.data.map((sample) => ({
        id: sample.id,
        deviceId: sample.deviceId,
        timestamp: sample.timestamp,
        simulationTime: sample.simulationTime,
        powerWatts: sample.powerWatts,
        energyKwh: sample.energyKwh,
      })),
    };
  }

  private async getPaginatedTelemetry(
    deviceId: string,
    ownerId: string,
    query: TelemetryQueryDto,
  ) {
    await this.devices.findOwnedDevice(deviceId, ownerId);

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;
    if (startDate && endDate && startDate > endDate) {
      throw new BadRequestException(
        'startDate must be before or equal to endDate',
      );
    }

    const timestamp =
      startDate || endDate
        ? {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          }
        : undefined;
    const where: Prisma.TelemetryWhereInput = {
      deviceId,
      ...(timestamp ? { timestamp } : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.telemetry.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: query.limit,
      }),
      this.prisma.telemetry.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }
}