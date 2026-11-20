export interface SimulationConfig {
  acType: 'INVERTER' | 'NON_INVERTER';

  roomVolume: number;
  outsideTemperature: number;
  initialRoomTemperature: number;

  targetTemperature: number;

  ratedCoolingCapacity: number;
  ratedHeatingCapacity?: number;
  ratedPowerWatts: number;

  heatLoadKw: number;

  thermostatDifferential: number;

  simulationSpeed: number;

  // Effective room heat capacity, including walls and furniture
  thermalCapacityKwhPerC: number;

  // Heat transfer between outside and inside, in kW/°C
  thermalConductanceKwPerC: number;

  // Electrical power consumed by indoor fan
  fanPowerWatts: number;
}
