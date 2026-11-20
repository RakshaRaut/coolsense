import { Injectable } from '@nestjs/common';

import { SimulationState } from '../models/simulation-state.model.js';
import { SimulationConfig } from '../models/simulation-config.model.js';

import { updateCompressor } from '../utils/thermostat.util.js';
import {
  calculateCooling,
  calculateInverterCooling,
} from '../utils/cooling.util.js';
import { calculatePower, calculateInverterPower } from '../utils/power.util.js';
import { calculateEnergy } from '../utils/energy.util.js';

@Injectable()
export class SimulationEngineService {
  step(
    currentState: SimulationState,
    config: SimulationConfig,
    dtSeconds: number,
  ): SimulationState {
    if (dtSeconds <= 0) {
      throw new Error('dtSeconds must be greater than zero');
    }

    const acPower = currentState.acPower;
    const mode = currentState.operatingMode;
    const isFanOnlyMode = mode === 'FAN';
    const isHeatingMode =
      mode === 'HEAT' ||
      (mode === 'AUTO' &&
        currentState.roomTemperature < currentState.targetTemperature);

    let compressorState = false;

    if (acPower && !isFanOnlyMode) {
      compressorState = isHeatingMode
        ? updateCompressor(
            currentState.targetTemperature,
            currentState.roomTemperature,
            config.thermostatDifferential,
            currentState.compressorState,
          )
        : updateCompressor(
            currentState.roomTemperature,
            currentState.targetTemperature,
            config.thermostatDifferential,
            currentState.compressorState,
          );
    }

    let coolingCapacity = 0;
    let heatingCapacity = 0;

    if (acPower && compressorState && isHeatingMode) {
      const ratedHeatingCapacity =
        config.ratedHeatingCapacity ?? config.ratedCoolingCapacity;
      if (config.acType === 'NON_INVERTER') {
        heatingCapacity = ratedHeatingCapacity;
      } else {
        const heatingDemand = Math.max(
          0.2,
          Math.min(
            1,
            (currentState.targetTemperature - currentState.roomTemperature) / 8,
          ),
        );
        heatingCapacity = ratedHeatingCapacity * heatingDemand;
      }
    } else if (acPower && compressorState && !isHeatingMode) {
      if (config.acType === 'NON_INVERTER') {
        coolingCapacity = calculateCooling(
          compressorState,
          config.ratedCoolingCapacity,
        );
      } else {
        // Simple inverter demand model
        const temperatureDifference =
          currentState.roomTemperature - currentState.targetTemperature;

        const coolingDemand = Math.max(
          0.2,
          Math.min(1, temperatureDifference / 8),
        );

        coolingCapacity = calculateInverterCooling(
          compressorState,
          config.ratedCoolingCapacity,
          coolingDemand,
        );
      }
    }

    const outsideHeat =
      config.thermalConductanceKwPerC *
      (currentState.outsideTemperature - currentState.roomTemperature);

    const totalHeatLoad = outsideHeat + config.heatLoadKw;
    const netHeatLoad = totalHeatLoad + heatingCapacity - coolingCapacity;
    const temperatureChange =
      (netHeatLoad / config.thermalCapacityKwhPerC) * (dtSeconds / 3600);

    const roomTemperature = currentState.roomTemperature + temperatureChange;
    const elapsedMinutes = dtSeconds / 60;
    const dehumidificationRate = mode === 'DRY' ? 0.2 : 0.06;
    const humidityChange =
      -temperatureChange * 1.5 -
      (coolingCapacity > 0 ? dehumidificationRate * elapsedMinutes : 0) +
      (heatingCapacity > 0 ? 0.02 * elapsedMinutes : 0);
    const roomHumidity = Math.max(
      20,
      Math.min(90, currentState.roomHumidity + humidityChange),
    );

    let powerWatts = 0;

    if (acPower) {
      const fanPowerMultiplier =
        {
          LOW: 0.5,
          MEDIUM: 0.75,
          HIGH: 1.25,
          AUTO: 1,
          TURBO: 1.5,
        }[currentState.fanSpeed] ?? 1;
      const fanPowerWatts = config.fanPowerWatts * fanPowerMultiplier;

      if (config.acType === 'NON_INVERTER') {
        powerWatts = calculatePower(
          compressorState,
          config.ratedPowerWatts,
          fanPowerWatts,
        );
      } else {
        const activeCapacity = isHeatingMode
          ? heatingCapacity
          : coolingCapacity;
        const ratedCapacity = isHeatingMode
          ? (config.ratedHeatingCapacity ?? config.ratedCoolingCapacity)
          : config.ratedCoolingCapacity;
        powerWatts = calculateInverterPower(
          activeCapacity,
          ratedCapacity,
          config.ratedPowerWatts,
          fanPowerWatts,
        );
      }
    }

    const energyIncrement = calculateEnergy(powerWatts, dtSeconds);

    const energyKwh = currentState.energyKwh + energyIncrement;

    return {
      ...currentState,

      simulationTime: currentState.simulationTime + dtSeconds,

      roomTemperature,

      roomHumidity,

      outsideTemperature: config.outsideTemperature,

      targetTemperature: config.targetTemperature,

      acPower,

      compressorState,

      fanState: acPower,

      coolingCapacity,

      heatingCapacity,

      powerWatts,

      energyKwh,
    };
  }
}
