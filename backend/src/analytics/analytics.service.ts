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

  // Calculate the increase in cumulative energy between readings.
  private getEnergyIncrement(previous: number, current: number): number {
    // If the simulation energy counter resets, treat the current
    // reading as consumption since that reset.
    return current >= previous ? current - previous : current;
  }

  // Sum energy increments per period in Postgres. The last reading before
  // the range is the baseline for the first sample. A null format gives
  // one period covering the whole range.
  private async getEnergyTotals(
    deviceId: string,
    ownerId: string,
    range: DateRange,
    format: 'YYYY-MM-DD' | 'YYYY-MM' | null,
  ) {
    await this.devices.findOwnedDevice(deviceId, ownerId);

    const baseline = await this.prisma.telemetry.findFirst({
      where: {
        deviceId,
        timestamp: { lt: range.start },
      },
      orderBy: { timestamp: 'desc' },
      select: { energyKwh: true },
    });

    // Same reset rule as getEnergyIncrement; SUM ... ORDER BY keeps the
    // float addition order of the previous in-memory loop.
    const totals = await this.prisma.$queryRaw<
      Array<{ period: string | null; energyKwh: number }>
    >`
      SELECT to_char("timestamp", ${format}::text) AS period,
             SUM(
               CASE WHEN "energyKwh" >= previous
                 THEN "energyKwh" - previous
                 ELSE "energyKwh"
               END
               ORDER BY "timestamp"
             ) AS "energyKwh"
      FROM (
        SELECT "timestamp",
               "energyKwh",
               LAG("energyKwh", 1, ${baseline?.energyKwh ?? null}::double precision)
                 OVER (ORDER BY "timestamp") AS previous
        FROM "Telemetry"
        WHERE "deviceId" = ${deviceId}
          AND "timestamp" >= ${range.start}
          AND "timestamp" <= ${range.end}
      ) samples
      WHERE previous IS NOT NULL
      GROUP BY period
      ORDER BY period
    `;

    return { baselineAvailable: baseline !== null, totals };
  }

  // DAILY ENERGY
  async getDailyEnergy(
    deviceId: string,
    ownerId: string,
    query: AnalyticsQuery,
  ) {
    const range = this.getDateRange(query, 7);
    const { baselineAvailable, totals } = await this.getEnergyTotals(
      deviceId,
      ownerId,
      range,
      'YYYY-MM-DD',
    );

    return {
      deviceId,
      unit: 'kWh',
      baselineAvailable,
      data: totals.map(({ period, energyKwh }) => ({
        date: period,
        energyKwh: Number(energyKwh.toFixed(6)),
      })),
    };
  }

  // MONTHLY ENERGY
  async getMonthlyEnergy(
    deviceId: string,
    ownerId: string,
    query: AnalyticsQuery,
  ) {
    const range = this.getDateRange(query, 365);
    const { baselineAvailable, totals } = await this.getEnergyTotals(
      deviceId,
      ownerId,
      range,
      'YYYY-MM',
    );

    return {
      deviceId,
      unit: 'kWh',
      baselineAvailable,
      data: totals.map(({ period, energyKwh }) => ({
        month: period,
        energyKwh: Number(energyKwh.toFixed(6)),
      })),
    };
  }

  // TEMPERATURE ANALYSIS
  async getTemperatureAnalysis(
    deviceId: string,
    ownerId: string,
    query: AnalyticsQuery,
  ) {
    const range = this.getDateRange(query, 1);

    await this.devices.findOwnedDevice(deviceId, ownerId);

    const where = {
      deviceId,
      timestamp: {
        gte: range.start,
        lte: range.end,
      },
    };

    // The response lists every sample, so load only the columns it returns.
    const samples = await this.prisma.telemetry.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        roomTemperature: true,
        targetTemperature: true,
        outsideTemperature: true,
      },
    });

    if (samples.length === 0) {
      return {
        deviceId,
        count: 0,
        message: 'No temperature telemetry found for this period',
        data: [],
      };
    }

    const [statistics] = await this.prisma.$queryRaw<
      Array<{ minimum: number; maximum: number; total: number; count: number }>
    >`
      SELECT MIN("roomTemperature") AS minimum,
             MAX("roomTemperature") AS maximum,
             SUM("roomTemperature" ORDER BY "timestamp") AS total,
             COUNT(*)::int AS count
      FROM "Telemetry"
      WHERE "deviceId" = ${deviceId}
        AND "timestamp" >= ${range.start}
        AND "timestamp" <= ${range.end}
    `;

    const average = statistics.total / statistics.count;

    return {
      deviceId,
      count: samples.length,
      unit: '°C',
      statistics: {
        minimum: statistics.minimum,
        maximum: statistics.maximum,
        average: Number(average.toFixed(2)),
        latest: samples[samples.length - 1].roomTemperature,
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

    await this.devices.findOwnedDevice(deviceId, ownerId);

    const cooling = {
      deviceId,
      timestamp: {
        gte: range.start,
        lte: range.end,
      },
      compressorState: true,
      operatingMode: 'COOL',
    };

    const [first, last] = await Promise.all([
      this.prisma.telemetry.findFirst({
        where: cooling,
        orderBy: { timestamp: 'asc' },
      }),
      this.prisma.telemetry.findFirst({
        where: cooling,
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    if (!first || !last) {
      return {
        deviceId,
        coolingActive: false,
        message: 'No active cooling data found for this period',
      };
    }

    const temperatureReduction =
      first.roomTemperature - last.roomTemperature;

    const durationMinutes =
      (last.timestamp.getTime() - first.timestamp.getTime()) /
      60000;

    // Last reading before cooling started, inside or before the range.
    const previousSample = await this.prisma.telemetry.findFirst({
      where: {
        deviceId,
        timestamp: { lt: first.timestamp },
      },
      orderBy: { timestamp: 'desc' },
      select: { energyKwh: true },
    });

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

    const { baselineAvailable, totals } = await this.getEnergyTotals(
      deviceId,
      ownerId,
      range,
      null,
    );

    const energyConsumed = totals[0]?.energyKwh ?? 0;

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
      baselineAvailable,
    };
  }
}
