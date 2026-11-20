import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

describe('UsersController', () => {
  let controller: UsersController;
  const usersService = { getById: vi.fn(), deleteUser: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('returns the authenticated user profile', async () => {
    const profile = {
      id: 'user-1',
      name: 'Raksha',
      email: 'raksha@example.com',
    };
    usersService.getById.mockResolvedValue(profile);

    await expect(controller.getCurrentUser('user-1')).resolves.toEqual(profile);
    expect(usersService.getById).toHaveBeenCalledWith('user-1');
  });

  it('deletes only the authenticated user own account', async () => {
    usersService.deleteUser.mockResolvedValue({ userId: 'user-1' });

    expect(() => controller.deleteUser('user-1', 'user-2')).toThrow(
      ForbiddenException,
    );
    expect(usersService.deleteUser).not.toHaveBeenCalled();

    await expect(controller.deleteUser('user-1', 'user-1')).resolves.toEqual({
      userId: 'user-1',
    });
    expect(usersService.deleteUser).toHaveBeenCalledWith('user-1');
  });
});
