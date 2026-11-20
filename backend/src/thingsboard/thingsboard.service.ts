import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';

type ThingsboardEntityRef = string | { id?: string };

type ThingsboardUser = {
  id?: ThingsboardEntityRef;
  tenantId?: ThingsboardEntityRef;
  authority?: string;
};

type ThingsboardIntegrationStatus = {
  connected: boolean;
  registered: boolean;
  synchronized: boolean;
  lastSyncAt: string | null;
  lastTelemetryAt: string | null;
  deviceKeyMasked: string;
  errors: string[];
  telemetry: {
    roomTempC: number;
    humidityPct: number;
    outsideTempC: number;
    targetTempC: number;
    acState: boolean;
    compressorState: boolean;
    powerW: number;
    energyKwh: number;
    coolingCapacityKw: number;
    timestamp: string;
  } | null;
  source: 'backend';
};

function entityId(value: ThingsboardEntityRef | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.id;
}

class ThingsboardApiError extends BadGatewayException {
  constructor(
    readonly upstreamStatus: number,
    message: string,
  ) {
    super(message);
  }
}

@Injectable()
export class ThingsboardService {
  private readonly logger = new Logger(ThingsboardService.name);
  private readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly tenantId?: string;
  private readonly userId?: string;
  private readonly username?: string;
  private readonly password?: string;
  private readonly mqttAccessTokens = new Map<string, string>();
  private readonly lastSyncAt = new Map<string, string>();
  private readonly lastTelemetryAt = new Map<string, string>();
  private readonly inFlightSyncs = new Map<
    string,
    Promise<{
      enabled: boolean;
      synced: boolean;
      deviceId: string;
      thingsboardDeviceId: string | null;
    }>
  >();

  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private accountAuthority: string | null = null;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.enabled =
      config.get<string>('THINGSBOARD_ENABLED', 'false') === 'true';
    this.baseUrl = (config.get<string>('THINGSBOARD_URL') ?? '').replace(
      /\/+$/,
      '',
    );
    this.tenantId = config.get<string>('THINGSBOARD_TENANT_ID');
    this.userId = config.get<string>('THINGSBOARD_USER_ID');
    this.username = config.get<string>('THINGSBOARD_USERNAME');
    this.password = config.get<string>('THINGSBOARD_PASSWORD');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private async authenticate(): Promise<string> {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'ThingsBoard integration is disabled',
      );
    }

    if (!this.baseUrl || !this.username || !this.password) {
      throw new ServiceUnavailableException(
        'ThingsBoard configuration is incomplete',
      );
    }

    // Reuse token while valid.
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: this.username,
          password: this.password,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new ThingsboardApiError(
          response.status,
          `ThingsBoard login returned HTTP ${response.status}`,
        );
      }
      const data = (await response.json()) as { token?: string };
      if (!data.token) {
        throw new Error('ThingsBoard login response did not include a token');
      }
      this.accessToken = data.token;
      this.tokenExpiresAt = this.getTokenExpiry(data.token);

      this.logger.log('ThingsBoard authentication successful');

      return this.accessToken;
    } catch (error) {
      this.logger.error('ThingsBoard authentication failed');
      throw error;
    }
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.authenticate();

    return {
      'X-Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private getTokenExpiry(token: string): number {
    const encodedPayload = token.split('.')[1];
    if (encodedPayload) {
      try {
        const payload = JSON.parse(
          Buffer.from(encodedPayload, 'base64url').toString('utf8'),
        ) as { exp?: unknown };
        if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) {
          return Math.max(Date.now(), payload.exp * 1000 - 30_000);
        }
      } catch {
        this.logger.warn('Could not read ThingsBoard token expiration');
      }
    }

    return Date.now() + 60 * 60 * 1000;
  }

  private async request(
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const execute = async (): Promise<Response> => {
      const headers = new Headers(init.headers);
      for (const [key, value] of Object.entries(await this.getHeaders())) {
        headers.set(key, value);
      }
      return fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        signal: AbortSignal.timeout(10_000),
      });
    };

    let response = await execute();
    if (response.status === 401) {
      this.accessToken = null;
      this.tokenExpiresAt = 0;
      this.accountAuthority = null;
      response = await execute();
    }
    if (!response.ok) {
      let detail = response.statusText;
      const body = await response.text();
      if (body) {
        try {
          const error = JSON.parse(body) as { message?: unknown };
          if (typeof error.message === 'string') {
            detail = error.message;
          }
        } catch {
          detail = body;
        }
      }
      throw new ThingsboardApiError(
        response.status,
        `ThingsBoard request failed (HTTP ${response.status}): ${detail}`,
      );
    }
    return response;
  }

  private async ensureTenantAdmin(): Promise<void> {
    if (this.accountAuthority !== null) {
      if (this.accountAuthority !== 'TENANT_ADMIN') {
        throw new ServiceUnavailableException(
          'ThingsBoard device creation requires THINGSBOARD_USERNAME to be a tenant administrator',
        );
      }
      return;
    }

    const response = await this.request('/api/auth/user');
    const user = (await response.json()) as ThingsboardUser;
    this.accountAuthority = user.authority ?? null;
    if (this.userId && entityId(user.id) !== this.userId) {
      throw new ServiceUnavailableException(
        'ThingsBoard credentials do not authenticate as THINGSBOARD_USER_ID',
      );
    }
    if (this.tenantId && entityId(user.tenantId) !== this.tenantId) {
      throw new ServiceUnavailableException(
        'Authenticated ThingsBoard account does not belong to THINGSBOARD_TENANT_ID',
      );
    }
    if (this.accountAuthority !== 'TENANT_ADMIN') {
      throw new ServiceUnavailableException(
        'ThingsBoard device creation requires THINGSBOARD_USERNAME to be a tenant administrator',
      );
    }
  }

  // Create a virtual AC device.
  async createDevice(name: string, type = 'CoolSense AC', label?: string) {
    const response = await this.request('/api/device', {
      method: 'POST',
      body: JSON.stringify({ name, type, ...(label ? { label } : {}) }),
    });
    return response.json();
  }

  private async findDeviceByName(name: string) {
    const params = new URLSearchParams({ deviceName: name });
    try {
      const response = await this.request(
        `/api/tenant/device?${params.toString()}`,
      );
      return response.json();
    } catch (error) {
      if (
        error instanceof ThingsboardApiError &&
        error.upstreamStatus === 404
      ) {
        return null;
      }
      throw error;
    }
  }

  private async cacheMqttAccessToken(
    thingsboardDeviceId: string,
  ): Promise<string> {
    const response = await this.request(
      `/api/device/${encodeURIComponent(thingsboardDeviceId)}/credentials`,
    );
    const credentials = (await response.json()) as {
      credentialsType?: string;
      credentialsId?: string;
    };
    if (
      credentials.credentialsType !== 'ACCESS_TOKEN' ||
      !credentials.credentialsId
    ) {
      throw new Error(
        'ThingsBoard device credentials are not an access-token credential',
      );
    }
    this.mqttAccessTokens.set(thingsboardDeviceId, credentials.credentialsId);
    return credentials.credentialsId;
  }

  async getMqttAccessToken(deviceId: string, ownerId: string): Promise<string> {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, ownerId },
    });
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    if (!device.thingsboardDeviceId) {
      throw new ServiceUnavailableException(
        'Device is not synchronized with ThingsBoard',
      );
    }

    const cachedToken = this.mqttAccessTokens.get(device.thingsboardDeviceId);
    if (cachedToken) {
      return cachedToken;
    }
    return this.cacheMqttAccessToken(device.thingsboardDeviceId);
  }

  // Publish simulated AC telemetry.
  async publishTelemetry(
    thingsboardDeviceId: string,
    telemetry: Record<string, number | boolean | string>,
  ) {
    const response = await this.request(
      `/api/plugins/telemetry/DEVICE/${encodeURIComponent(thingsboardDeviceId)}/timeseries/ANY`,
      {
        method: 'POST',
        body: JSON.stringify({ ts: Date.now(), values: telemetry }),
      },
    );
    const text = await response.text();
    const result = text ? JSON.parse(text) : {};
    this.lastTelemetryAt.set(thingsboardDeviceId, new Date().toISOString());
    return result;
  }

  // Retrieve latest telemetry.
  async getLatestTelemetry(thingsboardDeviceId: string, keys: string[]) {
    const params = new URLSearchParams({ keys: keys.join(',') });
    const response = await this.request(
      `/api/plugins/telemetry/DEVICE/${encodeURIComponent(thingsboardDeviceId)}/values/timeseries?${params}`,
    );
    return response.json();
  }

  // Save server-side attributes.
  async saveAttributes(
    thingsboardDeviceId: string,
    attributes: Record<string, any>,
  ) {
    const response = await this.request(
      `/api/plugins/telemetry/DEVICE/${encodeURIComponent(thingsboardDeviceId)}/attributes/SERVER_SCOPE`,
      {
        method: 'POST',
        body: JSON.stringify(attributes),
      },
    );
    return response.text().then((text) => (text ? JSON.parse(text) : {}));
  }

  async syncDevice(deviceId: string, ownerId: string) {
    const syncKey = `${ownerId}:${deviceId}`;
    const existingSync = this.inFlightSyncs.get(syncKey);
    if (existingSync) {
      return existingSync;
    }

    const sync = this.syncOwnedDevice(deviceId, ownerId);
    this.inFlightSyncs.set(syncKey, sync);
    try {
      return await sync;
    } finally {
      this.inFlightSyncs.delete(syncKey);
    }
  }

  private async syncOwnedDevice(deviceId: string, ownerId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, ownerId },
    });
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    if (!this.enabled) {
      return {
        enabled: false,
        synced: false,
        deviceId,
        thingsboardDeviceId: null,
      };
    }
    let thingsboardDeviceId = device.thingsboardDeviceId;
    if (!thingsboardDeviceId) {
      await this.ensureTenantAdmin();
      const name = `${device.name} [CoolSense ${device.id}]`;
      const existing = await this.findDeviceByName(name);
      const created =
        existing ??
        (await this.createDevice(name, 'CoolSense AC', device.name));
      thingsboardDeviceId = created?.id?.id;
      if (!thingsboardDeviceId) {
        throw new Error(
          'ThingsBoard device creation did not return a device ID',
        );
      }
      await this.prisma.device.update({
        where: { id: deviceId },
        data: { thingsboardDeviceId },
      });
    }
    await this.saveAttributes(thingsboardDeviceId, {
      coolsenseDeviceId: deviceId,
      acType: device.acType,
      roomVolume: device.roomVolume,
      targetTemperature: device.targetTemperature,
    });
    await this.cacheMqttAccessToken(thingsboardDeviceId);
    this.lastSyncAt.set(thingsboardDeviceId, new Date().toISOString());
    return { enabled: true, synced: true, deviceId, thingsboardDeviceId };
  }

  async getIntegrationStatus(
    ownerId: string,
  ): Promise<ThingsboardIntegrationStatus> {
    const [devices, connection] = await Promise.all([
      this.prisma.device.findMany({
        where: { ownerId },
        orderBy: { updatedAt: 'desc' },
        include: {
          telemetry: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      }),
      this.testConnection(),
    ]);

    const registeredDevices = devices.filter(
      (device) => device.thingsboardDeviceId,
    );
    const successfulSyncs = registeredDevices
      .map((device) =>
        device.thingsboardDeviceId
          ? this.lastSyncAt.get(device.thingsboardDeviceId)
          : undefined,
      )
      .filter((timestamp): timestamp is string => Boolean(timestamp))
      .sort();
    const successfulTelemetry = registeredDevices
      .flatMap((device) => {
        const thingsboardDeviceId = device.thingsboardDeviceId;
        const telemetry = device.telemetry[0];
        const sentAt = thingsboardDeviceId
          ? this.lastTelemetryAt.get(thingsboardDeviceId)
          : undefined;
        return telemetry && sentAt ? [{ telemetry, sentAt }] : [];
      })
      .sort((left, right) => right.sentAt.localeCompare(left.sentAt));
    const latestTelemetry = successfulTelemetry[0];
    const deviceToken = registeredDevices
      .map((device) =>
        device.thingsboardDeviceId
          ? this.mqttAccessTokens.get(device.thingsboardDeviceId)
          : undefined,
      )
      .find((value): value is string => Boolean(value));

    return {
      connected: connection.success,
      registered: registeredDevices.length > 0,
      synchronized: latestTelemetry !== undefined,
      lastSyncAt: successfulSyncs.at(-1) ?? null,
      lastTelemetryAt: latestTelemetry?.sentAt ?? null,
      deviceKeyMasked: deviceToken
        ? `${deviceToken.slice(0, 4)}...${deviceToken.slice(-2)}`
        : '—',
      errors: connection.success ? [] : [connection.message],
      telemetry: latestTelemetry
        ? {
            roomTempC: latestTelemetry.telemetry.roomTemperature,
            humidityPct: latestTelemetry.telemetry.roomHumidity,
            outsideTempC: latestTelemetry.telemetry.outsideTemperature,
            targetTempC: latestTelemetry.telemetry.targetTemperature,
            acState: latestTelemetry.telemetry.acPower,
            compressorState: latestTelemetry.telemetry.compressorState,
            powerW: latestTelemetry.telemetry.powerWatts,
            energyKwh: latestTelemetry.telemetry.energyKwh,
            coolingCapacityKw: latestTelemetry.telemetry.coolingCapacity,
            timestamp: latestTelemetry.sentAt,
          }
        : null,
      source: 'backend',
    };
  }

  async syncOwnedDevices(
    ownerId: string,
  ): Promise<ThingsboardIntegrationStatus> {
    const devices = await this.prisma.device.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
    const errors: string[] = [];

    for (const device of devices) {
      try {
        const result = await this.syncDevice(device.id, ownerId);
        if (!result.synced || !result.thingsboardDeviceId) {
          continue;
        }

        await this.publishTelemetry(result.thingsboardDeviceId, {
          roomTemperature: device.roomTemperature,
          outsideTemperature: device.outsideTemperature,
          targetTemperature: device.targetTemperature,
          humidity: device.roomHumidity,
          acState: device.acPower,
          compressorState: device.compressorState,
          powerConsumption: device.powerWatts,
          energyConsumption: device.energyKwh,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'ThingsBoard sync failed';
        this.logger.warn(
          `ThingsBoard sync failed for device ${device.id}: ${message}`,
        );
        errors.push(`${device.name}: ${message}`);
      }
    }

    const status = await this.getIntegrationStatus(ownerId);
    return { ...status, errors: [...new Set([...status.errors, ...errors])] };
  }

  async getDeviceTelemetry(deviceId: string, ownerId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, ownerId },
    });
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    if (!this.enabled) {
      return { enabled: false, telemetry: {} };
    }
    if (!device.thingsboardDeviceId) {
      throw new ServiceUnavailableException(
        'Device is not synchronized with ThingsBoard',
      );
    }
    const telemetry = await this.getLatestTelemetry(
      device.thingsboardDeviceId,
      [
        'roomTemperature',
        'outsideTemperature',
        'targetTemperature',
        'humidity',
        'acState',
        'compressorState',
        'powerConsumption',
        'energyConsumption',
      ],
    );
    return { enabled: true, telemetry };
  }

  async testConnection() {
    if (!this.enabled) {
      return {
        success: false,
        message: 'ThingsBoard integration is disabled',
        authenticated: false,
      };
    }
    let authenticated = false;
    try {
      const token = await this.authenticate();
      authenticated = Boolean(token);
      await this.ensureTenantAdmin();
      return {
        success: true,
        message: 'Connected to ThingsBoard successfully',
        authenticated,
        authorized: true,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'ThingsBoard connection failed',
        authenticated,
        authorized: false,
      };
    }
  }

  // Integration status.
  getStatus() {
    return {
      enabled: this.enabled,
      configured: Boolean(this.baseUrl && this.username && this.password),
      authenticated: Boolean(
        this.accessToken && Date.now() < this.tokenExpiresAt,
      ),
      authorized: this.accountAuthority === 'TENANT_ADMIN',
    };
  }
}
