import type {
  AcDevice,
  ComparisonResult,
  InsulationLevel,
  SimulationSample,
} from '@/types'
import { MODEL_CATALOG } from '@/utils/constants'
import { round } from '@/utils/format'
import { stepThermal } from './thermal'

export interface ComparisonConfig {
  outsideTempC: number
  initialRoomTempC: number
  targetTempC: number
  areaM2: number
  insulation: InsulationLevel
  capacityKw: number
  durationMin: number
  occupancy: number
  windowExposure: number
  heatGainW: number
  pricePerKwh: number
}

export const DEFAULT_COMPARISON_CONFIG: ComparisonConfig = {
  outsideTempC: 35,
  initialRoomTempC: 30,
  targetTempC: 24,
  areaM2: 22,
  insulation: 'average',
  capacityKw: 3.5,
  durationMin: 240,
  occupancy: 2,
  windowExposure: 0.3,
  heatGainW: 180,
  pricePerKwh: 0.24,
}

export interface ComparisonOutput {
  inverter: ComparisonResult
  fixed: ComparisonResult
  config: ComparisonConfig
}

function buildDevice(inverter: boolean, config: ComparisonConfig): AcDevice {
  const model =
    MODEL_CATALOG.find((m) => m.inverter === inverter && (inverter ? m.id === 'arc-12inv' : m.id === 'pulse-18std')) ??
    MODEL_CATALOG[0]

  return {
    id: inverter ? 'cmp-inverter' : 'cmp-fixed',
    key: 'sim',
    name: inverter ? 'Inverter AC' : 'Fixed-speed AC',
    modelId: model.id,
    modelName: model.name,
    brand: model.brand,
    type: model.type,
    inverter,
    coolingCapacityKw: config.capacityKw,
    // Fixed-speed compressors are less efficient per kW of cooling.
    ratedPowerW: Math.round(config.capacityKw * (inverter ? 338 : 402)),
    supportsHeating: false,
    targetRange: [16, 30],
    location: 'Comparison rig',
    createdAt: new Date().toISOString(),
    environment: {
      roomName: 'Reference room',
      areaM2: config.areaM2,
      heightM: 2.7,
      insulation: config.insulation,
      occupancy: config.occupancy,
      outsideTempC: config.outsideTempC,
      humidityPct: 52,
      windowExposure: config.windowExposure,
      heatGainW: config.heatGainW,
    },
    state: {
      power: true,
      mode: 'cool',
      fanSpeed: inverter ? 'auto' : 'high',
      targetTempC: config.targetTempC,
      roomTempC: config.initialRoomTempC,
      humidityPct: 52,
      outsideTempC: config.outsideTempC,
      compressorOn: false,
      compressorModulation: 0,
      powerW: 0,
      energyKwh: 0,
      coolingOutputKw: 0,
      online: true,
      updatedAt: new Date().toISOString(),
    },
    simulated: true,
  }
}

function runOne(inverter: boolean, config: ComparisonConfig): ComparisonResult {
  const device = buildDevice(inverter, config)
  const stepSec = 20
  const totalSec = config.durationMin * 60
  const sampleEvery = 60
  const series: SimulationSample[] = []
  const start = Date.now()

  let cycles = 0
  let modulationSum = 0
  let sampleCount = 0
  let timeToTargetMin: number | null = null
  const tailTemps: number[] = []

  for (let t = 0; t <= totalSec; t += stepSec) {
    const wasOn = device.state.compressorOn
    const result = stepThermal(device, stepSec)
    device.state = result.state
    if (result.state.compressorOn !== wasOn) cycles += 1
    modulationSum += result.state.compressorOn ? result.state.compressorModulation : 0
    sampleCount += 1

    if (timeToTargetMin == null && result.state.roomTempC <= config.targetTempC + 0.25) {
      timeToTargetMin = round(t / 60, 1)
    }
    const lastQuarter = t > totalSec * 0.7
    if (lastQuarter) tailTemps.push(result.state.roomTempC)

    if (t % sampleEvery === 0) {
      series.push({
        t: Math.round(t / 60),
        elapsedSec: t,
        time: new Date(start + t * 1000).toISOString(),
        roomTempC: result.state.roomTempC,
        targetTempC: result.state.targetTempC,
        outsideTempC: config.outsideTempC,
        powerW: result.state.powerW,
        energyKwh: round(result.state.energyKwh, 3),
        compressorOn: result.state.compressorOn,
        compressorModulation: result.state.compressorModulation,
        coolingKw: result.coolingKw,
      })
    }
  }

  const mean = tailTemps.reduce((a, b) => a + b, 0) / Math.max(1, tailTemps.length)
  const variance =
    tailTemps.reduce((acc, temp) => acc + (temp - mean) ** 2, 0) / Math.max(1, tailTemps.length)
  const energy = device.state.energyKwh
  const avgPower = series.reduce((acc, s) => acc + s.powerW, 0) / Math.max(1, series.length)

  return {
    label: inverter ? 'Inverter AC' : 'Fixed-speed AC',
    inverter,
    series,
    timeToTargetMin,
    totalEnergyKwh: round(energy, 2),
    avgPowerW: Math.round(avgPower),
    energyCost: round(energy * config.pricePerKwh, 2),
    tempStabilityC: round(Math.sqrt(variance), 2),
    compressorCycles: cycles,
    avgModulationPct: Math.round(modulationSum / Math.max(1, sampleCount)),
    operatingMin: config.durationMin,
  }
}

export function runComparison(config: ComparisonConfig): ComparisonOutput {
  return {
    inverter: runOne(true, config),
    fixed: runOne(false, config),
    config,
  }
}
