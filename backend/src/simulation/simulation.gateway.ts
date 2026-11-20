import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Socket, Server } from 'socket.io';
import type { Device } from '@prisma/client';
import type { SimulationState } from './models/simulation-state.model.js';
import type { ThingsboardIntegrationStatus } from '../thingsboard/thingsboard.service.js';
import { allowedOrigins } from '../common/allowed-origins.js';
import type {
  ActivityKind,
  ActivityPayload,
  ActivityService,
} from '../activity/activity.service.js';

interface SimulationSessionPayload {
  id: string;
  deviceId: string;
  status: string;
  speed: number;
  elapsedSec: number;
  simulatedTime: string;
  startedAt: string | null;
}

interface JwtSocketPayload {
  sub: string;
  email: string;
}

const userRoom = (userId: string) => `user:${userId}`;

@Injectable()
@WebSocketGateway({
  // Checked per request: ConfigModule loads FRONTEND_URL into process.env
  // after this decorator has been evaluated.
  cors: {
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => callback(null, !origin || allowedOrigins().includes(origin)),
  },
})
export class SimulationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SimulationGateway.name);

  @WebSocketServer()
  private server?: Server;

  /** Set by ActivityService (it depends on this gateway, so it cannot be injected here). */
  activities?: Pick<ActivityService, 'record'>;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket): Promise<void> {
    const authToken = client.handshake.auth?.token;
    const authorization = client.handshake.headers?.authorization;
    const token =
      typeof authToken === 'string'
        ? authToken
        : typeof authorization === 'string' &&
            authorization.startsWith('Bearer ')
          ? authorization.slice('Bearer '.length)
          : undefined;
    if (typeof token !== 'string' || token.length === 0) {
      client.disconnect(true);
      return;
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<JwtSocketPayload>(token);
      if (!payload.sub || !payload.email) {
        throw new UnauthorizedException('Invalid access token');
      }
      client.data.userId = payload.sub;
      await client.join(userRoom(payload.sub));
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket ${client.id} disconnected`);
  }

  publishLifecycle(
    event:
      | 'started'
      | 'paused'
      | 'resumed'
      | 'stopped'
      | 'reset',
    session: SimulationSessionPayload,
    state: SimulationState,
    ownerId: string,
  ): void {
    const payload = this.toPayload(session, state);
    this.emitToOwner(ownerId, `simulation.${event}`, payload);
    this.publishDeviceStatus(ownerId, session.deviceId, state);
    this.recordActivity(ownerId, 'simulation', `Simulation ${event}`, session.deviceId);

    const legacyEvent = {
      started: 'simulation:started',
      paused: 'simulation:paused',
      resumed: 'simulation:resumed',
      stopped: 'simulation:stopped',
      reset: undefined,
    }[event];
    if (legacyEvent) {
      this.emitToOwner(ownerId, legacyEvent, session);
    }
    this.emitToOwner(ownerId, 'simulation:state', payload);
  }

  publishState(
    session: SimulationSessionPayload,
    state: SimulationState,
    ownerId: string,
    timestamp = new Date(),
  ): void {
    const payload = this.toPayload(session, state, timestamp);
    this.emitToOwner(ownerId, 'simulation.state.updated', payload);
    this.emitToOwner(ownerId, 'simulation:state', payload);
    this.emitToOwner(ownerId, 'simulation:update', {
      session,
      sample: {
        t: state.simulationTime,
        elapsedSec: state.simulationTime,
        time: timestamp.toISOString(),
        roomTempC: state.roomTemperature,
        targetTempC: state.targetTemperature,
        outsideTempC: state.outsideTemperature,
        powerW: state.powerWatts,
        energyKwh: state.energyKwh,
        compressorModulation: state.compressorState ? 100 : 0,
        compressorOn: state.compressorState,
        coolingKw: state.coolingCapacity,
      },
      source: 'backend',
    });
    const telemetry = {
      deviceId: session.deviceId,
      timestamp: timestamp.toISOString(),
      simulationTime: state.simulationTime,
      roomTempC: state.roomTemperature,
      targetTempC: state.targetTemperature,
      outsideTempC: state.outsideTemperature,
      humidityPct: state.roomHumidity,
      powerW: state.powerWatts,
      energyKwh: state.energyKwh,
      compressorOn: state.compressorState,
      compressorModulation: state.compressorState ? 100 : 0,
      coolingKw: state.coolingCapacity,
      simulationId: session.id,
    };
    this.emitToOwner(ownerId, 'simulation:telemetry', telemetry);
    this.emitToOwner(ownerId, 'telemetry:update', telemetry);
  }

  publishAcState(ownerId: string, deviceId: string, state: SimulationState): void {
    this.emitToOwner(ownerId, 'ac:state', {
      deviceId,
      ...state,
      timestamp: new Date().toISOString(),
    });
    // Only AC commands call this, so device:status fires per change, never per tick.
    this.publishDeviceStatus(ownerId, deviceId, state);
  }

  publishCommandStatus(
    ownerId: string,
    deviceId: string,
    success: boolean,
    command: Partial<SimulationState>,
    message?: string,
  ): void {
    this.emitToOwner(ownerId, 'ac:command:status', {
      deviceId,
      success,
      command,
      ...(message ? { message } : {}),
      timestamp: new Date().toISOString(),
    });
    if (!success) {
      return;
    }
    if (command.acPower !== undefined) {
      this.recordActivity(ownerId, 'power', `AC turned ${command.acPower ? 'on' : 'off'}`, deviceId);
    }
    if (command.targetTemperature !== undefined) {
      this.recordActivity(ownerId, 'target', `Target temperature set to ${command.targetTemperature.toFixed(1)} °C`, deviceId);
    }
    if (command.operatingMode !== undefined) {
      this.recordActivity(ownerId, 'mode', `Operating mode changed to ${command.operatingMode.toLowerCase()}`, deviceId);
    }
    if (command.fanSpeed !== undefined) {
      this.recordActivity(ownerId, 'mode', `Fan speed changed to ${command.fanSpeed.toLowerCase()}`, deviceId);
    }
  }

  /** Payload is the device row, as returned by the REST API. */
  publishDeviceUpdated(ownerId: string, device: Device): void {
    this.emitToOwner(ownerId, 'device:updated', device);
  }

  publishDeviceDeleted(ownerId: string, id: string): void {
    this.emitToOwner(ownerId, 'device:deleted', { id });
  }

  publishDeviceStatus(
    ownerId: string,
    deviceId: string,
    state: SimulationState,
  ): void {
    this.emitToOwner(ownerId, 'device:status', {
      deviceId,
      state: {
        power: state.acPower,
        mode: state.operatingMode.toLowerCase(),
        fanSpeed: state.fanSpeed.toLowerCase(),
        targetTempC: state.targetTemperature,
        roomTempC: state.roomTemperature,
        humidityPct: state.roomHumidity,
        outsideTempC: state.outsideTemperature,
        compressorOn: state.compressorState,
        compressorModulation: state.compressorState ? 100 : 0,
        powerW: state.powerWatts,
        energyKwh: state.energyKwh,
        coolingOutputKw: state.coolingCapacity,
        online: true,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  /** Called by ActivityService after persisting, so live and REST activities share ids. */
  publishActivity(ownerId: string, activity: ActivityPayload): void {
    this.emitToOwner(ownerId, 'activity:new', activity);
  }

  publishThingsboardStatus(
    ownerId: string,
    status: ThingsboardIntegrationStatus,
  ): void {
    this.emitToOwner(ownerId, 'thingsboard:status', status);
  }

  private recordActivity(
    ownerId: string,
    kind: ActivityKind,
    message: string,
    deviceId: string,
  ): void {
    void this.activities?.record(ownerId, { kind, message, deviceId });
  }

  private toPayload(
    session: SimulationSessionPayload,
    state: SimulationState,
    timestamp = new Date(),
  ) {
    return {
      simulationId: session.id,
      deviceId: session.deviceId,
      status: session.status,
      roomTemperature: state.roomTemperature,
      humidity: state.roomHumidity,
      compressorState: state.compressorState,
      powerConsumption: state.powerWatts,
      energyConsumption: state.energyKwh,
      targetTemperature: state.targetTemperature,
      outsideTemperature: state.outsideTemperature,
      timestamp: timestamp.toISOString(),
    };
  }

  private emitToOwner(
    ownerId: string,
    event: string,
    payload: unknown,
  ): void {
    this.server?.to(userRoom(ownerId)).emit(event, payload);
  }
}