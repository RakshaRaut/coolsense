/* ------------------------------------------------------------------
   CoolSense domain types.
   These mirror the NestJS backend DTOs. When the API contract changes,
   update this single file — every service and component consumes it.
------------------------------------------------------------------ */

export type AcMode = 'cool' | 'heat' | 'dry' | 'fan' | 'auto'
export type FanSpeed = 'auto' | 'low' | 'medium' | 'high' | 'turbo'
export type DeviceType = 'split' | 'window' | 'portable' | 'cassette' | 'duct'
export type InsulationLevel = 'poor' | 'average' | 'good' | 'excellent'
export type SimulationStatus = 'idle' | 'running' | 'paused' | 'finished'
export type DataSource = 'backend' | 'mock'

export interface User {
  id: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'viewer'
  createdAt: string
}

export interface AuthSession {
  accessToken: string
  user: User
}

/* ---------------------------- Devices ---------------------------- */

export interface AcModel {
  id: string
  name: string
  brand: string
  type: DeviceType
  inverter: boolean
  coolingCapacityKw: number
  ratedPowerW: number
  supportsHeating: boolean
  /** Minimum / maximum selectable target temperature in °C */
  targetRange: [number, number]
}

export interface RoomEnvironment {
  roomName: string
  areaM2: number
  heightM: number
  insulation: InsulationLevel
  occupancy: number
  outsideTempC: number
  humidityPct: number
  /** 0–1 share of the room's heat gain that comes from sun-exposed glazing */
  windowExposure: number
  /** Extra internal heat sources in watts (appliances, equipment) */
  heatGainW: number
}

export interface DeviceState {
  power: boolean
  mode: AcMode
  fanSpeed: FanSpeed
  targetTempC: number
  roomTempC: number
  humidityPct: number
  outsideTempC: number
  compressorOn: boolean
  /** 0–100, only meaningful for inverter units */
  compressorModulation: number
  powerW: number
  energyKwh: number
  coolingOutputKw: number
  online: boolean
  updatedAt: string
}

export interface AcDevice {
  id: string
  key: string
  name: string
  modelId: string
  modelName: string
  brand: string
  type: DeviceType
  inverter: boolean
  coolingCapacityKw: number
  ratedPowerW: number
  supportsHeating: boolean
  targetRange: [number, number]
  location: string
  createdAt: string
  environment: RoomEnvironment
  state: DeviceState
  /** Whether the device is part of the running simulation */
  simulated: boolean
}

export interface Telemetry {
  deviceId: string
  timestamp: string
  roomTempC: number
  targetTempC: number
  outsideTempC: number
  humidityPct: number
  powerW: number
  energyKwh: number
  compressorOn: boolean
  compressorModulation: number
  coolingKw: number
}

export type CreateDeviceInput = {
  name: string
  key: string
  modelId: string
  location: string
  roomName: string
  areaM2: number
  initialRoomTempC: number
  outsideTempC: number
  humidityPct: number
  insulation: InsulationLevel
  occupancy: number
  windowExposure: number
  heatGainW: number
}

export type UpdateDeviceInput = Partial<CreateDeviceInput>

/* --------------------------- Control ---------------------------- */

export interface AcControlCommand {
  power?: boolean
  mode?: AcMode
  fanSpeed?: FanSpeed
  targetTempC?: number
}

export type AcControl = AcControlCommand

/* -------------------------- Simulation --------------------------- */

export interface SimulationConfig {
  deviceId: string
  speed: number
  environment: Omit<RoomEnvironment, 'roomName'> & { roomName?: string }
  targetTempC: number
  fanSpeed: FanSpeed
  mode: AcMode
}

export interface SimulationSession {
  id: string
  deviceId: string
  status: SimulationStatus
  speed: number
  elapsedSec: number
  simulatedTime: string
  startedAt: string | null
}

export interface SimulationSample {
  t: number
  elapsedSec: number
  time: string
  roomTempC: number
  targetTempC: number
  outsideTempC: number
  powerW: number
  energyKwh: number
  compressorModulation: number
  compressorOn: boolean
  coolingKw: number
}

export interface SimulationUpdate {
  session: SimulationSession
  sample: SimulationSample
  device: AcDevice
  source: DataSource
}

/* --------------------------- Analytics --------------------------- */

export interface AnalyticsPoint {
  time: string
  powerW: number
  energyKwh: number
  roomTempC: number
  targetTempC: number
  outsideTempC: number
  compressorRuntimeMin: number
  cost: number
}

export interface AnalyticsSummary {
  totalEnergyKwh: number
  avgPowerW: number
  peakPowerW: number
  estimatedCost: number
  compressorRuntimeMin: number
  coolingDurationMin: number
  avgRoomTempC: number
  avgTargetTempC: number
  avgDeltaC: number
  currency: string
  pricePerKwh: number
  source: DataSource
}

export interface AnalyticsRange {
  deviceId?: string
  days: number
  granularity: 'hour' | 'day' | 'week' | 'month'
}

export interface EnergyBucket {
  label: string
  energyKwh: number
  cost: number
  avgPowerW: number
}

export interface AnalyticsDataset {
  series: AnalyticsPoint[]
  summary: AnalyticsSummary
  hourly: EnergyBucket[]
  daily: EnergyBucket[]
  weekly: EnergyBucket[]
  monthly: EnergyBucket[]
  granularity: AnalyticsRange['granularity']
}

export interface ComparisonResult {
  label: string
  inverter: boolean
  series: SimulationSample[]
  timeToTargetMin: number | null
  totalEnergyKwh: number
  avgPowerW: number
  energyCost: number
  tempStabilityC: number
  compressorCycles: number
  avgModulationPct: number
  operatingMin: number
}

/* -------------------------- ThingsBoard -------------------------- */

export interface ThingsBoardTelemetry {
  roomTempC: number
  humidityPct: number
  outsideTempC: number
  targetTempC: number
  acState: boolean
  compressorState: boolean
  powerW: number
  energyKwh: number
  coolingCapacityKw: number
  timestamp: string
}

export interface ThingsBoardStatus {
  connected: boolean
  registered: boolean
  synchronized: boolean
  lastSyncAt: string | null
  lastTelemetryAt: string | null
  deviceKeyMasked: string
  errors: string[]
  telemetry: ThingsBoardTelemetry | null
  source: DataSource
}

/* --------------------------- Activity --------------------------- */

export type ActivityKind =
  | 'power'
  | 'target'
  | 'mode'
  | 'device'
  | 'simulation'
  | 'sync'
  | 'alert'

export interface Activity {
  id: string
  kind: ActivityKind
  message: string
  deviceId?: string
  deviceName?: string
  at: string
}

/* ---------------------------- Settings --------------------------- */

export interface AppSettings {
  theme: 'dark' | 'light'
  temperatureUnit: 'celsius' | 'fahrenheit'
  energyUnit: 'kwh' | 'wh'
  currency: 'USD' | 'EUR' | 'GBP' | 'INR' | 'BRL'
  defaultTimeRange: '1h' | '6h' | '24h' | '7d'
  simulationSpeed: number
  defaultRoomTempC: number
  defaultOutsideTempC: number
  defaultHumidityPct: number
  defaultTargetTempC: number
  pricePerKwh: number
  includeStandbyDraw: boolean
}

/* ----------------------- Connection status ----------------------- */

export type ConnectionState = 'connected' | 'connecting' | 'disconnected'

export interface ConnectionInfo {
  backend: ConnectionState
  thingsboard: ConnectionState
  source: DataSource
}

export interface DashboardSummary {
  totalDevices: number
  activeDevices: number
  avgRoomTempC: number
  totalPowerW: number
  totalEnergyKwh: number
  estimatedCost: number
  powerDeltaPct: number
  energyDeltaPct: number
  temperatureDeltaC: number
  source: DataSource
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
