import { describe, expect, it } from 'vitest';
import { DatabaseService } from './database.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('DatabaseService', () => {
  it('uses the shared PrismaService client', () => {
    expect(DatabaseService).toBe(PrismaService);
  });
});
