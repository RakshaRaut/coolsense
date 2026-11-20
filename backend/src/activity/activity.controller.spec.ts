import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ActivityController } from './activity.controller.js';
import { ActivityService } from './activity.service.js';

describe('ActivityController', () => {
  let app: INestApplication;
  const activityService = { list: vi.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ActivityController],
      providers: [{ provide: ActivityService, useValue: activityService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<{
            headers: Record<string, string>;
            user?: { userId: string; email: string };
          }>();
          req.user = { userId: req.headers['x-user'], email: 'u@example.com' };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    // Same pipe options as main.ts.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    activityService.list.mockResolvedValue([]);
  });

  it('lists only the authenticated user activities, 20 by default', async () => {
    const items = [{ id: 'a1', kind: 'device', message: 'x', at: '2026-11-21T12:00:00.000Z' }];
    activityService.list.mockResolvedValue(items);

    await request(app.getHttpServer())
      .get('/api/v1/activities')
      .set('x-user', 'user-1')
      .expect(200)
      .expect(items);
    expect(activityService.list).toHaveBeenCalledWith('user-1', 20);

    await request(app.getHttpServer())
      .get('/api/v1/activities?limit=40')
      .set('x-user', 'user-2')
      .expect(200);
    expect(activityService.list).toHaveBeenLastCalledWith('user-2', 40);
  });

  it.each(['0', '101', '1.5', 'abc'])('rejects limit=%s', async (limit) => {
    await request(app.getHttpServer())
      .get(`/api/v1/activities?limit=${limit}`)
      .set('x-user', 'user-1')
      .expect(400);
    expect(activityService.list).not.toHaveBeenCalled();
  });

  it('accepts the max limit of 100', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/activities?limit=100')
      .set('x-user', 'user-1')
      .expect(200);
    expect(activityService.list).toHaveBeenCalledWith('user-1', 100);
  });
});
