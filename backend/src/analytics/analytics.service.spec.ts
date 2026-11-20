import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AnalyticsService } from './analytics.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DevicesService } from '../devices/devices.service.js';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: {
    $queryRaw: ReturnType<typeof vi.fn>;
    telemetry: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      $queryRaw: vi.fn(),
      telemetry: { findFirst: vi.fn(), findMany: vi.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: DevicesService,
          useValue: { findOwnedDevice: vi.fn().mockResolvedValue({}) },
        },
        { provide: ConfigService, useValue: new ConfigService() },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTemperatureAnalysis', () => {
    const query = {
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-01-03T00:00:00.000Z',
    };
    const stats = (count: number) => [
      { minimum: 20, maximum: 30, total: 25 * count, count },
    ];

    it('returns raw samples when the range has at most 500 rows', async () => {
      const raw = [
        {
          timestamp: new Date('2026-01-01T00:00:05.000Z'),
          roomTemperature: 25,
          targetTemperature: 24,
          outsideTemperature: 35,
        },
      ];
      prisma.$queryRaw.mockResolvedValueOnce(stats(500));
      prisma.telemetry.findFirst.mockResolvedValue({ roomTemperature: 25 });
      prisma.telemetry.findMany.mockResolvedValue(raw);

      const result = await service.getTemperatureAnalysis('d1', 'u1', query);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result.count).toBe(500);
      expect(result.data).toEqual(raw);
    });

    it('averages into at most 500 date_bin buckets when the range has more rows', async () => {
      const buckets = [
        {
          timestamp: new Date('2026-01-01T00:00:00.000Z'),
          roomTemperature: 26.5,
          targetTemperature: 24,
          outsideTemperature: 34.25,
        },
      ];
      prisma.$queryRaw
        .mockResolvedValueOnce(stats(20000))
        .mockResolvedValueOnce(buckets);
      prisma.telemetry.findFirst.mockResolvedValue({ roomTemperature: 22.5 });

      const result = await service.getTemperatureAnalysis('d1', 'u1', query);

      expect(prisma.telemetry.findMany).not.toHaveBeenCalled();
      const [strings, stride, , deviceId] = prisma.$queryRaw.mock.calls[1];
      expect(strings.join('?')).toContain('date_bin(');
      // 2 days / 500 points = 345600 ms, +1 ms so range.end stays in bucket 499.
      expect(stride).toBe(345.601);
      expect(deviceId).toBe('d1');
      expect(result).toEqual({
        deviceId: 'd1',
        count: 20000,
        unit: '°C',
        statistics: { minimum: 20, maximum: 30, average: 25, latest: 22.5 },
        data: buckets,
      });
    });
  });
});
