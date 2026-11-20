import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Device, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SimulationConfig } from './models/simulation-config.model.js';
import type { SimulationState } from './models/simulation-state.model.js';
import { TelemetryService } from '../telemetry/telemetry.service.js';
import { SimulationGateway } from './simulation.gateway.js';
import { SimulationScheduler } from './simulation.scheduler.js';
import {
  SimulationEnvironmentUpdateDto,
  SimulationSpeedDto,
  StartSimulationDto,
} from './dto/simulation.dto.js';
import { CreateSimulationDto } from './dto/create-simulation.dto.js';
import { UpdateSimulationDto } from './dto/update-simulation.dto.js';
import { ThingsboardService } from '../thingsboard/thingsboard.service.js';

const SIMULATION_STATUSES = [
  'CREATED',
  'RUNNING',
  'PAUSED',
  'STOPPED',
] as const;
type SimulationStatus = (typeof SIMULATION_STATUSES)[number];
type SimulationRecord = Prisma.SimulationGetPayload<{
  include: { device: true };
}>;
type SimulationWhereInput = Prisma.SimulationWhereInput;

const isSimulationStatus = (status: string): status is SimulationStatus =>
  SIMULATION_STATUSES.includes(status as SimulationStatus);

function jsonRecord(value: Prisma.JsonValue, label: string) {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(`Stored simulation ${label} is invalid`);
  }
  return value;
}

function numberField(
  object: ReturnType<typeof jsonRecord>,
  field: string,
): number {
  const value = object[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Stored simulation field "${field}" is invalid`);
  }
  return value;
}

function booleanField(
  object: ReturnType<typeof jsonRecord>,
  field: string,
): boolean {
  const value = object[field];
  if (typeof value !== 'boolean') {
    throw new Error(`Stored simulation field "${field}" is invalid`);
  }
  return value;
}

function stringField(
  object: ReturnType<typeof jsonRecord>,
  field: string,
): string {
  const value = object[field];
  if (typeof value !== 'string') {
    throw new Error(`Stored simulation field "${field}" is invalid`);
  }
  return value;
}

function stateToJson(state: SimulationState): Prisma.InputJsonObject {
  return {
    simulationTime: state.simulationTime,
    roomTemperature: state.roomTemperature,
    roomHumidity: state.roomHumidity,
    outsideTemperature: state.outsideTemperature,
    targetTemperature: state.targetTemperature,
    acPower: state.acPower,
    compressorState: state.compressorState,
    fanState: state.fanState,
    coolingCapacity: state.coolingCapacity,
    heatingCapacity: state.heatingCapacity,
    powerWatts: state.powerWatts,
    energyKwh: state.energyKwh,
    operatingMode: state.operatingMode,
    fanSpeed: state.fanSpeed,
  };
}

function stateFromJson(value: Prisma.JsonValue): SimulationState {
  const object = jsonRecord(value, 'state');
  return {
    simulationTime: numberField(object, 'simulationTime'),
    roomTemperature: numberField(object, 'roomTemperature'),
    roomHumidity: numberField(object, 'roomHumidity'),
    outsideTemperature: numberField(object, 'outsideTemperature'),
    targetTemperature: numberField(object, 'targetTemperature'),
    acPower: booleanField(object, 'acPower'),
    compressorState: booleanField(object, 'compressorState'),
    fanState: booleanField(object, 'fanState'),
    coolingCapacity: numberField(object, 'coolingCapacity'),
    heatingCapacity: numberField(object, 'heatingCapacity'),
    powerWatts: numberField(object, 'powerWatts'),
    energyKwh: numberField(object, 'energyKwh'),
    operatingMode: stringField(object, 'operatingMode'),
    fanSpeed: stringField(object, 'fanSpeed'),
  };
}

function configToJson(config: SimulationConfig): Prisma.InputJsonObject {
  return {
    acType: config.acType,
    roomVolume: config.roomVolume,
    outsideTemperature: config.outsideTemperature,
    initialRoomTemperature: config.initialRoomTemperature,
    targetTemperature: config.targetTemperature,
    ratedCoolingCapacity: config.ratedCoolingCapacity,
    ratedHeatingCapacity:
      config.ratedHeatingCapacity ?? config.ratedCoolingCapacity,
    ratedPowerWatts: config.ratedPowerWatts,
    heatLoadKw: config.heatLoadKw,
    thermostatDifferential: config.thermostatDifferential,
    simulationSpeed: config.simulationSpeed,
    thermalCapacityKwhPerC: config.thermalCapacityKwhPerC,
    thermalConductanceKwPerC: config.thermalConductanceKwPerC,
    fanPowerWatts: config.fanPowerWatts,
  };
}

function configFromJson(value: Prisma.JsonValue): SimulationConfig {
  const object = jsonRecord(value, 'configuration');
  const acType = stringField(object, 'acType');
  if (acType !== 'INVERTER' && acType !== 'NON_INVERTER') {
    throw new Error(`Stored simulation AC type "${acType}" is invalid`);
  }
  return {
    acType,
    roomVolume: numberField(object, 'roomVolume'),
    outsideTemperature: numberField(object, 'outsideTemperature'),
    initialRoomTemperature: numberField(object, 'initialRoomTemperature'),
    targetTemperature: numberField(object, 'targetTemperature'),
    ratedCoolingCapacity: numberField(object, 'ratedCoolingCapacity'),
    ratedHeatingCapacity: numberField(object, 'ratedHeatingCapacity'),
    ratedPowerWatts: numberField(object, 'ratedPowerWatts'),
    heatLoadKw: numberField(object, 'heatLoadKw'),
    thermostatDifferential: numberField(object, 'thermostatDifferential'),
    simulationSpeed: numberField(object, 'simulationSpeed'),
    thermalCapacityKwhPerC: numberField(object, 'thermalCapacityKwhPerC'),
    thermalConductanceKwPerC: numberField(object, 'thermalConductanceKwPerC'),
    fanPowerWatts: numberField(object, 'fanPowerWatts'),
  };
}

function deviceConfig(device: Device): SimulationConfig {
  if (device.acType !== 'INVERTER' && device.acType !== 'NON_INVERTER') {
    throw new BadRequestException(`Unsupported AC type "${device.acType}"`);
  }
  return {
    acType: device.acType,
    roomVolume: device.roomVolume,
    outsideTemperature: device.outsideTemperature,
    initialRoomTemperature: device.initialRoomTemperature,
    targetTemperature: device.targetTemperature,
    ratedCoolingCapacity: device.ratedCoolingCapacity,
    ratedHeatingCapacity: device.ratedHeatingCapacity,
    ratedPowerWatts: device.ratedPowerWatts,
    heatLoadKw: device.heatLoadKw,
    thermostatDifferential: device.thermostatDifferential,
    simulationSpeed: device.simulationSpeed,
    thermalCapacityKwhPerC: device.thermalCapacityKwhPerC,
    thermalConductanceKwPerC: device.thermalConductanceKwPerC,
    fanPowerWatts: device.fanPowerWatts,
  };
}

function deviceState(device: Device): SimulationState {
  return {
    simulationTime: device.simulationTime,
    roomTemperature: device.roomTemperature,
    roomHumidity: device.roomHumidity,
    outsideTemperature: device.outsideTemperature,
    targetTemperature: device.targetTemperature,
    acPower: device.acPower,
    compressorState: device.compressorState,
    fanState: device.fanState,
    coolingCapacity: device.coolingCapacity,
    heatingCapacity: device.heatingCapacity,
    powerWatts: device.powerWatts,
    energyKwh: device.energyKwh,
    operatingMode: device.operatingMode,
    fanSpeed: device.fanSpeed,
  };
}

function telemetryFromState(
  deviceId: string,
  state: SimulationState,
  timestamp?: Date,
): Prisma.TelemetryUncheckedCreateInput {
  return {
    deviceId,
    simulationTime: state.simulationTime,
    roomTemperature: state.roomTemperature,
    targetTemperature: state.targetTemperature,
    outsideTemperature: state.outsideTemperature,
    roomHumidity: state.roomHumidity,
    acPower: state.acPower,
    compressorState: state.compressorState,
    fanState: state.fanState,
    coolingCapacity: state.coolingCapacity,
    heatingCapacity: state.heatingCapacity,
    powerWatts: state.powerWatts,
    energyKwh: state.energyKwh,
    operatingMode: state.operatingMode,
    fanSpeed: state.fanSpeed,
    timestamp,
  };
}

function deviceStateUpdate(state: SimulationState): Prisma.DeviceUpdateInput {
  return {
    simulationTime: state.simulationTime,
    roomTemperature: state.roomTemperature,
    roomHumidity: state.roomHumidity,
    outsideTemperature: state.outsideTemperature,
    targetTemperature: state.targetTemperature,
    acPower: state.acPower,
    compressorState: state.compressorState,
    fanState: state.fanState,
    coolingCapacity: state.coolingCapacity,
    heatingCapacity: state.heatingCapacity,
    powerWatts: state.powerWatts,
    energyKwh: state.energyKwh,
    operatingMode: state.operatingMode,
    fanSpeed: state.fanSpeed,
  };
}

@Injectable()
export class SimulationService implements OnModuleInit {
  private readonly logger = new Logger(SimulationService.name);
  private readonly snapshotIntervalMs: number;
  private readonly lastSnapshotAt = new Map<string, number>();
  private readonly telemetryIntervalMs: number;
  private readonly lastTelemetryAt = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SimulationScheduler,
    private readonly gateway: SimulationGateway,
    private readonly telemetry: TelemetryService,
    private readonly thingsboard: ThingsboardService,
    config: ConfigService,
  ) {
    this.snapshotIntervalMs = Number(
      config.get<string>('SIMULATION_HISTORY_INTERVAL_MS', '5000'),
    );
    if (
      !Number.isInteger(this.snapshotIntervalMs) ||
      this.snapshotIntervalMs < 1000
    ) {
      throw new Error(
        'SIMULATION_HISTORY_INTERVAL_MS must be an integer of at least 1000',
      );
    }
    this.telemetryIntervalMs = Number(
      config.get<string>('TELEMETRY_INTERVAL_MS', '5000'),
    );
    if (
      !Number.isInteger(this.telemetryIntervalMs) ||
      this.telemetryIntervalMs < 1000
    ) {
      throw new Error(
        'TELEMETRY_INTERVAL_MS must be an integer of at least 1000',
      );
    }
  }

  async onModuleInit(): Promise<void> {
    const running = await this.prisma.simulation.findMany({
      where: { status: 'RUNNING' },
      include: { device: true },
    });
    for (const simulation of running) {
      const state = stateFromJson(simulation.currentState);
      this.lastSnapshotAt.set(simulation.id, simulation.updatedAt.getTime());
      this.schedule(simulation, configFromJson(simulation.config), state);
    }
  }

  async create(ownerId: string, input: CreateSimulationDto) {
    const device = await this.findOwnedDevice(input.deviceId, ownerId);
    const { mode, fanSpeed, ...requestedConfig } = input.config;
    const overrides: Partial<SimulationConfig> = {};
    for (const [key, value] of Object.entries(requestedConfig)) {
      if (value !== undefined) {
        Object.assign(overrides, { [key]: value });
      }
    }
    const config: SimulationConfig = {
      ...deviceConfig(device),
      ...overrides,
    };
    const initialState: SimulationState = {
      ...deviceState(device),
      targetTemperature: config.targetTemperature,
      outsideTemperature: config.outsideTemperature,
      operatingMode: mode ?? device.operatingMode,
      fanSpeed: fanSpeed ?? device.fanSpeed,
      acPower: false,
      compressorState: false,
      fanState: false,
      coolingCapacity: 0,
      heatingCapacity: 0,
      powerWatts: 0,
    };
    const simulation = await this.prisma.simulation.create({
      data: {
        name: input.name,
        deviceId: device.id,
        config: configToJson(config),
        currentState: stateToJson(initialState),
        initialState: stateToJson(initialState),
      },
    });
    await this.prisma.simulationSnapshot.create({
      data: {
        simulationId: simulation.id,
        simulationTime: initialState.simulationTime,
        state: stateToJson(initialState),
      },
    });
    return this.findOne(ownerId, simulation.id);
  }

  findAll(ownerId: string) {
    return this.prisma.simulation.findMany({
      where: { device: { is: { ownerId } } },
      orderBy: { createdAt: 'desc' },
      include: { device: true },
    });
  }

  async findOne(ownerId: string, simulationId: string) {
    return this.findOwnedRecord(ownerId, simulationId);
  }

  async startSimulation(ownerId: string, simulationId: string) {
    const existing = await this.findOne(ownerId, simulationId);
    const status = this.requireStatus(existing.status);
    if (status !== 'CREATED' && status !== 'STOPPED') {
      throw new ConflictException(
        `Cannot start a simulation in ${status} state`,
      );
    }
    if (this.scheduler.has(simulationId)) {
      throw new ConflictException('Simulation is already executing');
    }
    await this.assertDeviceIdle(existing.deviceId, simulationId);

    const config = configFromJson(existing.config);
    const storedState =
      status === 'STOPPED'
        ? stateFromJson(existing.initialState)
        : stateFromJson(existing.currentState);
    const state: SimulationState = {
      ...storedState,
      acPower: true,
      fanState: true,
    };
    const now = new Date();
    const started = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.simulation.updateMany({
        where: { id: simulationId, status },
        data: {
          status: 'RUNNING',
          currentState: stateToJson(state),
          startedAt: now,
          pausedAt: null,
          stoppedAt: null,
        },
      });
      if (result.count !== 1) {
        throw new ConflictException(
          'Simulation lifecycle changed concurrently',
        );
      }
      await transaction.device.update({
        where: { id: existing.deviceId },
        data: {
          ...deviceStateUpdate(state),
          simulationStatus: 'running',
          simulationStartedAt: now,
          simulationSpeed: config.simulationSpeed,
        },
      });
      return transaction.simulation.findUniqueOrThrow({
        where: { id: simulationId },
        include: { device: true },
      });
    });

    this.lastSnapshotAt.set(simulationId, Date.now());
    this.schedule(started, config, state);
    this.publishLifecycle('started', started, state);
    return started;
  }

  async pauseSimulation(ownerId: string, simulationId: string) {
    const existing = await this.findOne(ownerId, simulationId);
    if (this.requireStatus(existing.status) !== 'RUNNING') {
      throw new ConflictException('Only a running simulation can be paused');
    }
    const state =
      (await this.scheduler.stop(simulationId)) ??
      stateFromJson(existing.currentState);
    const now = new Date();
    const paused = await this.updateLifecycle(
      simulationId,
      'RUNNING',
      'PAUSED',
      { currentState: stateToJson(state), pausedAt: now },
      { simulationStatus: 'paused' },
      telemetryFromState(existing.deviceId, state, now),
    );
    this.publishLifecycle('paused', paused, state);
    return paused;
  }

  async resumeSimulation(ownerId: string, simulationId: string) {
    const existing = await this.findOne(ownerId, simulationId);
    if (this.requireStatus(existing.status) !== 'PAUSED') {
      throw new ConflictException('Only a paused simulation can be resumed');
    }
    if (this.scheduler.has(simulationId)) {
      throw new ConflictException('Simulation is already executing');
    }
    await this.assertDeviceIdle(existing.deviceId, simulationId);
    const config = configFromJson(existing.config);
    const state = stateFromJson(existing.currentState);
    const resumed = await this.updateLifecycle(
      simulationId,
      'PAUSED',
      'RUNNING',
      { pausedAt: null },
      { simulationStatus: 'running' },
    );
    this.schedule(resumed, config, state);
    this.publishLifecycle('resumed', resumed, state);
    return resumed;
  }

  async stopSimulation(ownerId: string, simulationId: string) {
    const existing = await this.findOne(ownerId, simulationId);
    const status = this.requireStatus(existing.status);
    if (status !== 'RUNNING' && status !== 'PAUSED') {
      throw new ConflictException(
        'Only a running or paused simulation can be stopped',
      );
    }
    const state =
      (await this.scheduler.stop(simulationId)) ??
      stateFromJson(existing.currentState);
    const now = new Date();
    const stopped = await this.updateLifecycle(
      simulationId,
      status,
      'STOPPED',
      { currentState: stateToJson(state), stoppedAt: now },
      { simulationStatus: 'finished' },
      // A paused run already wrote its final row on pause.
      status === 'RUNNING'
        ? telemetryFromState(existing.deviceId, state, now)
        : undefined,
    );
    this.publishLifecycle('stopped', stopped, state);
    this.lastSnapshotAt.delete(simulationId);
    this.lastTelemetryAt.delete(simulationId);
    return stopped;
  }

  async resetSimulation(ownerId: string, simulationId: string) {
    const existing = await this.findOne(ownerId, simulationId);
    await this.scheduler.stop(simulationId);
    const initialState = stateFromJson(existing.initialState);
    const reset = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.simulation.update({
        where: { id: simulationId },
        data: {
          status: 'CREATED',
          currentState: stateToJson(initialState),
          startedAt: null,
          pausedAt: null,
          stoppedAt: null,
        },
        include: { device: true },
      });
      await transaction.device.update({
        where: { id: existing.deviceId },
        data: {
          ...deviceStateUpdate(initialState),
          simulationStatus: 'idle',
          simulationStartedAt: null,
        },
      });
      await transaction.simulationSnapshot.create({
        data: {
          simulationId,
          simulationTime: initialState.simulationTime,
          state: stateToJson(initialState),
        },
      });
      return updated;
    });
    this.lastSnapshotAt.delete(simulationId);
    this.lastTelemetryAt.delete(simulationId);
    this.publishLifecycle('reset', reset, initialState);
    return reset;
  }

  async updateConfig(
    ownerId: string,
    simulationId: string,
    patch: UpdateSimulationDto,
  ) {
    if (Object.values(patch).every((value) => value === undefined)) {
      throw new BadRequestException(
        'At least one configuration value is required',
      );
    }
    const existing = await this.findOne(ownerId, simulationId);
    const config = configFromJson(existing.config);
    const state = stateFromJson(existing.currentState);
    const nextConfig: SimulationConfig = {
      ...config,
      ...(patch.targetTemperature === undefined
        ? {}
        : { targetTemperature: patch.targetTemperature }),
      ...(patch.ambientTemperature === undefined
        ? {}
        : { outsideTemperature: patch.ambientTemperature }),
      ...(patch.simulationSpeed === undefined
        ? {}
        : { simulationSpeed: patch.simulationSpeed }),
    };
    const nextState: SimulationState = {
      ...state,
      ...(patch.targetTemperature === undefined
        ? {}
        : { targetTemperature: patch.targetTemperature }),
      ...(patch.ambientTemperature === undefined
        ? {}
        : { outsideTemperature: patch.ambientTemperature }),
      ...(patch.mode === undefined ? {} : { operatingMode: patch.mode }),
      ...(patch.fanSpeed === undefined ? {} : { fanSpeed: patch.fanSpeed }),
    };

    const updated = await this.prisma.$transaction(async (transaction) => {
      const simulation = await transaction.simulation.update({
        where: { id: simulationId },
        data: {
          config: configToJson(nextConfig),
          currentState: stateToJson(nextState),
        },
        include: { device: true },
      });
      await transaction.device.update({
        where: { id: existing.deviceId },
        data: {
          ...deviceStateUpdate(nextState),
          outsideTemperature: nextConfig.outsideTemperature,
          targetTemperature: nextConfig.targetTemperature,
          simulationSpeed: nextConfig.simulationSpeed,
        },
      });
      return simulation;
    });
    this.scheduler.update(simulationId, {
      config: nextConfig,
      state: nextState,
    });
    return updated;
  }

  async getState(ownerId: string, simulationId: string) {
    const simulation = await this.findOne(ownerId, simulationId);
    return {
      simulationId,
      deviceId: simulation.deviceId,
      status: simulation.status,
      state: stateFromJson(simulation.currentState),
      timestamp: simulation.updatedAt.toISOString(),
    };
  }

  async getHistory(ownerId: string, simulationId: string, limit = 100) {
    await this.findOne(ownerId, simulationId);
    return this.prisma.simulationSnapshot.findMany({
      where: { simulationId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async syncDeviceControl(deviceId: string, state: SimulationState) {
    const running = await this.prisma.simulation.findMany({
      where: { deviceId, status: 'RUNNING' },
    });
    for (const simulation of running) {
      const config = configFromJson(simulation.config);
      const nextConfig = {
        ...config,
        targetTemperature: state.targetTemperature,
        outsideTemperature: state.outsideTemperature,
      };
      await this.prisma.simulation.update({
        where: { id: simulation.id },
        data: {
          config: configToJson(nextConfig),
          currentState: stateToJson(state),
        },
      });
      this.scheduler.update(simulation.id, {
        config: nextConfig,
        state,
      });
    }
  }

  private async updateLifecycle(
    simulationId: string,
    from: SimulationStatus,
    to: SimulationStatus,
    data: Prisma.SimulationUpdateManyMutationInput,
    deviceData: Prisma.DeviceUpdateInput,
    finalTelemetry?: Prisma.TelemetryUncheckedCreateInput,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.simulation.updateMany({
        where: { id: simulationId, status: from },
        data: { ...data, status: to },
      });
      if (result.count !== 1) {
        throw new ConflictException(
          'Simulation lifecycle changed concurrently',
        );
      }
      const simulation = await transaction.simulation.findUniqueOrThrow({
        where: { id: simulationId },
        include: { device: true },
      });
      await transaction.device.update({
        where: { id: simulation.deviceId },
        data: deviceData,
      });
      if (finalTelemetry) {
        await this.telemetry.saveGeneratedTelemetry(
          finalTelemetry,
          transaction,
        );
      }
      return simulation;
    });
  }

  // Two RUNNING simulations on one device interleave its telemetry and corrupt energy analytics.
  private async assertDeviceIdle(deviceId: string, simulationId: string) {
    const other = await this.prisma.simulation.findFirst({
      where: { deviceId, status: 'RUNNING', id: { not: simulationId } },
      select: { id: true },
    });
    if (other) {
      throw new ConflictException(
        `Simulation ${other.id} is already running on this device`,
      );
    }
  }

  private async findOwnedDevice(deviceId: string, ownerId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, ownerId },
    });
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    return device;
  }

  private async findOwnedRecord(ownerId: string, simulationId: string) {
    const simulation = await this.prisma.simulation.findFirst({
      where: { id: simulationId, device: { is: { ownerId } } },
      include: { device: true },
    });
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }
    return simulation;
  }

  private requireStatus(status: string): SimulationStatus {
    if (!isSimulationStatus(status)) {
      throw new ConflictException(`Unknown simulation status "${status}"`);
    }
    return status;
  }

  private schedule(
    simulation: SimulationRecord,
    config: SimulationConfig,
    state: SimulationState,
  ) {
    this.scheduler.start(
      simulation.id,
      config,
      state,
      stateFromJson(simulation.initialState),
      (simulationId, nextState, nextConfig, timestamp, saveHistory) =>
        this.persistTick(
          simulationId,
          nextState,
          nextConfig,
          timestamp,
          saveHistory,
        ),
    );
  }

  private async persistTick(
    simulationId: string,
    state: SimulationState,
    config: SimulationConfig,
    timestamp: Date,
    saveHistory: boolean,
  ) {
    const shouldSaveHistory =
      saveHistory &&
      timestamp.getTime() - (this.lastSnapshotAt.get(simulationId) ?? 0) >=
        this.snapshotIntervalMs;
    // Ticks stay at 1s for the live UI; Telemetry rows are throttled.
    const shouldSaveTelemetry =
      timestamp.getTime() - (this.lastTelemetryAt.get(simulationId) ?? 0) >=
      this.telemetryIntervalMs;
    const updated = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.simulation.findUnique({
        where: { id: simulationId },
        include: { device: true },
      });
      if (!current || current.status !== 'RUNNING') {
        return null;
      }
      const simulation = await transaction.simulation.update({
        where: { id: simulationId },
        data: {
          currentState: stateToJson(state),
          config: configToJson(config),
        },
        include: { device: true },
      });
      const updatedDevice = await transaction.device.update({
        where: { id: current.deviceId },
        data: deviceStateUpdate(state),
      });
      if (shouldSaveTelemetry) {
        await this.telemetry.saveGeneratedTelemetry(
          telemetryFromState(current.deviceId, state, timestamp),
          transaction,
        );
      }
      if (shouldSaveHistory) {
        await transaction.simulationSnapshot.create({
          data: {
            simulationId,
            timestamp,
            simulationTime: state.simulationTime,
            state: stateToJson(state),
          },
        });
      }
      return { simulation, device: updatedDevice };
    });
    if (!updated) {
      // Row deleted (device/user cascade) or no longer RUNNING: stop the orphaned ticker.
      void this.scheduler.stop(simulationId);
      this.lastSnapshotAt.delete(simulationId);
      this.lastTelemetryAt.delete(simulationId);
      return;
    }
    if (shouldSaveHistory) {
      this.lastSnapshotAt.set(simulationId, timestamp.getTime());
    }
    if (shouldSaveTelemetry) {
      this.lastTelemetryAt.set(simulationId, timestamp.getTime());
    }
    this.gateway.publishState(
      this.toSession(updated.simulation),
      state,
      updated.simulation.device.ownerId,
      timestamp,
    );
    void this.publishThingsboardTelemetry(updated.device, state);
  }

  private async publishThingsboardTelemetry(
    device: Device,
    state: SimulationState,
  ): Promise<void> {
    if (!this.thingsboard.isEnabled() || !device.thingsboardDeviceId) {
      return;
    }
    try {
      await this.thingsboard.publishTelemetry(device.thingsboardDeviceId, {
        roomTemperature: state.roomTemperature,
        outsideTemperature: state.outsideTemperature,
        targetTemperature: state.targetTemperature,
        humidity: state.roomHumidity,
        acState: state.acPower,
        compressorState: state.compressorState,
        powerConsumption: state.powerWatts,
        energyConsumption: state.energyKwh,
      });
    } catch (error) {
      this.logger.error(
        `ThingsBoard telemetry publishing failed for ${device.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private publishLifecycle(
    event: 'started' | 'paused' | 'resumed' | 'stopped' | 'reset',
    simulation: SimulationRecord,
    state: SimulationState,
  ) {
    this.gateway.publishLifecycle(
      event,
      this.toSession(simulation),
      state,
      simulation.device.ownerId,
    );
  }

  private toSession(simulation: {
    id: string;
    deviceId: string;
    status: string;
    config: Prisma.JsonValue;
    currentState: Prisma.JsonValue;
    startedAt: Date | null;
  }) {
    const state = stateFromJson(simulation.currentState);
    const config = configFromJson(simulation.config);
    return {
      id: simulation.id,
      deviceId: simulation.deviceId,
      status:
        simulation.status === 'CREATED'
          ? 'idle'
          : simulation.status === 'STOPPED'
            ? 'finished'
            : simulation.status.toLowerCase(),
      speed: config.simulationSpeed,
      elapsedSec: state.simulationTime,
      simulatedTime: new Date(
        (simulation.startedAt?.getTime() ?? Date.now()) +
          state.simulationTime * 1000,
      ).toISOString(),
      startedAt: simulation.startedAt?.toISOString() ?? null,
    };
  }

  private async latestForDevice(
    ownerId: string,
    deviceId?: string,
    statuses?: SimulationStatus[],
  ) {
    const where: SimulationWhereInput = {
      device: {
        is: {
          ownerId,
          ...(deviceId ? { id: deviceId } : {}),
        },
      },
      ...(statuses ? { status: { in: statuses } } : {}),
    };
    return this.prisma.simulation.findFirst({
      where,
      include: { device: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async latestRequired(
    ownerId: string,
    deviceId: string | undefined,
    statuses: SimulationStatus[],
  ) {
    const simulation = await this.latestForDevice(ownerId, deviceId, statuses);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }
    return simulation;
  }

  private async createLegacySimulation(
    ownerId: string,
    input: StartSimulationDto,
  ) {
    const device = await this.findOwnedDevice(input.deviceId, ownerId);
    const latest = await this.latestForDevice(ownerId, input.deviceId, [
      'CREATED',
      'RUNNING',
      'PAUSED',
    ]);
    if (latest) {
      const status = this.requireStatus(latest.status);
      if (status === 'RUNNING') {
        return latest;
      }
      if (status === 'PAUSED') {
        return this.resumeSimulation(ownerId, latest.id);
      }
      return this.startSimulation(ownerId, latest.id);
    }

    const environment = input.environment;
    const config = deviceConfig(device);
    const createInput: CreateSimulationDto = {
      name: `${device.name} simulation`,
      deviceId: device.id,
      config: {
        targetTemperature: input.targetTemperature ?? input.targetTempC,
        mode: input.mode,
        fanSpeed: input.fanSpeed,
        simulationSpeed: input.speed,
        outsideTemperature: environment?.outsideTempC,
        roomVolume:
          environment?.areaM2 && environment.heightM
            ? environment.areaM2 * environment.heightM
            : config.roomVolume,
        heatLoadKw:
          environment?.heatGainW === undefined
            ? config.heatLoadKw
            : environment.heatGainW / 1000,
      },
    };
    const created = await this.create(ownerId, createInput);
    return this.startSimulation(ownerId, created.id);
  }

  async start(ownerId: string, input: StartSimulationDto) {
    return this.toSession(await this.createLegacySimulation(ownerId, input));
  }

  async pause(ownerId: string, deviceId?: string) {
    const simulation = await this.latestRequired(ownerId, deviceId, [
      'RUNNING',
    ]);
    return this.toSession(await this.pauseSimulation(ownerId, simulation.id));
  }

  async resume(ownerId: string, deviceId?: string) {
    const simulation = await this.latestRequired(ownerId, deviceId, ['PAUSED']);
    return this.toSession(await this.resumeSimulation(ownerId, simulation.id));
  }

  async stop(ownerId: string, deviceId?: string) {
    const simulation = await this.latestRequired(ownerId, deviceId, [
      'RUNNING',
      'PAUSED',
    ]);
    return this.toSession(await this.stopSimulation(ownerId, simulation.id));
  }

  async reset(ownerId: string, deviceId?: string) {
    const simulation = await this.latestRequired(ownerId, deviceId, [
      'CREATED',
      'RUNNING',
      'PAUSED',
      'STOPPED',
    ]);
    return this.toSession(await this.resetSimulation(ownerId, simulation.id));
  }

  async getSession(ownerId: string, deviceId?: string) {
    const simulation = await this.latestForDevice(ownerId, deviceId, [
      'RUNNING',
      'PAUSED',
      'STOPPED',
    ]);
    return simulation ? this.toSession(simulation) : null;
  }

  async setSpeed(ownerId: string, input: SimulationSpeedDto) {
    const simulation = await this.latestRequired(ownerId, input.deviceId, [
      'RUNNING',
    ]);
    return this.toSession(
      await this.updateConfig(ownerId, simulation.id, {
        simulationSpeed: input.speed,
      }),
    );
  }

  async updateEnvironment(
    ownerId: string,
    input: SimulationEnvironmentUpdateDto,
  ) {
    const device = await this.findOwnedDevice(input.deviceId, ownerId);
    const updatedDevice = await this.prisma.$transaction(
      async (transaction) => {
        const updated = await transaction.device.update({
          where: { id: device.id },
          data: {
            ...(input.roomTempC === undefined
              ? {}
              : { roomTemperature: input.roomTempC }),
            ...(input.targetTempC === undefined
              ? {}
              : { targetTemperature: input.targetTempC }),
            ...(input.outsideTempC === undefined
              ? {}
              : { outsideTemperature: input.outsideTempC }),
            ...(input.humidityPct === undefined
              ? {}
              : { roomHumidity: input.humidityPct }),
          },
        });
        await this.telemetry.saveGeneratedTelemetry(
          {
            deviceId: updated.id,
            simulationTime: updated.simulationTime,
            roomTemperature: updated.roomTemperature,
            targetTemperature: updated.targetTemperature,
            outsideTemperature: updated.outsideTemperature,
            roomHumidity: updated.roomHumidity,
            acPower: updated.acPower,
            compressorState: updated.compressorState,
            fanState: updated.fanState,
            coolingCapacity: updated.coolingCapacity,
            heatingCapacity: updated.heatingCapacity,
            powerWatts: updated.powerWatts,
            energyKwh: updated.energyKwh,
            operatingMode: updated.operatingMode,
            fanSpeed: updated.fanSpeed,
          },
          transaction,
        );
        return updated;
      },
    );
    await this.syncDeviceControl(device.id, deviceState(updatedDevice));
    void this.publishThingsboardTelemetry(
      updatedDevice,
      deviceState(updatedDevice),
    );
    return updatedDevice;
  }

  async getSeries(ownerId: string, deviceId?: string) {
    const simulation = await this.latestForDevice(ownerId, deviceId);
    if (!simulation) {
      return [];
    }
    const history = await this.getHistory(ownerId, simulation.id, 1000);
    return history.reverse().map((entry) => {
      const state = stateFromJson(entry.state);
      return {
        t: state.simulationTime,
        elapsedSec: state.simulationTime,
        time: entry.timestamp.toISOString(),
        roomTempC: state.roomTemperature,
        targetTempC: state.targetTemperature,
        outsideTempC: state.outsideTemperature,
        humidityPct: state.roomHumidity,
        powerW: state.powerWatts,
        energyKwh: state.energyKwh,
        compressorOn: state.compressorState,
        compressorModulation: state.compressorState ? 100 : 0,
        coolingKw: state.coolingCapacity,
      };
    });
  }
}
