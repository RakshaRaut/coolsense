import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  const prisma = { user: { findUnique: vi.fn() } };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('returns only public user fields', async () => {
    const user = {
      id: 'user-1',
      name: 'Raksha',
      email: 'raksha@example.com',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(service.getById(user.id)).resolves.toEqual(user);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: user.id },
      select: { id: true, name: true, email: true, createdAt: true },
    });
  });

  it('returns not found for a missing user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.getById('missing')).rejects.toThrow('User not found');
  });
});
