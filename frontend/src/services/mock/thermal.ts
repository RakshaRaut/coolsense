import type { AcDevice, DeviceState, FanSpeed } from '@/types'
import { clamp, round } from '@/utils/format'
import { FAN_META, INSULATION_META } from '@/utils/constants'

/**
 * First-order lumped-capacitance room model.
 *
 *   C · dT/dt = Q_gain − Q_cooling + Q_heating
 *
 * This module is the mock stand-in for the backend simulation engine. All
 * components consume its output through the API/socket layer, so swapping in
 * the real NestJS engine requires no UI changes.
 */

const AIR_DENSITY = 1.2 // kg/m³
const AIR_HEAT_CAPACITY = 1005 // J/(kg·K)
const FURNISHING_FACTOR = 3.4 // walls, floor, furniture thermal inertia
const WALL_AREA_FACTOR = 4 // square room: 4 · √area · height

export const MAX_ROOM_TEMP = 50
export const MIN_ROOM_TEMP = 4

export interface ThermalStep {
  state: DeviceState
  coolingKw: number
  heatingKw: number
  compressorToggled: boolean
}

export function thermalMass(areaM2: number, heightM: number): number {
  return Math.max(45_000, areaM2 * heightM * AIR_DENSITY * AIR_HEAT_CAPACITY * FURNISHING_FACTOR)
}

export function envelopeConductance(device: AcDevice): number {
  const { areaM2, heightM, insulation } = device.environment
  const u = INSULATION_META[insulation].uValue
  return WALL_AREA_FACTOR * Math.sqrt(areaM2) * heightM * u
}

function fanAirflow(fan: FanSpeed, compressorOn: boolean): number {
  if (fan === 'auto') return compressorOn ? 0.74 : 0.5
  return FAN_META[fan].airflow
}

/**
 * Advances a single device by `dtSec` simulated seconds.
 * Returns a new state object — callers never mutate live state in place.
 */
export function stepThermal(device: AcDevice, dtSec: number): ThermalStep {
  const env = device.environment
  const prev = device.state
  const next: DeviceState = { ...prev }

  const capacityW = device.coolingCapacityKw * 1000
  const mass = thermalMass(env.areaM2, env.heightM)
  const conductance = envelopeConductance(device)

  let roomTemp = prev.roomTempC
  let humidity = prev.humidityPct
  let energyKwh = prev.energyKwh
  let compressorOn = prev.compressorOn
  let modulation = prev.compressorModulation
  let compressorToggled = false
  let coolingKw = 0
  let heatingKw = 0

  const coolingRequested =
    prev.power && (prev.mode === 'cool' || prev.mode === 'dry' || (prev.mode === 'auto' && roomTemp > prev.targetTempC + 0.2))
  const heatingRequested = prev.power && device.supportsHeating && (prev.mode === 'heat' || (prev.mode === 'auto' && roomTemp < prev.targetTempC - 0.2))

  const airflow = fanAirflow(prev.fanSpeed, compressorOn)
  const effectiveness = 0.94 + airflow * 0.08
  const fanPowerW = prev.power ? FAN_META[prev.fanSpeed].powerW : 0

  // Split the step into ≤20 s slices for numerical stability at high speeds.
  const substeps = Math.max(1, Math.ceil(dtSec / 20))
  const h = dtSec / substeps

  for (let i = 0; i < substeps; i += 1) {
    const error = roomTemp - prev.targetTempC

    const qEnvelope = conductance * (env.outsideTempC - roomTemp)
    const qSolar = env.windowExposure * 380
    const qOccupants = env.occupancy * 110
    const qInternal = env.heatGainW
    const qGain = qEnvelope + qSolar + qOccupants + qInternal

    if (coolingRequested) {
      if (device.inverter) {
        // Inverter units modulate continuously. The feed-forward term holds the
        // load once the set point is reached, so the controller has no droop.
        const loadPct = (qGain / Math.max(1, capacityW * effectiveness)) * 100
        modulation = clamp(loadPct + error * 60, 0, 100)
        if (error < -0.2) modulation = 0
        compressorOn = modulation > 6
      } else {
        // Fixed-speed units cycle on a hysteresis band.
        if (error > 0.45) compressorOn = true
        else if (error < -0.35) compressorOn = false
        modulation = compressorOn ? 100 : 0
      }
    } else if (heatingRequested) {
      if (device.inverter) {
        const heatError = prev.targetTempC - roomTemp
        const heatLoadPct = (-qGain / Math.max(1, capacityW * 0.92)) * 100
        modulation = clamp(heatLoadPct + heatError * 60, 0, 92)
        if (heatError < -0.2) modulation = 0
        compressorOn = modulation > 6
      } else {
        compressorOn = roomTemp < prev.targetTempC - 0.45 ? true : roomTemp > prev.targetTempC + 0.35 ? false : compressorOn
        modulation = compressorOn ? 100 : 0
      }
    } else {
      compressorOn = false
      modulation = 0
    }

    if (compressorOn !== prev.compressorOn) compressorToggled = true

    if (coolingRequested && compressorOn) {
      const dryFactor = prev.mode === 'dry' ? 0.38 : 1
      coolingKw = (capacityW * (modulation / 100) * effectiveness * dryFactor) / 1000
    } else {
      coolingKw = 0
    }

    if (heatingRequested && compressorOn) {
      heatingKw = (capacityW * 0.92 * (modulation / 100)) / 1000
    } else {
      heatingKw = 0
    }

    roomTemp += ((qGain - coolingKw * 1000 + heatingKw * 1000) / mass) * h
    roomTemp = clamp(roomTemp, MIN_ROOM_TEMP, MAX_ROOM_TEMP)

    const humidityTarget = coolingKw > 0 ? (prev.mode === 'dry' ? 38 : 44) : 55
    const humidityRate = coolingKw > 0 ? 0.0035 : 0.0009
    humidity += (humidityTarget - humidity) * Math.min(1, humidityRate * h)
  }

  const compressorPowerW = compressorOn ? device.ratedPowerW * (device.inverter ? 0.14 + 0.86 * (modulation / 100) : 1) : 0
  const powerW = prev.power ? compressorPowerW + fanPowerW : 0
  energyKwh += (powerW * dtSec) / 3_600_000

  next.roomTempC = round(roomTemp, 2)
  next.humidityPct = round(clamp(humidity, 20, 95), 1)
  next.outsideTempC = env.outsideTempC
  next.compressorOn = compressorOn
  next.compressorModulation = compressorOn ? Math.round(modulation) : 0
  next.powerW = Math.round(powerW)
  next.energyKwh = round(energyKwh, 4)
  next.coolingOutputKw = round(coolingKw, 2)
  next.updatedAt = new Date().toISOString()

  return { state: next, coolingKw: round(coolingKw, 2), heatingKw: round(heatingKw, 2), compressorToggled }
}

/** Instantaneous power without advancing time — used for telemetry snapshots. */
export function estimatePowerW(device: AcDevice): number {
  const { state } = device
  if (!state.power) return 0
  const fan = FAN_META[state.fanSpeed].powerW
  if (!state.compressorOn) return fan
  return Math.round(device.ratedPowerW * (device.inverter ? 0.14 + 0.86 * (state.compressorModulation / 100) : 1) + fan)
}
