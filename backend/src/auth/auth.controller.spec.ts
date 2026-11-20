import { Test, TestingModule } from '@nestjs/testing';
import { describe, beforeEach, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;
  const authService = {
    register: vi.fn(),
    login: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('delegates registration to AuthService', async () => {
    const input = {
      name: 'Raksha',
      email: 'raksha@example.com',
      password: 'Password123!',
    };
    authService.register.mockResolvedValue({ accessToken: 'token' });

    await expect(controller.register(input)).resolves.toEqual({
      accessToken: 'token',
    });
    expect(authService.register).toHaveBeenCalledWith(input);
  });

  it('delegates login to AuthService', async () => {
    const input = {
      email: 'raksha@example.com',
      password: 'Password123!',
    };
    authService.login.mockResolvedValue({ accessToken: 'token' });

    await expect(controller.login(input)).resolves.toEqual({
      accessToken: 'token',
    });
    expect(authService.login).toHaveBeenCalledWith(input);
  });
});
