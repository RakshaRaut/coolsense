import {
  AirVent,
  BatteryCharging,
  Building2,
  Droplets,
  Fan,
  Flame,
  Gauge,
  Leaf,
  Snowflake,
  Sparkles,
  Wind,
} from 'lucide-react'
import type {
  AcMode,
  AcModel,
  DeviceType,
  FanSpeed,
  InsulationLevel,
} from '@/types'

export const APP_NAME = 'CoolSense'
export const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1'
export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ??
  (import.meta.env.VITE_API_URL?.replace(/\/api\/v1\/?$/, '') ?? '')
export const IS_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'false') !== 'false'

export const MODEL_CATALOG: AcModel[] = [
  {
    id: 'arc-12inv',
    name: 'Arctic Breeze 1.5T',
    brand: 'CoolSense Labs',
    type: 'split',
    inverter: true,
    coolingCapacityKw: 3.5,
    ratedPowerW: 1180,
    supportsHeating: true,
    targetRange: [16, 30],
  },
  {
    id: 'arc-10inv',
    name: 'Arctic Drift 1.0T',
    brand: 'CoolSense Labs',
    type: 'split',
    inverter: true,
    coolingCapacityKw: 2.6,
    ratedPowerW: 860,
    supportsHeating: true,
    targetRange: [16, 30],
  },
  {
    id: 'pulse-18std',
    name: 'Pulse Cool 1.8T',
    brand: 'Ventara',
    type: 'split',
    inverter: false,
    coolingCapacityKw: 4.2,
    ratedPowerW: 1520,
    supportsHeating: false,
    targetRange: [17, 30],
  },
  {
    id: 'pulse-12std',
    name: 'Pulse Mini 1.2T',
    brand: 'Ventara',
    type: 'window',
    inverter: false,
    coolingCapacityKw: 3.0,
    ratedPowerW: 1190,
    supportsHeating: false,
    targetRange: [17, 30],
  },
  {
    id: 'nova-cass',
    name: 'Nova Cassette 2.0T',
    brand: 'Northair',
    type: 'cassette',
    inverter: true,
    coolingCapacityKw: 5.2,
    ratedPowerW: 1640,
    supportsHeating: true,
    targetRange: [16, 30],
  },
  {
    id: 'nomad-port',
    name: 'Nomad Portable 0.9T',
    brand: 'Ventara',
    type: 'portable',
    inverter: false,
    coolingCapacityKw: 2.3,
    ratedPowerW: 980,
    supportsHeating: false,
    targetRange: [18, 30],
  },
  {
    id: 'zen-duct',
    name: 'Zen Duct 3.0T',
    brand: 'Northair',
    type: 'duct',
    inverter: true,
    coolingCapacityKw: 7.0,
    ratedPowerW: 2260,
    supportsHeating: true,
    targetRange: [16, 28],
  },
]

export const MODE_META: Record<
  AcMode,
  { label: string; icon: typeof Snowflake; hint: string }
> = {
  cool: { label: 'Cool', icon: Snowflake, hint: 'Removes heat from the room' },
  heat: { label: 'Heat', icon: Flame, hint: 'Heat pump mode — models with heating support only' },
  dry: { label: 'Dry', icon: Droplets, hint: 'Dehumidifies with gentle cooling' },
  fan: { label: 'Fan', icon: Fan, hint: 'Circulates air without cooling' },
  auto: { label: 'Auto', icon: Sparkles, hint: 'Chooses cooling or heating to hold the target' },
}

export const FAN_META: Record<FanSpeed, { label: string; powerW: number; airflow: number }> = {
  auto: { label: 'Auto', powerW: 0, airflow: 0.62 },
  low: { label: 'Low', powerW: 12, airflow: 0.42 },
  medium: { label: 'Medium', powerW: 24, airflow: 0.68 },
  high: { label: 'High', powerW: 38, airflow: 0.88 },
  turbo: { label: 'Turbo', powerW: 52, airflow: 1 },
}

export const MODE_META_LIST = (Object.keys(MODE_META) as AcMode[]).map((value) => ({
  value,
  ...MODE_META[value],
}))

export const FAN_LIST = (Object.keys(FAN_META) as FanSpeed[]).map((value) => ({
  value,
  label: FAN_META[value].label,
}))

export const DEVICE_TYPE_LABEL: Record<DeviceType, string> = {
  split: 'Split system',
  window: 'Window unit',
  portable: 'Portable unit',
  cassette: 'Cassette',
  duct: 'Ducted system',
}

export const INSULATION_META: Record<
  InsulationLevel,
  { label: string; uValue: number; description: string; icon: typeof Leaf }
> = {
  poor: { label: 'Poor', uValue: 4.2, description: 'Single glazing, uninsulated walls', icon: Wind },
  average: { label: 'Average', uValue: 2.6, description: 'Standard construction, some draughts', icon: Building2 },
  good: { label: 'Good', uValue: 1.5, description: 'Double glazing, insulated cavity', icon: Leaf },
  excellent: { label: 'Excellent', uValue: 0.9, description: 'Passive-house grade envelope', icon: BatteryCharging },
}

export const INSULATION_LIST = (Object.keys(INSULATION_META) as InsulationLevel[]).map((value) => ({
  value,
  ...INSULATION_META[value],
}))

export const SIM_SPEEDS = [
  { value: 1, label: '1×', hint: 'real time' },
  { value: 5, label: '5×', hint: '' },
  { value: 30, label: '30×', hint: 'default' },
  { value: 60, label: '60×', hint: '' },
  { value: 120, label: '120×', hint: 'fast' },
]

/** Ambient devices advance at this rate so the dashboard always feels alive. */
export const AMBIENT_SIM_SPEED = 12

export const TIME_RANGES = [
  { value: '1h', label: '1H', seconds: 3600 },
  { value: '6h', label: '6H', seconds: 6 * 3600 },
  { value: '24h', label: '24H', seconds: 24 * 3600 },
  { value: '7d', label: '7D', seconds: 7 * 24 * 3600 },
] as const

export const CHART_COLORS = {
  room: '#38BDF8',
  target: '#818CF8',
  outside: '#94A3B8',
  power: '#F59E0B',
  energy: '#22C55E',
  compressor: '#0EA5E9',
  cost: '#A78BFA',
  danger: '#EF4444',
}

export const DEVICE_ICONS = { AirVent, Gauge }
