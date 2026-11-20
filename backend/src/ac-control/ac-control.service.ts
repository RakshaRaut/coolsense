import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { Device, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { SimulationEngineService } from '../simulation/engine/simulation-engine.service.js';
import type { SimulationConfig } from '../simulation/models/simulation-config.model.js';
import type { SimulationState } from '../simulation/models/simulation-state.model.js';
import { SimulationGateway } from '../simulation/simulation.gateway.js';
import { SimulationService } from '../simulation/simulation.service.js';
import { TelemetryService } from '../telemetry/telemetry.service.js';
import { FanControlDto } from './dto/fan-control.dto.js';
import { AcControlCommandDto } from './dto/ac-control-command.dto.js';
import { ModeControlDto } from './dto/mode-control.dto.js';
import { PowerControlDto } from './dto/power-control.dto.js';
import { TemperatureControlDto } from './dto/temperature-control.dto.js';

@Injectable()
export class AcControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulationEngine: SimulationEngineService,
    private readonly simulationService: SimulationService,
    private readonly telemetry: TelemetryService,
    private readonly gateway: SimulationGateway,
  ) {}

  setPower(deviceId: string, ownerId: string, input: PowerControlDto) {
    return this.updateState(deviceId, ownerId, { acPower: input.power });
  }

  setTemperature(
    deviceId: string,
    ownerId: string,
    input: TemperatureControlDto,
  ) {
    return this.updateState(deviceId, ownerId, {
      targetTemperature: input.targetTemperature,
    });
  }

  setMode(deviceId: string, ownerId: string, input: ModeControlDto) {
    return this.updateState(deviceId, ownerId, {
      operatingMode: input.mode,
    });
  }

  setFanSpeed(deviceId: string, ownerId: string, input: FanControlDto) {
    return this.updateState(deviceId, ownerId, {
      fanSpeed: input.fanSpeed,
    });
  }

  applyCommand(deviceId: string, ownerId: string, input: AcControlCommandDto) {
    const targetTemperature = input.targetTemperature ?? input.targetTempC;
    const patch: Partial<SimulationState> = {
      ...(input.power === undefined ? {} : { acPower: input.power }),
      ...(input.mode === undefined ? {} : { operatingMode: input.mode }),
      ...(input.fanSpeed === undefined ? {} : { fanSpeed: input.fanSpeed }),
      ...(targetTemperature === undefined ? {} : { targetTemperature }),
    };

    if (Object.keys(patch).length === 0) {
      this.gateway.publishCommandStatus(
        ownerId,
        deviceId,
        false,
        patch,
        'At least one control field must be provided',
      );
      throw new BadRequestException(
        'At least one control field must be provided',
      );
    }

    return this.updateState(deviceId, ownerId, patch);
  }

  private async updateState(
    deviceId: string,
    ownerId: string,
    patch: Partial<SimulationState>,
  ) {
    try {
      const updated = await this.prisma.$transaction(async (transaction) => {
        const device = await transaction.device.findFirst({
          where: { id: deviceId, ownerId },
        });

        if (!device) {
          throw new NotFoundException('Device not found');
        }

        const configuredDevice: Device = {
          ...device,
          targetTemperature:
            patch.targetTemperature ?? device.targetTemperature,
        };
        const nextState = this.simulationEngine.step(
          { ...this.toSimulationState(device), ...patch },
          this.toSimulationConfig(configuredDevice),
          device.simulationSpeed,
        );

        const updatedDevice = await transaction.device.update({
          where: { id: device.id },
          data: {
            simulationTime: nextState.simulationTime,
            roomTemperature: nextState.roomTemperature,
            roomHumidity: nextState.roomHumidity,
            outsideTemperature: nextState.outsideTemperature,
            targetTemperature: nextState.targetTemperature,
            acPower: nextState.acPower,
            compressorState: nextState.compressorState,
            fanState: nextState.fanState,
            coolingCapacity: nextState.coolingCapacity,
            heatingCapacity: nextState.heatingCapacity,
            powerWatts: nextState.powerWatts,
            energyKwh: nextState.energyKwh,
            operatingMode: nextState.operatingMode,
            fanSpeed: nextState.fanSpeed,
          },
        });

        await this.telemetry.saveGeneratedTelemetry(
          this.toTelemetryData(updatedDevice),
          transaction,
        );

        return updatedDevice;
      });

      await this.simulationService.syncDeviceControl(
        updated.id,
        this.toSimulationState(updated),
      );
      const state = this.toSimulationState(updated);
      this.gateway.publishAcState(ownerId, updated.id, state);
      this.gateway.publishCommandStatus(ownerId, updated.id, true, patch);
      return updated;
    } catch (error) {
      this.gateway.publishCommandStatus(
        ownerId,
        deviceId,
        false,
        patch,
        error instanceof Error ? error.message : 'AC command failed',
      );
      throw error;
    }
  }

  private toTelemetryData(
    device: Device,
  ): Prisma.TelemetryUncheckedCreateInput {
    return {
      deviceId: device.id,
      simulationTime: device.simulationTime,
      roomTemperature: device.roomTemperature,
      targetTemperature: device.targetTemperature,
      outsideTemperature: device.outsideTemperature,
      roomHumidity: device.roomHumidity,
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

  private toSimulationConfig(device: Device): SimulationConfig {
    if (device.acType !== 'INVERTER' && device.acType !== 'NON_INVERTER') {
      throw new InternalServerErrorException('Device has an invalid AC type');
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

  private toSimulationState(device: Device): SimulationState {
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
}
