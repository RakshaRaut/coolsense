import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { ThingsboardController } from './thingsboard.controller.js';
import { ThingsboardService } from './thingsboard.service.js';

describe('ThingsboardController', () => {
  let controller: ThingsboardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ThingsboardController],
      providers: [
        {
          provide: ThingsboardService,
          useValue: {
            getStatus: () => ({ enabled: false, configured: false, authenticated: false }),
            testConnection: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ThingsboardController>(ThingsboardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
