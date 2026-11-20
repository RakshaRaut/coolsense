import {
  INestApplication,
  ValidationPipe,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AcControlController } from './ac-control.controller.js';
import { AcControlService } from './ac-control.service.js';

describe('AcControlController', () => {
  let app: INestApplication;
  const deviceId = 'c0a80123-4567-489a-9abc-123456789abc';
  const service = {
    setPower: vi.fn(),
    setTemperature: vi.fn(),
    setMode: vi.fn(),
    setFanSpeed: vi.fn(),
  };
  const guard = {
    canActivate(context: ExecutionContext) {
      context.switchToHttp().getRequest<{
        user?: { userId: string; email: string };
      }>().user = { userId: 'owner-1', email: 'owner@example.com' };
      return true;
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    service.setPower.mockResolvedValue({ acPower: true });
    service.setTemperature.mockResolvedValue({ targetTemperature: 24 });
    service.setMode.mockResolvedValue({ operatingMode: 'COOL' });
    service.setFanSpeed.mockResolvedValue({ fanSpeed: 'AUTO' });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AcControlController],
      providers: [{ provide: AcControlService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(guard)
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('routes power control to the authenticated device owner', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/ac-control/${deviceId}/power`)
      .send({ power: true })
      .expect(200)
      .expect({ acPower: true });

    expect(service.setPower).toHaveBeenCalledWith(deviceId, 'owner-1', {
      power: true,
    });
  });

  it('rejects unauthenticated requests and invalid power payloads', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/ac-control/${deviceId}/power`)
      .send({ power: 'true' })
      .expect(400);

    const module = await Test.createTestingModule({
      controllers: [AcControlController],
      providers: [{ provide: AcControlService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: () => {
          throw new UnauthorizedException();
        },
      })
      .compile();
    const unauthenticatedApp: INestApplication = module.createNestApplication();
    unauthenticatedApp.setGlobalPrefix('api/v1');
    await unauthenticatedApp.init();

    try {
      await request(unauthenticatedApp.getHttpServer())
        .patch(`/api/v1/ac-control/${deviceId}/power`)
        .send({ power: true })
        .expect(401);
    } finally {
      await unauthenticatedApp.close();
    }

    expect(service.setPower).not.toHaveBeenCalled();
  });

  it('validates temperature limits and rejects unknown payload fields', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/ac-control/${deviceId}/temperature`)
      .send({ targetTemperature: 15 })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/ac-control/${deviceId}/temperature`)
      .send({ targetTemperature: 30, unexpected: true })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/ac-control/${deviceId}/temperature`)
      .send({ targetTemperature: 16 })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/ac-control/${deviceId}/temperature`)
      .send({ targetTemperature: 30 })
      .expect(200)
      .expect({ targetTemperature: 24 });

    expect(service.setTemperature).toHaveBeenCalledTimes(2);
    expect(service.setTemperature).toHaveBeenLastCalledWith(
      deviceId,
      'owner-1',
      expect.objectContaining({ targetTemperature: 30 }),
    );
  });

  it('validates mode and fan speed values', async () => {
    for (const mode of ['COOL', 'HEAT', 'FAN', 'DRY', 'AUTO']) {
      await request(app.getHttpServer())
        .patch(`/api/v1/ac-control/${deviceId}/mode`)
        .send({ mode })
        .expect(200);
    }

    await request(app.getHttpServer())
      .patch(`/api/v1/ac-control/${deviceId}/mode`)
      .send({ mode: 'INVALID' })
      .expect(400);

    for (const fanSpeed of ['LOW', 'MEDIUM', 'HIGH', 'AUTO']) {
      await request(app.getHttpServer())
        .patch(`/api/v1/ac-control/${deviceId}/fan-speed`)
        .send({ fanSpeed })
        .expect(200);
    }

    await request(app.getHttpServer())
      .patch(`/api/v1/ac-control/${deviceId}/fan-speed`)
      .send({ fanSpeed: 'TURBO' })
      .expect(200);

    expect(service.setMode).toHaveBeenCalledTimes(5);
    expect(service.setFanSpeed).toHaveBeenCalledTimes(5);
  });

  it('accepts lowercase mode and fan speed like the combined command', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/ac-control/${deviceId}/mode`)
      .send({ mode: 'cool' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/ac-control/${deviceId}/fan-speed`)
      .send({ fanSpeed: 'low' })
      .expect(200);

    expect(service.setMode).toHaveBeenCalledWith(deviceId, 'owner-1', {
      mode: 'COOL',
    });
    expect(service.setFanSpeed).toHaveBeenCalledWith(deviceId, 'owner-1', {
      fanSpeed: 'LOW',
    });
  });
});
