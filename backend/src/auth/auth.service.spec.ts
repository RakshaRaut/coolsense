import { Test, TestingModule } from '@nestjs/testing';
import { hash } from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let service: AuthService;
  const prisma = {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  };
  const jwtService = { signAsync: vi.fn() };
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const publicUser = {
    id: 'user-1',
    name: 'Raksha',
    email: 'raksha@example.com',
    createdAt,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService.signAsync.mockResolvedValue('signed-token');
  });

  it('hashes registration passwords and returns a JWT without password data', async () => {
    prisma.user.create.mockResolvedValue(publicUser);

    await expect(
      service.register({
        name: publicUser.name,
        email: publicUser.email,
        password: 'Password123!',
      }),
    ).resolves.toEqual({
      accessToken: 'signed-token',
      user: publicUser,
    });

    const createCall = prisma.user.create.mock.calls[0]?.[0];
    expect(createCall.data.passwordHash).not.toBe('Password123!');
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: publicUser.id,
      email: publicUser.email,
    });
  });

  it('authenticates a user using the stored password hash', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...publicUser,
      passwordHash: await hash('Password123!', 4),
    });

    await expect(
      service.login({
        email: publicUser.email,
        password: 'Password123!',
      }),
    ).resolves.toEqual({
      accessToken: 'signed-token',
      user: publicUser,
    });
  });

  it('rejects unknown users without disclosing whether the email exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({
        email: 'missing@example.com',
        password: 'Password123!',
      }),
    ).rejects.toThrow('Invalid email or password');
  });
});
