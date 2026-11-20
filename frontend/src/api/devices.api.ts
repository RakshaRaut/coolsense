import type {
  AcDevice,
  AcMode,
  CreateDeviceInput,
  FanSpeed,
  SimulationSample,
  UpdateDeviceInput,
} from '@/types'
import { IS_MOCK, MODEL_CATALOG } from '@/utils/constants'
import { mockEngine } from '@/services/mock/engine'
import { api, simulateLatency } from './axios'

export interface DeviceTemperatureSample {
  time: string
  roomTempC: number
  targetTempC: number
  outsideTempC: number
}

export interface BackendDevice {
  id: string
  name: string
  acType: string
  roomVolume: number
  outsideTemperature: number
  initialRoomTemperature: number
  targetTemperature: number
  ratedCoolingCapacity: number
  ratedHeatingCapacity: number
  ratedPowerWatts: number
  heatLoadKw: number
  simulationStatus: string
  roomTemperature: number
  roomHumidity: number
  acPower: boolean
  compressorState: boolean
  coolingCapacity: number
  powerWatts: number
  energyKwh: number
  operatingMode: string
  fanSpeed: string
  createdAt: string
  updatedAt: string
}

type BackendDeviceInput = {
  name?: string
  acType?: 'INVERTER' | 'NON_INVERTER'
  roomVolume?: number
  outsideTemperature?: number
  initialRoomTemperature?: number
  ratedCoolingCapacity?: number
  ratedHeatingCapacity?: number
  ratedPowerWatts?: number
  heatLoadKw?: number
  roomHumidity?: number
}

function toBackendInput(input: Partial<CreateDeviceInput>): BackendDeviceInput {
  const model = input.modelId
    ? MODEL_CATALOG.find((candidate) => candidate.id === input.modelId)
    : undefined
  if (input.modelId && !model) {
    throw new Error(`Unknown AC model: ${input.modelId}`)
  }

  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(model
      ? {
          acType: model.inverter ? 'INVERTER' : 'NON_INVERTER',
          ratedCoolingCapacity: model.coolingCapacityKw,
          ratedHeatingCapacity: model.supportsHeating ? model.coolingCapacityKw : 0,
          ratedPowerWatts: model.ratedPowerW,
        }
      : {}),
    ...(input.areaM2 !== undefined ? { roomVolume: input.areaM2 * 2.5 } : {}),
    ...(input.outsideTempC !== undefined
      ? { outsideTemperature: input.outsideTempC }
      : {}),
    ...(input.initialRoomTempC !== undefined
      ? { initialRoomTemperature: input.initialRoomTempC }
      : {}),
    ...(input.heatGainW !== undefined ? { heatLoadKw: input.heatGainW / 1000 } : {}),
    ...(input.humidityPct !== undefined ? { roomHumidity: input.humidityPct } : {}),
  }
}

const toMode = (value: string): AcMode => {
  const modes: Record<string, AcMode> = {
    COOL: 'cool',
    HEAT: 'heat',
    DRY: 'dry',
    FAN: 'fan',
    AUTO: 'auto',
  }
  return modes[value.toUpperCase()] ?? 'cool'
}

const toFanSpeed = (value: string): FanSpeed => {
  const speeds: Record<string, FanSpeed> = {
    AUTO: 'auto',
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    TURBO: 'turbo',
  }
  return speeds[value.toUpperCase()] ?? 'auto'
}

export function toAcDevice(value: AcDevice | BackendDevice): AcDevice {
  if ('state' in value) return value

  const inverter = value.acType === 'INVERTER'
  return {
    id: value.id,
    key: value.id,
    name: value.name,
    modelId: value.acType,
    modelName: inverter ? 'Inverter AC' : 'Standard AC',
    brand: 'CoolSense',
    type: 'split',
    inverter,
    coolingCapacityKw: value.ratedCoolingCapacity,
    ratedPowerW: value.ratedPowerWatts,
    supportsHeating: value.ratedHeatingCapacity > 0,
    targetRange: [16, 30],
    location: 'Room',
    createdAt: value.createdAt,
    environment: {
      roomName: value.name,
      areaM2: value.roomVolume / 2.5,
      heightM: 2.5,
      insulation: 'average',
      occupancy: 0,
      outsideTempC: value.outsideTemperature,
      humidityPct: value.roomHumidity,
      windowExposure: 0,
      heatGainW: value.heatLoadKw * 1000,
    },
    state: {
      power: value.acPower,
      mode: toMode(value.operatingMode),
      fanSpeed: toFanSpeed(value.fanSpeed),
      targetTempC: value.targetTemperature,
      roomTempC: value.roomTemperature,
      humidityPct: value.roomHumidity,
      outsideTempC: value.outsideTemperature,
      compressorOn: value.compressorState,
      compressorModulation: value.compressorState ? 100 : 0,
      powerW: value.powerWatts,
      energyKwh: value.energyKwh,
      coolingOutputKw: value.coolingCapacity,
      online: true,
      updatedAt: value.updatedAt,
    },
    simulated: value.simulationStatus === 'running',
  }
}

function mock() {
  mockEngine.init()
  return mockEngine
}

export async function listDevices(): Promise<AcDevice[]> {
  if (IS_MOCK) {
    await simulateLatency(220)
    return mock().listDevices()
  }
  const { data } = await api.get<Array<AcDevice | BackendDevice>>('/devices')
  return data.map(toAcDevice)
}

export async function getDevice(id: string): Promise<AcDevice> {
  if (IS_MOCK) {
    await simulateLatency(180)
    const device = mock().getDevice(id)
    if (!device) throw new Error('Device not found')
    return device
  }
  const { data } = await api.get<AcDevice | BackendDevice>(`/devices/${id}`)
  return toAcDevice(data)
}

export async function createDevice(input: CreateDeviceInput): Promise<AcDevice> {
  if (IS_MOCK) {
    await simulateLatency(420)
    return mock().createDevice(input)
  }
  const { data } = await api.post<BackendDevice>('/devices', toBackendInput(input))
  return toAcDevice(data)
}

export async function updateDevice(id: string, input: UpdateDeviceInput): Promise<AcDevice> {
  if (IS_MOCK) {
    await simulateLatency(320)
    return mock().updateDevice(id, input)
  }
  const { data } = await api.patch<BackendDevice>(`/devices/${id}`, toBackendInput(input))
  return toAcDevice(data)
}

export async function deleteDevice(id: string): Promise<void> {
  if (IS_MOCK) {
    await simulateLatency(260)
    mock().deleteDevice(id)
    return
  }
  await api.delete(`/devices/${id}`)
}

export async function getDeviceHistory(
  id: string,
  rangeSeconds = 86_400,
  maxPoints = 120,
): Promise<SimulationSample[]> {
  if (IS_MOCK) {
    await simulateLatency(160)
    return mock().getHistory(id, rangeSeconds, maxPoints)
  }
  const { data } = await api.get<SimulationSample[]>(`/devices/${id}/history`, {
    params: { range: rangeSeconds, limit: maxPoints },
  })
  return data
}

export async function getDeviceTemperatureHistory(
  id: string,
  rangeSeconds: number,
  limit = 1000,
): Promise<DeviceTemperatureSample[]> {
  if (IS_MOCK) {
    await simulateLatency(160)
    return mock().getHistory(id, rangeSeconds, limit)
  }

  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - rangeSeconds * 1000)
  const { data } = await api.get<{
    data: Array<{
      timestamp: string
      simulationTime: number
      roomTemperature: number
      targetTemperature: number
      outsideTemperature: number
      roomHumidity: number
    }>
  }>(`/devices/${id}/telemetry/temperature`, {
    params: {
      page: 1,
      limit,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  })

  return data.data.reverse().map((sample) => ({
    time: sample.timestamp,
    roomTempC: sample.roomTemperature,
    targetTempC: sample.targetTemperature,
    outsideTempC: sample.outsideTemperature,
  }))
}
