export interface SimulationState {
  simulationTime: number;

  roomTemperature: number;
  roomHumidity: number;
  outsideTemperature: number;

  targetTemperature: number;

  acPower: boolean;
  compressorState: boolean;
  fanState: boolean;

  coolingCapacity: number;
  heatingCapacity: number;
  powerWatts: number;
  energyKwh: number;

  operatingMode: string;
  fanSpeed: string;
}
