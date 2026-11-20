import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 60_000;
const RUN_INTERVAL_MS = 60 * 60 * 1000;
export const RETENTION_BATCH_SIZE = 5000;

@Injectable()
export class TelemetryRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemetryRetentionService.name);
  private readonly retentionDays: number;
  private startupTimer?: NodeJS.Timeout;
  private intervalTimer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.retentionDays = Number(
      config.get<string>('TELEMETRY_RETENTION_DAYS', '365'),
    );
    if (!Number.isInteger(this.retentionDays) || this.retentionDays < 1) {
      throw new Error('TELEMETRY_RETENTION_DAYS must be an integer of at least 1');
    }
  }

  onModuleInit(): void {
    this.startupTimer = setTimeout(() => void this.run(), STARTUP_DELAY_MS);
    this.startupTimer.unref();
    this.intervalTimer = setInterval(() => void this.run(), RUN_INTERVAL_MS);
    this.intervalTimer.unref();
  }

  onModuleDestroy(): void {
    clearTimeout(this.startupTimer);
    clearInterval(this.intervalTimer);
  }

  /** Returns null when a previous run is still in progress or the run failed. */
  async run(now = new Date()): Promise<{ telemetry: number; snapshots: number } | null> {
    if (this.running) {
      return null;
    }
    this.running = true;
    try {
      const cutoff = new Date(now.getTime() - this.retentionDays * DAY_MS);
      // Each batch is its own statement, so no single lock or transaction grows with the backlog.
      const telemetry = await this.deleteInBatches(
        () => this.prisma.$executeRaw`
          DELETE FROM "Telemetry" WHERE ctid IN (
            SELECT ctid FROM "Telemetry" WHERE "timestamp" < ${cutoff} LIMIT ${RETENTION_BATCH_SIZE}
          )`,
      );
      const snapshots = await this.deleteInBatches(
        () => this.prisma.$executeRaw`
          DELETE FROM "SimulationSnapshot" WHERE ctid IN (
            SELECT ctid FROM "SimulationSnapshot" WHERE "timestamp" < ${cutoff} LIMIT ${RETENTION_BATCH_SIZE}
          )`,
      );
      if (telemetry > 0 || snapshots > 0) {
        this.logger.log(
          `Retention removed ${telemetry} telemetry and ${snapshots} snapshot rows older than ${cutoff.toISOString()}`,
        );
      }
      return { telemetry, snapshots };
    } catch (error) {
      this.logger.error(
        `Retention run failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    } finally {
      this.running = false;
    }
  }

  private async deleteInBatches(deleteBatch: () => Promise<number>): Promise<number> {
    let total = 0;
    let deleted: number;
    do {
      deleted = await deleteBatch();
      total += deleted;
    } while (deleted >= RETENTION_BATCH_SIZE);
    return total;
  }
}
