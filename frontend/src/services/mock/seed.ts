import type { AcDevice, Activity, DeviceState, SimulationSample } from '@/types'
import { MODEL_CATALOG } from '@/utils/constants'
import { round } from '@/utils/format'
import { stepThermal } from './thermal'

/* ----------------------------- PRNG ----------------------------- */

function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function uid(prefix: string, rand: () => number): string {
  const chunk = Math.floor(rand() * 0xffffff)
    .toString(16)
    .padStart(6, '0')
  return `${prefix}-${chunk}`
}

/* ---------------------------- Devices --------------------------- */

interface SeedSpec {
  id: string
  name: string
  location: string
  modelId: string
  roomName: string
  areaM2: number
  heightM: number
  insulation: AcDevice['environment']['insulation']
  occupancy: number
  outsideTempC: number
  humidityPct: number
  windowExposure: number
  heatGainW: number
  power: boolean
  mode: DeviceState['mode']
  fanSpeed: DeviceState['fanSpeed']
  targetTempC: number
  roomTempC: number
  online: boolean
}

const SPECS: SeedSpec[] = [
  {
    id: 'ac-living',
    name: 'Living Room AC',
    location: 'Home · Ground floor',
    modelId: 'arc-12inv',
    roomName: 'Living Room',
    areaM2: 28,
    heightM: 2.8,
    insulation: 'good',
    occupancy: 2,
    outsideTempC: 34,
    humidityPct: 54,
    windowExposure: 0.35,
    heatGainW: 180,
    power: true,
    mode: 'cool',
    fanSpeed: 'auto',
    targetTempC: 23,
    roomTempC: 24.6,
    online: true,
  },
]

function baseState(spec: SeedSpec): DeviceState {
  return {
    power: spec.power,
    mode: spec.mode,
    fanSpeed: spec.fanSpeed,
    targetTempC: spec.targetTempC,
    roomTempC: spec.roomTempC,
    humidityPct: spec.humidityPct,
    outsideTempC: spec.outsideTempC,
    compressorOn: false,
    compressorModulation: 0,
    powerW: 0,
    energyKwh: 0,
    coolingOutputKw: 0,
    online: spec.online,
    updatedAt: new Date().toISOString(),
  }
}

export function seedDevices(): AcDevice[] {
  return SPECS.map((spec, index) => {
    const model = MODEL_CATALOG.find((m) => m.id === spec.modelId) ?? MODEL_CATALOG[0]
    return {
      id: spec.id,
      key: `cs-${spec.id.replace('ac-', '')}-${(1040 + index * 37).toString(16)}`,
      name: spec.name,
      modelId: model.id,
      modelName: model.name,
      brand: model.brand,
      type: model.type,
      inverter: model.inverter,
      coolingCapacityKw: model.coolingCapacityKw,
      ratedPowerW: model.ratedPowerW,
      supportsHeating: model.supportsHeating,
      targetRange: model.targetRange,
      location: spec.location,
      createdAt: new Date(Date.now() - (index + 3) * 86_400_000).toISOString(),
      environment: {
        roomName: spec.roomName,
        areaM2: spec.areaM2,
        heightM: spec.heightM,
        insulation: spec.insulation,
        occupancy: spec.occupancy,
        outsideTempC: spec.outsideTempC,
        humidityPct: spec.humidityPct,
        windowExposure: spec.windowExposure,
        heatGainW: spec.heatGainW,
      },
      state: baseState(spec),
      simulated: true,
    }
  })
}

/* ---------------------------- History --------------------------- */

const HISTORY_DAYS = 30
const STEP_FINE = 60 // last 3 h
const STEP_MEDIUM = 300 // 3 h – 24 h
const STEP_COARSE = 3600 // older days

function diurnalOutside(baseTemp: number, hourOfDay: number, dayIndex: number): number {
  const amp = 4.6 + (dayIndex % 3) * 0.7
  const peak = 15.5
  return round(baseTemp + amp * Math.cos(((hourOfDay - peak) / 24) * Math.PI * 2), 1)
}

/**
 * Replays the thermal model for the past 7 days so charts, analytics and the
 * live state agree with each other.
 */
export function buildHistory(device: AcDevice): { samples: SimulationSample[]; device: AcDevice } {
  const rand = mulberry32(hashSeed(device.id))
  const samples: SimulationSample[] = []
  const now = Date.now()
  const working: AcDevice = {
    ...device,
    environment: { ...device.environment },
    state: { ...device.state, humidityPct: 52, energyKwh: 0 },
  }

  const totalSec = HISTORY_DAYS * 86_400
  let t = -totalSec
  while (t <= 0) {
    const step = t > -10_800 ? STEP_FINE : t > -86_400 ? STEP_MEDIUM : STEP_COARSE
    const date = new Date(now + t * 1000)
    const hour = date.getHours() + date.getMinutes() / 60
    const dayIndex = Math.floor((totalSec + t) / 86_400)

    working.environment.outsideTempC = diurnalOutside(device.environment.outsideTempC - 1.5, hour, dayIndex)

    // Occupancy follows a plausible home schedule.
    const occupied = hour >= 7 && hour < 23 ? Math.max(1, device.environment.occupancy) : 0
    working.environment.occupancy = occupied
    // Some devices are switched off overnight.
    const scheduleOn = device.state.power && (hour >= 8 || hour >= 20 ? true : rand() > 0.35)

    working.state.power = scheduleOn
    const result = stepThermal(working, step)
    working.state = result.state

    {
      samples.push({
        t: Math.round(t / 60),
        elapsedSec: totalSec + t,
        time: date.toISOString(),
        roomTempC: result.state.roomTempC,
        targetTempC: result.state.targetTempC,
        outsideTempC: working.environment.outsideTempC,
        powerW: result.state.powerW,
        energyKwh: result.state.energyKwh,
        compressorOn: result.state.compressorOn,
        compressorModulation: result.state.compressorModulation,
        coolingKw: result.coolingKw,
      })
    }

    t += step
  }

  // "Today's" energy = everything accrued in the last 24 simulated hours.
  const dayAgo = now - 86_400_000
  const dayStartSample = samples.find((s) => new Date(s.time).getTime() >= dayAgo)
  const lastSample = samples[samples.length - 1]
  const todayEnergy = Math.max(0, (lastSample?.energyKwh ?? 0) - (dayStartSample?.energyKwh ?? 0))

  const liveState: DeviceState = {
    ...working.state,
    energyKwh: round(todayEnergy, 4),
    updatedAt: new Date().toISOString(),
  }

  return { samples, device: { ...working, state: liveState, simulated: device.simulated } }
}

/* --------------------------- Activities -------------------------- */

export function seedActivities(devices: AcDevice[]): Activity[] {
  const now = Date.now()
  const mk = (minutesAgo: number, kind: Activity['kind'], message: string, device?: AcDevice): Activity => ({
    id: `act-${kind}-${minutesAgo}-${Math.floor(now / 1000)}`,
    kind,
    message,
    deviceId: device?.id,
    deviceName: device?.name,
    at: new Date(now - minutesAgo * 60_000).toISOString(),
  })

  const primary = devices[0]
  const secondary = devices[1] ?? primary

  return [
    mk(4, 'power', 'Compressor resumed after temperature rose above target', primary),
    mk(18, 'target', 'Target temperature set to 22.0 °C', secondary),
    mk(42, 'mode', 'Operating mode changed to Cool', primary),
    mk(63, 'simulation', 'Simulation session completed — 30× speed, 24 min simulated'),
    mk(96, 'power', 'AC turned on', primary),
    mk(140, 'device', 'Device registered and provisioned in ThingsBoard', primary),
    mk(212, 'sync', 'Telemetry synchronized with ThingsBoard'),
    mk(268, 'power', 'AC turned off — room reached target temperature', secondary),
    mk(331, 'alert', 'Room temperature exceeded 28 °C before cooling started', primary),
    mk(405, 'device', 'Device firmware profile updated to v2.4.1', primary),
  ]
}

/** Convenience: deterministic identifier for newly created devices. */
export function newDeviceId(rand: () => number): string {
  return uid('ac', rand)
}

export function createRand(seed: string): () => number {
  return mulberry32(hashSeed(seed))
}
