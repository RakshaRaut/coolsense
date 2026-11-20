import { describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import type { Socket, Server } from 'socket.io';
import type { SimulationState } from './models/simulation-state.model.js';
import { SimulationGateway } from './simulation.gateway.js';

describe('SimulationGateway', () => {
  const session = {
    id: 'simulation-1',
    deviceId: 'device-1',
    status: 'running',
    speed: 1,
    elapsedSec: 1,
    simulatedTime: '2026-01-01T00:00:00.000Z',
    startedAt: '2026-01-01T00:00:00.000Z',
  };
  const state: SimulationState = {
    simulationTime: 1,
    roomTemperature: 29,
    roomHumidity: 55,
    outsideTemperature: 35,
    targetTemperature: 24,
    acPower: true,
    compressorState: true,
    fanState: true,
    coolingCapacity: 3.5,
    heatingCapacity: 0,
    powerWatts: 1250,
    energyKwh: 0.0003,
    operatingMode: 'COOL',
    fanSpeed: 'AUTO',
  };

  it('requires a valid JWT at the Socket.IO connection boundary', async () => {
    const jwt = {
      verifyAsync: vi
        .fn()
        .mockResolvedValue({ sub: 'user-1', email: 'user@example.com' }),
    };
    const gateway = new SimulationGateway(jwt as unknown as JwtService);
    const validDisconnect = vi.fn();
    const invalidDisconnect = vi.fn();
    const validSocket = {
      handshake: { auth: { token: 'valid-token' } },
      data: {},
      join: vi.fn(),
      disconnect: validDisconnect,
    } as unknown as Socket;
    const invalidSocket = {
      handshake: { auth: {} },
      disconnect: invalidDisconnect,
    } as unknown as Socket;

    await gateway.handleConnection(validSocket);
    await gateway.handleConnection(invalidSocket);

    expect(jwt.verifyAsync).toHaveBeenCalledWith('valid-token');
    expect(validDisconnect).not.toHaveBeenCalled();
    expect(validSocket.join).toHaveBeenCalledWith('user:user-1');
    expect(invalidDisconnect).toHaveBeenCalledWith(true);
  });

  it('emits requested lifecycle and state events with measured simulation fields', () => {
    const jwt = { verifyAsync: vi.fn() };
    const gateway = new SimulationGateway(jwt as unknown as JwtService);
    const emit = vi.fn();
    const to = vi.fn().mockReturnValue({ emit });
    Object.defineProperty(gateway, 'server', {
      value: { to } as unknown as Server,
    });
    const timestamp = new Date('2026-01-01T00:00:01.000Z');

    gateway.publishLifecycle('started', session, state, 'user-1');
    gateway.publishState(session, state, 'user-1', timestamp);

    expect(to).toHaveBeenCalledWith('user:user-1');
    expect(emit).toHaveBeenCalledWith(
      'simulation.started',
      expect.objectContaining({
        simulationId: session.id,
        deviceId: session.deviceId,
        roomTemperature: 29,
        humidity: 55,
        compressorState: true,
        powerConsumption: 1250,
        energyConsumption: 0.0003,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      'simulation.state.updated',
      expect.objectContaining({ timestamp: timestamp.toISOString() }),
    );
    expect(emit).toHaveBeenCalledWith(
      'simulation:telemetry',
      expect.objectContaining({ deviceId: session.deviceId, roomTempC: 29 }),
    );
    expect(emit).toHaveBeenCalledWith(
      'simulation:update',
      expect.objectContaining({
        session,
        sample: expect.objectContaining({
          roomTempC: 29,
          energyKwh: 0.0003,
        }),
      }),
    );
  });
});
