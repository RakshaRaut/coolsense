import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  RETENTION_BATCH_SIZE,
  TelemetryRetentionService,
} from './telemetry-retention.service.js';

describe('TelemetryRetentionService', () => {
  const now = new Date('2026-11-21T12:00:00.000Z');
  const prisma = { $executeRaw: vi.fn() };
  const config = (value?: string) =>
    ({
      get: (_key: string, fallback: string) => value ?? fallback,
    }) as unknown as ConfigService;
  const create = (value?: string) =>
    new TelemetryRetentionService(
      prisma as unknown as PrismaService,
      config(value),
    );
  const sqlOf = (call: unknown[]) => (call[0] as string[]).join('?');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to 365 days and rejects non-integer or values below 1', () => {
    expect(() => create()).not.toThrow();
    for (const bad of ['0', '-5', '1.5', 'abc', '']) {
      expect(() => create(bad)).toThrow(
        'TELEMETRY_RETENTION_DAYS must be an integer of at least 1',
      );
    }
  });

  it('computes the cutoff as now minus the retention days and binds it as a parameter', async () => {
    prisma.$executeRaw.mockResolvedValue(0);

    await create('30').run(now);

    const cutoff = new Date('2026-10-22T12:00:00.000Z');
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
    expect(sqlOf(prisma.$executeRaw.mock.calls[2])).toContain('"Activity" WHERE "createdAt" <');
    for (const call of prisma.$executeRaw.mock.calls) {
      expect(call.slice(1)).toEqual([cutoff, RETENTION_BATCH_SIZE]);
    }
  });

  it('deletes in batches until a batch is smaller than the limit: telemetry, snapshots, then activities', async () => {
    prisma.$executeRaw
      .mockResolvedValueOnce(RETENTION_BATCH_SIZE)
      .mockResolvedValueOnce(RETENTION_BATCH_SIZE)
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(RETENTION_BATCH_SIZE)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(RETENTION_BATCH_SIZE)
      .mockResolvedValueOnce(7);

    const result = await create().run(now);

    expect(result).toEqual({
      telemetry: 2 * RETENTION_BATCH_SIZE + 12,
      snapshots: RETENTION_BATCH_SIZE,
      activities: RETENTION_BATCH_SIZE + 7,
    });
    const tables = prisma.$executeRaw.mock.calls.map((call) =>
      sqlOf(call).includes('"Telemetry"')
        ? 'telemetry'
        : sqlOf(call).includes('"SimulationSnapshot"')
          ? 'snapshot'
          : 'activity',
    );
    expect(tables).toEqual([
      'telemetry',
      'telemetry',
      'telemetry',
      'snapshot',
      'snapshot',
      'activity',
      'activity',
    ]);
  });

  it('skips a run while another is in progress', async () => {
    let release!: (count: number) => void;
    prisma.$executeRaw
      .mockReturnValueOnce(new Promise<number>((resolve) => (release = resolve)))
      .mockResolvedValue(0);
    const service = create();

    const first = service.run(now);
    await expect(service.run(now)).resolves.toBeNull();
    release(0);

    await expect(first).resolves.toEqual({ telemetry: 0, snapshots: 0, activities: 0 });
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
  });

  it('logs and swallows database errors', async () => {
    prisma.$executeRaw.mockRejectedValue(new Error('db down'));

    await expect(create().run(now)).resolves.toBeNull();
  });
});
