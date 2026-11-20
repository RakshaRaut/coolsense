import { describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import type { Socket, Server } from 'socket.io';
import type { SimulationState } from './models/simulation-state.model.js';
import type { Device } from '@prisma/client';
import { SimulationGateway } from './simulation.gateway.js';
import type { ThingsboardIntegrationStatus } from '../thingsboard/thingsboard.service.js';

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

  const connectedGateway = () => {
    const gateway = new SimulationGateway({} as JwtService);
    const emit = vi.fn();
    const to = vi.fn().mockReturnValue({ emit });
    Object.defineProperty(gateway, 'server', {
      value: { to } as unknown as Server,
    });
    const emitted = (event: string) =>
      emit.mock.calls.filter(([name]) => name === event).map(([, payload]) => payload);
    const record = vi.fn().mockResolvedValue(undefined);
    gateway.activities = { record };
    return { gateway, to, emit, emitted, record };
  };

  it('sends device and ThingsBoard events to the owner room only', () => {
    const { gateway, to, emitted } = connectedGateway();
    const device = { id: 'device-1', name: 'Living room' } as Device;
    const tbStatus = { connected: true, synchronized: false } as ThingsboardIntegrationStatus;

    gateway.publishDeviceUpdated('user-1', device);
    gateway.publishDeviceDeleted('user-1', 'device-1');
    gateway.publishThingsboardStatus('user-1', tbStatus);
    const activity = {
      id: 'activity-1',
      kind: 'device' as const,
      message: 'Device "Living room" removed',
      deviceId: 'device-1',
      deviceName: 'Living room',
      at: '2026-11-21T12:00:00.000Z',
    };
    gateway.publishActivity('user-1', activity);

    expect(to.mock.calls.every(([room]) => room === 'user:user-1')).toBe(true);
    expect(emitted('device:updated')).toEqual([device]);
    expect(emitted('device:deleted')).toEqual([{ id: 'device-1' }]);
    expect(emitted('thingsboard:status')).toEqual([tbStatus]);
    expect(emitted('activity:new')).toEqual([activity]);
  });

  it('emits device:status and records an activity on lifecycle changes but not on ticks', () => {
    const { gateway, emitted, record } = connectedGateway();

    gateway.publishState(session, state, 'user-1');
    expect(emitted('device:status')).toEqual([]);
    expect(record).not.toHaveBeenCalled();

    gateway.publishLifecycle('stopped', session, state, 'user-1');
    expect(emitted('device:status')).toEqual([
      {
        deviceId: 'device-1',
        state: {
          power: true,
          mode: 'cool',
          fanSpeed: 'auto',
          targetTempC: 24,
          roomTempC: 29,
          humidityPct: 55,
          outsideTempC: 35,
          compressorOn: true,
          compressorModulation: 100,
          powerW: 1250,
          energyKwh: 0.0003,
          coolingOutputKw: 3.5,
          online: true,
          updatedAt: expect.any(String),
        },
      },
    ]);
    expect(record).toHaveBeenCalledWith('user-1', {
      kind: 'simulation',
      message: 'Simulation stopped',
      deviceId: 'device-1',
    });
  });

  it('turns successful AC commands into device:status and activities, failures into neither', () => {
    const { gateway, emitted, record } = connectedGateway();

    gateway.publishCommandStatus('user-1', 'device-1', false, { acPower: true }, 'nope');
    expect(record).not.toHaveBeenCalled();

    gateway.publishAcState('user-1', 'device-1', { ...state, acPower: false });
    gateway.publishCommandStatus('user-1', 'device-1', true, {
      acPower: false,
      targetTemperature: 22,
      operatingMode: 'HEAT',
    });

    expect(emitted('device:status')).toEqual([
      { deviceId: 'device-1', state: expect.objectContaining({ power: false }) },
    ]);
    expect(record.mock.calls).toEqual([
      ['user-1', { kind: 'power', message: 'AC turned off', deviceId: 'device-1' }],
      ['user-1', { kind: 'target', message: 'Target temperature set to 22.0 °C', deviceId: 'device-1' }],
      ['user-1', { kind: 'mode', message: 'Operating mode changed to heat', deviceId: 'device-1' }],
    ]);
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
