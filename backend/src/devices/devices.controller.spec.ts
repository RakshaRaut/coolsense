import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { DevicesController } from './devices.controller.js';
import { DevicesService } from './devices.service.js';

const deviceId = 'c0a80123-4567-489a-9abc-123456789abc';

describe('DevicesController', () => {
  let controller: DevicesController;
  const devicesService = {
    create: vi.fn(),
    findAllForUser: vi.fn(),
    getState: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DevicesController],
      providers: [{ provide: DevicesService, useValue: devicesService }],
    }).compile();

    controller = module.get<DevicesController>(DevicesController);
  });

  it('creates a device for the authenticated owner', async () => {
    const input = { name: 'Living room AC' };
    const device = { id: 'device-1', ...input, ownerId: 'user-1' };
    devicesService.create.mockResolvedValue(device);

    await expect(controller.create('user-1', input)).resolves.toEqual(device);
    expect(devicesService.create).toHaveBeenCalledWith('user-1', input);
  });

  it('returns the authenticated owner device state', async () => {
    const state = { id: 'device-1', power: false };
    devicesService.getState.mockResolvedValue(state);

    await expect(controller.getState('user-1', 'device-1')).resolves.toEqual(
      state,
    );
    expect(devicesService.getState).toHaveBeenCalledWith('device-1', 'user-1');
  });

  it('serves state at the prefixed device state endpoint', async () => {
    const state = { id: 'device-1', power: false };
    devicesService.getState.mockResolvedValue(state);
    const module = await Test.createTestingModule({
      controllers: [DevicesController],
      providers: [{ provide: DevicesService, useValue: devicesService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context.switchToHttp().getRequest<{
            user?: { userId: string; email: string };
          }>().user = { userId: 'user-1', email: 'user@example.com' };
          return true;
        },
      })
      .compile();
    const app: INestApplication = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    try {
      await request(app.getHttpServer())
        .get(`/api/v1/devices/${deviceId}/state`)
        .expect(200)
        .expect(state);
      expect(devicesService.getState).toHaveBeenCalledWith(deviceId, 'user-1');
    } finally {
      await app.close();
    }
  });
});
