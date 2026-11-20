import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { DevicesService } from '../devices/devices.service.js';

type AnalyticsQuery = {
  startDate?: string;
  endDate?: string;
};

type DateRange = {
  start: Date;
  end: Date;
};

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly devices: DevicesService,
    private readonly config: ConfigService,
  ) {}

  // Validate dates and prepare the requested date range.
  private getDateRange(
    query: AnalyticsQuery,
    defaultDays: number,
  ): DateRange {
    const end = query.endDate
      ? this.parseDate(query.endDate, 'endDate')
      : new Date();

    const start = query.startDate
      ? this.parseDate(query.startDate, 'startDate')
      : new Date(end.getTime() - defaultDays * 24 * 60 * 60 * 1000);

    if (start >= end) {
      throw new BadRequestException(
        'startDate must be earlier than endDate',
      );
    }

    return { start, end };
  }

  private parseDate(value: string, field: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }

    return date;
  }

  // Fetch telemetry and include the last reading before the start date.
  private async getTelemetry(
    deviceId: string,
    ownerId: string,
    range: DateRange,
  ) {
    await this.devices.findOwnedDevice(deviceId, ownerId);

    const baseline = await this.prisma.telemetry.findFirst({
      where: {
        deviceId,
        timestamp: { lt: range.start },
      },
      orderBy: { timestamp: 'desc' },
    });

    const samples = await this.prisma.telemetry.findMany({
      where: {
        deviceId,
        timestamp: {
          gte: range.start,
          lte: range.end,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    return {
      baseline,
      samples,
    };
  }

  // Calculate the increase in cumulative energy between readings.
  private getEnergyIncrement(previous: number, current: number): number {
    // If the simulation energy counter resets, treat the current
    // reading as consumption since that reset.
    return current >= previous ? current - previous : current;
  }

  // Build energy increments from consecutive cumulative readings.
  private getEnergyIncrements(
    baseline: { energyKwh: number } | null,
    samples: Array<{ timestamp: Date; energyKwh: number }>,
  ) {
    const increments: Array<{
      timestamp: Date;
      energyKwh: number;
    }> = [];

    let previousEnergy = baseline?.energyKwh;

    for (const sample of samples) {
      if (previousEnergy !== undefined) {
        increments.push({
          timestamp: sample.timestamp,
          energyKwh: this.getEnergyIncrement(
            previousEnergy,
            sample.energyKwh,
          ),
        });
      }

      previousEnergy = sample.energyKwh;
    }

    return increments;
  }

  // DAILY ENERGY
  async getDailyEnergy(
    deviceId: string,
    ownerId: string,
    query: AnalyticsQuery,
  ) {
    const range = this.getDateRange(query, 7);
    const { baseline, samples } = await this.getTelemetry(
      deviceId,
      ownerId,
      range,
    );

    const increments = this.getEnergyIncrements(baseline, samples);
    const dailyTotals = new Map<string, number>();

    for (const item of increments) {
      const date = item.timestamp.toISOString().slice(0, 10);

      dailyTotals.set(
        date,
        (dailyTotals.get(date) ?? 0) + item.energyKwh,
      );
    }

    return {
      deviceId,
      unit: 'kWh',
      baselineAvailable: baseline !== null,
      data: Array.from(dailyTotals.entries()).map(
        ([date, energyKwh]) => ({
          date,
          energyKwh: Number(energyKwh.toFixed(6)),
        }),
      ),
    };
  }

  // MONTHLY ENERGY
  async getMonthlyEnergy(
    deviceId: string,
    ownerId: string,
    query: AnalyticsQuery,
  ) {
    const range = this.getDateRange(query, 365);
    const { baseline, samples } = await this.getTelemetry(
      deviceId,
      ownerId,
      range,
    );

    const increments = this.getEnergyIncrements(baseline, samples);
    const monthlyTotals = new Map<string, number>();

    for (const item of increments) {
      const month = item.timestamp.toISOString().slice(0, 7);

      monthlyTotals.set(
        month,
        (monthlyTotals.get(month) ?? 0) + item.energyKwh,
      );
    }

    return {
      deviceId,
      unit: 'kWh',
      baselineAvailable: baseline !== null,
      data: Array.from(monthlyTotals.entries()).map(
        ([month, energyKwh]) => ({
          month,
          energyKwh: Number(energyKwh.toFixed(6)),
        }),
      ),
    };
  }

  // TEMPERATURE ANALYSIS
  async getTemperatureAnalysis(
    deviceId: string,
    ownerId: string,
    query: AnalyticsQuery,
  ) {
    const range = this.getDateRange(query, 1);

    const { samples } = await this.getTelemetry(
      deviceId,
      ownerId,
      range,
    );

    if (samples.length === 0) {
      return {
        deviceId,
        count: 0,
        message: 'No temperature telemetry found for this period',
        data: [],
      };
    }

    const temperatures = samples.map(
      (sample) => sample.roomTemperature,
    );

    const average =
      temperatures.reduce((sum, value) => sum + value, 0) /
      temperatures.length;

    return {
      deviceId,
      count: samples.length,
      unit: '°C',
      statistics: {
        minimum: Math.min(...temperatures),
        maximum: Math.max(...temperatures),
        average: Number(average.toFixed(2)),
        latest: temperatures[temperatures.length - 1],
      },
      data: samples.map((sample) => ({
        timestamp: sample.timestamp,
        roomTemperature: sample.roomTemperature,
        targetTemperature: sample.targetTemperature,
        outsideTemperature: sample.outsideTemperature,
      })),
    };
  }

  // COOLING PERFORMANCE
  async getCoolingPerformance(
    deviceId: string,
    ownerId: string,
    query: AnalyticsQuery,
  ) {
    const range = this.getDateRange(query, 1);

    const { baseline, samples } = await this.getTelemetry(
      deviceId,
      ownerId,
      range,
    );

    const coolingSamples = samples.filter(
      (sample) =>
        sample.compressorState &&
        sample.operatingMode === 'COOL',
    );

    if (coolingSamples.length === 0) {
      return {
        deviceId,
        coolingActive: false,
        message: 'No active cooling data found for this period',
      };
    }

    const first = coolingSamples[0];
    const last = coolingSamples[coolingSamples.length - 1];

    const temperatureReduction =
      first.roomTemperature - last.roomTemperature;

    const durationMinutes =
      (last.timestamp.getTime() - first.timestamp.getTime()) /
      60000;

    const previousSample =
   [...samples]
     .reverse()
     .find(
       (sample) => sample.timestamp < first.timestamp,
     ) ?? baseline;

    const energyConsumed = previousSample
      ? this.getEnergyIncrement(
          previousSample.energyKwh,
          last.energyKwh,
        )
      : null;

    const efficiency =
      energyConsumed !== null && energyConsumed > 0
        ? temperatureReduction / energyConsumed
        : null;

    return {
      deviceId,
      coolingActive: true,
      unit: {
        temperature: '°C',
        energy: 'kWh',
        duration: 'minutes',
        efficiency: '°C/kWh',
      },
      initialTemperature: first.roomTemperature,
      finalTemperature: last.roomTemperature,
      temperatureReduction: Number(
        temperatureReduction.toFixed(2),
      ),
      durationMinutes: Number(durationMinutes.toFixed(2)),
      energyConsumedKwh:
        energyConsumed === null
          ? null
          : Number(energyConsumed.toFixed(6)),
      estimatedCoolingEfficiency:
        efficiency === null
          ? null
          : Number(efficiency.toFixed(3)),
      note: 'Efficiency is temperature reduction per kWh, not the HVAC coefficient of performance (COP).',
    };
  }

  // ELECTRICITY COST
  async getElectricityCost(
    deviceId: string,
    ownerId: string,
    query: AnalyticsQuery,
  ) {
    const range = this.getDateRange(query, 30);

    const { baseline, samples } = await this.getTelemetry(
      deviceId,
      ownerId,
      range,
    );

    const increments = this.getEnergyIncrements(
      baseline,
      samples,
    );

    const energyConsumed = increments.reduce(
      (total, item) => total + item.energyKwh,
      0,
    );

    const rate = Number(
      this.config.get<string>(
        'ELECTRICITY_RATE_NPR_PER_KWH',
        '10',
      ),
    );

    if (!Number.isFinite(rate) || rate < 0) {
      throw new BadRequestException(
        'ELECTRICITY_RATE_NPR_PER_KWH must be a valid non-negative number',
      );
    }

    return {
      deviceId,
      currency: 'NPR',
      energyConsumedKwh: Number(
        energyConsumed.toFixed(6),
      ),
      electricityRatePerKwh: rate,
      estimatedCost: Number(
        (energyConsumed * rate).toFixed(2),
      ),
      baselineAvailable: baseline !== null,
    };
  }
}