import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { ThingsboardService } from './thingsboard.service.js';
import { SimulationGateway } from '../simulation/simulation.gateway.js';

describe('ThingsboardService', () => {
  let service: ThingsboardService;
  const device: {
    id: string;
    ownerId: string;
    name: string;
    acType: string;
    roomVolume: number;
    targetTemperature: number;
    roomTemperature: number;
    outsideTemperature: number;
    roomHumidity: number;
    acPower: boolean;
    compressorState: boolean;
    powerWatts: number;
    energyKwh: number;
    coolingCapacity: number;
    thingsboardDeviceId: string | null;
  } = {
    id: 'device-1',
    ownerId: 'owner-1',
    name: 'Living room',
    acType: 'NON_INVERTER',
    roomVolume: 30,
    targetTemperature: 24,
    roomTemperature: 27,
    outsideTemperature: 35,
    roomHumidity: 50,
    acPower: true,
    compressorState: true,
    powerWatts: 1200,
    energyKwh: 0.02,
    coolingCapacity: 3.5,
    thingsboardDeviceId: null,
  };
  const prisma = {
    device: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };
  const gateway = { publishThingsboardStatus: vi.fn() };

  const token = () =>
    `header.${Buffer.from(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString('base64url')}.signature`;

  beforeEach(async () => {
    vi.resetAllMocks();
    device.thingsboardDeviceId = null;
    const configValues: Record<string, string> = {
      THINGSBOARD_ENABLED: 'true',
      THINGSBOARD_URL: 'http://localhost:18080',
      THINGSBOARD_TENANT_ID: 'tb-tenant-1',
      THINGSBOARD_USER_ID: 'tb-user-1',
      THINGSBOARD_USERNAME: 'tenant@example.com',
      THINGSBOARD_PASSWORD: 'secret',
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThingsboardService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) =>
              configValues[key] ?? fallback,
          },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: SimulationGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get<ThingsboardService>(ThingsboardService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pushes thingsboard:status to the owner only when connection or sync state changes', async () => {
    prisma.device.findMany.mockResolvedValue([]);
    const testConnection = vi
      .spyOn(service, 'testConnection')
      .mockResolvedValue({ success: false, message: 'down', authenticated: false });

    await service.getIntegrationStatus('owner-1');
    await service.getIntegrationStatus('owner-1');
    expect(gateway.publishThingsboardStatus).toHaveBeenCalledOnce();
    expect(gateway.publishThingsboardStatus).toHaveBeenLastCalledWith(
      'owner-1',
      expect.objectContaining({ connected: false, synchronized: false, errors: ['down'] }),
    );

    testConnection.mockResolvedValue({ success: true, message: 'ok', authenticated: true });
    await service.getIntegrationStatus('owner-1');
    expect(gateway.publishThingsboardStatus).toHaveBeenCalledTimes(2);
    expect(gateway.publishThingsboardStatus).toHaveBeenLastCalledWith(
      'owner-1',
      expect.objectContaining({ connected: true, source: 'backend' }),
    );
  });

  it('authenticates, publishes telemetry using ThingsBoard 4.x REST shape, and caches the token', async () => {
    const accessToken = token();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: accessToken }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const telemetry = {
      roomTemperature: 27,
      humidity: 50,
      outsideTemperature: 35,
      targetTemperature: 24,
      acState: true,
      compressorState: true,
      powerConsumption: 1200,
      energyConsumption: 0.02,
    };
    await service.publishTelemetry('tb-device-1', telemetry);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:18080/api/auth/login',
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      'http://localhost:18080/api/plugins/telemetry/DEVICE/tb-device-1/timeseries/ANY',
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toMatchObject(
      {
        values: telemetry,
      },
    );
    expect(
      new Headers(fetchMock.mock.calls[1][1].headers).get('X-Authorization'),
    ).toBe(`Bearer ${accessToken}`);
  });

  it('re-authenticates once when ThingsBoard rejects a cached token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: token() }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: token() }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await service.publishTelemetry('tb-device-1', { acState: true });

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('stores the ThingsBoard ID before saving retryable attributes', async () => {
    prisma.device.findFirst.mockResolvedValue(device);
    prisma.device.update.mockResolvedValue({
      ...device,
      thingsboardDeviceId: 'tb-device-1',
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: token() }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: { id: 'tb-user-1' },
            tenantId: { id: 'tb-tenant-1' },
            authority: 'TENANT_ADMIN',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Not found' }), { status: 404 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: { id: 'tb-device-1' } }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          credentialsType: 'ACCESS_TOKEN',
          credentialsId: 'private-device-token',
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await service.syncDevice('device-1', 'owner-1');
    expect(result).toMatchObject({
      synced: true,
      thingsboardDeviceId: 'tb-device-1',
    });
    expect(result).not.toHaveProperty('accessToken');
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(prisma.device.update).toHaveBeenCalledWith({
      where: { id: 'device-1' },
      data: { thingsboardDeviceId: 'tb-device-1' },
    });
    device.thingsboardDeviceId = 'tb-device-1';
    prisma.device.findFirst.mockResolvedValue(device);
    await expect(
      service.getMqttAccessToken('device-1', 'owner-1'),
    ).resolves.toBe('private-device-token');
  });

  it('syncs owner devices and returns the status contract used by the frontend', async () => {
    const syncedDevice = {
      ...device,
      thingsboardDeviceId: 'tb-device-1',
      telemetry: [
        {
          timestamp: new Date('2026-01-01T00:00:00.000Z'),
          roomTemperature: 27,
          targetTemperature: 24,
          outsideTemperature: 35,
          roomHumidity: 50,
          acPower: true,
          compressorState: true,
          powerWatts: 1200,
          energyKwh: 0.02,
          coolingCapacity: 3.5,
        },
      ],
    };
    prisma.device.findFirst.mockResolvedValue(syncedDevice);
    prisma.device.findMany.mockResolvedValue([syncedDevice]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: token() }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            credentialsType: 'ACCESS_TOKEN',
            credentialsId: 'private-device-token',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: { id: 'tb-user-1' },
            tenantId: { id: 'tb-tenant-1' },
            authority: 'TENANT_ADMIN',
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(service.syncOwnedDevices('owner-1')).resolves.toMatchObject({
      connected: true,
      registered: true,
      synchronized: true,
      deviceKeyMasked: 'priv...en',
      errors: [],
      telemetry: {
        roomTempC: 27,
        humidityPct: 50,
        targetTempC: 24,
        powerW: 1200,
      },
      source: 'backend',
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(JSON.parse(fetchMock.mock.calls[3][1].body as string)).toMatchObject(
      {
        values: {
          roomTemperature: 27,
          humidity: 50,
          powerConsumption: 1200,
        },
      },
    );
  });

  it('keeps rejecting an account that is not THINGSBOARD_USER_ID on later calls', async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith('/api/auth/login')
          ? new Response(JSON.stringify({ token: token() }), { status: 200 })
          : new Response(
              JSON.stringify({
                id: { id: 'someone-else' },
                tenantId: { id: 'tb-tenant-1' },
                authority: 'TENANT_ADMIN',
              }),
              { status: 200 },
            ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    for (let call = 0; call < 2; call++) {
      await expect(service.testConnection()).resolves.toMatchObject({
        success: false,
        authorized: false,
        message: expect.stringContaining('THINGSBOARD_USER_ID'),
      });
    }
    expect(service.getStatus()).toMatchObject({ authorized: false });
  });

  it('reports authenticated but unauthorized when the account cannot create tenant devices', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: token() }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: { id: 'tb-user-1' },
            tenantId: { id: 'tb-tenant-1' },
            authority: 'SYS_ADMIN',
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(service.testConnection()).resolves.toMatchObject({
      success: false,
      authenticated: true,
      authorized: false,
      message: expect.stringContaining('tenant administrator'),
    });
    expect(service.getStatus()).toMatchObject({
      enabled: true,
      configured: true,
      authenticated: true,
      authorized: false,
    });
  });
});
