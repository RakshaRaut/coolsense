import { afterEach, describe, expect, it, vi } from 'vitest';
import { allowedOrigins } from './allowed-origins.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('allowedOrigins', () => {
  it('does not allow development origins in production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(allowedOrigins('https://coolsense.example')).toEqual([
      'https://coolsense.example',
    ]);
  });

  it('keeps localhost origins available outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');

    expect(allowedOrigins()).toContain('http://localhost:5173');
    expect(allowedOrigins()).toContain('http://127.0.0.1:5173');
  });
});
