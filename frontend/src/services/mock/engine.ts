import type {
  AcControlCommand,
  AcDevice,
  Activity,
  AnalyticsDataset,
  AnalyticsPoint,
  CreateDeviceInput,
  DeviceState,
  EnergyBucket,
  SimulationConfig,
  SimulationSample,
  SimulationSession,
  SimulationUpdate,
  Telemetry,
  ThingsBoardStatus,
  UpdateDeviceInput,
} from '@/types'
import { AMBIENT_SIM_SPEED, MODEL_CATALOG } from '@/utils/constants'
import { clamp, round } from '@/utils/format'
import { TypedEmitter } from '../socketEvents'
import { buildHistory, createRand, newDeviceId, seedActivities, seedDevices } from './seed'
import { readStore, writeStore } from './storage'
import { stepThermal } from './thermal'

const TICK_MS = 1000
// Bumped to v2 so browsers holding the old multi-AC seed get the single-device set.
const DEVICES_KEY = 'devices:v2'
const ACTIVITIES_KEY = 'activities:v2'
const MAX_ACTIVITIES = 80

function iso(offsetMs = 0): string {
  return new Date(Date.now() - offsetMs).toISOString()
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** History sample annotated with its wall-clock timestamp and integration window. */
type AnalyticsPointSample = SimulationSample & { ts: number; durSec: number }

export class MockEngine {
  devices: AcDevice[] = []
  activities: Activity[] = []
  session: SimulationSession | null = null
  emitter = new TypedEmitter()

  private history = new Map<string, SimulationSample[]>()
  private sessionSeries: SimulationSample[] = []
  private tickCount = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private pricePerKwh = 0.24
  private thingsboard: ThingsBoardStatus | null = null
  private startSnapshot: { environment: AcDevice['environment']; state: DeviceState } | null = null
  private rand = createRand('coolsense-engine')

  init(): void {
    if (this.devices.length > 0) return

    const persisted = readStore<AcDevice[]>(DEVICES_KEY)
    const base = persisted && persisted.length > 0 ? persisted : seedDevices()

    this.devices = base.map((device) => {
      const { samples, device: hydrated } = buildHistory(device)
      this.history.set(hydrated.id, samples)
      return hydrated
    })

    const storedActivities = readStore<Activity[]>(ACTIVITIES_KEY)
    this.activities = storedActivities ?? seedActivities(this.devices)

    this.thingsboard = this.buildThingsBoardStatus(this.devices[0])
    this.startClock()
  }

  destroy(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private startClock(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  /* --------------------------- Devices --------------------------- */

  listDevices(): AcDevice[] {
    return clone(this.devices)
  }

  getDevice(id: string): AcDevice | undefined {
    const device = this.devices.find((d) => d.id === id)
    return device ? clone(device) : undefined
  }

  createDevice(input: CreateDeviceInput): AcDevice {
    const model = MODEL_CATALOG.find((m) => m.id === input.modelId) ?? MODEL_CATALOG[0]
    const device: AcDevice = {
      id: newDeviceId(this.rand),
      key: input.key,
      name: input.name,
      modelId: model.id,
      modelName: model.name,
      brand: model.brand,
      type: model.type,
      inverter: model.inverter,
      coolingCapacityKw: model.coolingCapacityKw,
      ratedPowerW: model.ratedPowerW,
      supportsHeating: model.supportsHeating,
      targetRange: model.targetRange,
      location: input.location,
      createdAt: new Date().toISOString(),
      environment: {
        roomName: input.roomName,
        areaM2: input.areaM2,
        heightM: 2.7,
        insulation: input.insulation,
        occupancy: input.occupancy,
        outsideTempC: input.outsideTempC,
        humidityPct: input.humidityPct,
        windowExposure: input.windowExposure,
        heatGainW: input.heatGainW,
      },
      state: {
        power: false,
        mode: 'cool',
        fanSpeed: 'auto',
        targetTempC: clamp(24, model.targetRange[0], model.targetRange[1]),
        roomTempC: input.initialRoomTempC,
        humidityPct: input.humidityPct,
        outsideTempC: input.outsideTempC,
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

    this.devices = [...this.devices, device]
    this.history.set(device.id, [])
    this.persist()
    this.log('device', `Device "${device.name}" registered as ${device.modelName}`, device)
    this.emitter.emit('device:updated', clone(device))
    if (this.thingsboard) this.syncThingsBoard(true)
    return clone(device)
  }

  updateDevice(id: string, input: UpdateDeviceInput): AcDevice {
    const device = this.devices.find((d) => d.id === id)
    if (!device) throw new Error('Device not found')

    const model = input.modelId
      ? MODEL_CATALOG.find((m) => m.id === input.modelId)
      : MODEL_CATALOG.find((m) => m.id === device.modelId)

    if (model) {
      device.modelId = model.id
      device.modelName = model.name
      device.brand = model.brand
      device.type = model.type
      device.inverter = model.inverter
      device.coolingCapacityKw = model.coolingCapacityKw
      device.ratedPowerW = model.ratedPowerW
      device.supportsHeating = model.supportsHeating
      device.targetRange = model.targetRange
    }

    if (input.name) device.name = input.name
    if (input.key) device.key = input.key
    if (input.location) device.location = input.location
    if (input.roomName) device.environment.roomName = input.roomName
    if (input.areaM2 != null) device.environment.areaM2 = input.areaM2
    if (input.insulation) device.environment.insulation = input.insulation
    if (input.occupancy != null) device.environment.occupancy = input.occupancy
    if (input.outsideTempC != null) {
      device.environment.outsideTempC = input.outsideTempC
      device.state.outsideTempC = input.outsideTempC
    }
    if (input.humidityPct != null) {
      device.environment.humidityPct = input.humidityPct
      device.state.humidityPct = input.humidityPct
    }
    if (input.windowExposure != null) device.environment.windowExposure = input.windowExposure
    if (input.heatGainW != null) device.environment.heatGainW = input.heatGainW
    if (input.initialRoomTempC != null) device.state.roomTempC = input.initialRoomTempC

    this.persist()
    this.log('device', `Configuration updated for "${device.name}"`, device)
    const snapshot = clone(device)
    this.emitter.emit('device:updated', snapshot)
    return snapshot
  }

  deleteDevice(id: string): void {
    const device = this.devices.find((d) => d.id === id)
    this.devices = this.devices.filter((d) => d.id !== id)
    this.history.delete(id)
    if (this.session?.deviceId === id) {
      this.session = { ...this.session, status: 'idle' }
      this.sessionSeries = []
    }
    this.persist()
    if (device) this.log('device', `Device "${device.name}" removed`, device)
    this.emitter.emit('device:deleted', { id })
  }

  control(id: string, command: AcControlCommand): AcDevice {
    const device = this.devices.find((d) => d.id === id)
    if (!device) throw new Error('Device not found')
    if (!device.state.online) throw new Error('Device is offline')

    const before = device.state
    if (command.power != null) device.state.power = command.power
    if (command.mode != null) {
      if (command.mode === 'heat' && !device.supportsHeating) {
        throw new Error(`${device.modelName} does not support heating`)
      }
      device.state.mode = command.mode
    }
    if (command.fanSpeed != null) device.state.fanSpeed = command.fanSpeed
    if (command.targetTempC != null) {
      device.state.targetTempC = round(
        clamp(command.targetTempC, device.targetRange[0], device.targetRange[1]),
        1,
      )
    }
    device.state.updatedAt = new Date().toISOString()

    if (command.power != null && command.power !== before.power) {
      this.log('power', `AC turned ${command.power ? 'on' : 'off'}`, device)
    }
    if (command.targetTempC != null && command.targetTempC !== before.targetTempC) {
      this.log('target', `Target temperature set to ${device.state.targetTempC.toFixed(1)} °C`, device)
    }
    if (command.mode != null && command.mode !== before.mode) {
      this.log('mode', `Operating mode changed to ${command.mode}`, device)
    }

    const snapshot = clone(device)
    this.persist()
    this.emitter.emit('device:updated', snapshot)
    return snapshot
  }

  /* ------------------------- Simulation ------------------------- */

  getSession(): SimulationSession | null {
    return this.session ? { ...this.session } : null
  }

  getSessionSeries(): SimulationSample[] {
    return clone(this.sessionSeries)
  }

  startSimulation(config: SimulationConfig): SimulationSession {
    const device = this.devices.find((d) => d.id === config.deviceId)
    if (!device) throw new Error('Select a device before starting a simulation')

    this.startSnapshot = { environment: clone(device.environment), state: clone(device.state) }

    device.environment = {
      ...device.environment,
      ...config.environment,
      roomName: config.environment.roomName ?? device.environment.roomName,
    }
    device.state.targetTempC = clamp(config.targetTempC, device.targetRange[0], device.targetRange[1])
    device.state.fanSpeed = config.fanSpeed
    device.state.mode = config.mode
    device.state.outsideTempC = config.environment.outsideTempC
    device.state.power = true

    const session: SimulationSession = {
      id: `sim-${Date.now().toString(36)}`,
      deviceId: device.id,
      status: 'running',
      speed: config.speed,
      elapsedSec: 0,
      simulatedTime: '00:00',
      startedAt: new Date().toISOString(),
    }
    this.session = session
    this.sessionSeries = []
    this.log('simulation', `Simulation started on "${device.name}" at ${config.speed}× speed`, device)
    this.emitter.emit('simulation:started', { ...session })
    this.emitter.emit('device:updated', clone(device))
    return { ...session }
  }

  pauseSimulation(): SimulationSession {
    if (!this.session) throw new Error('No active simulation')
    this.session = { ...this.session, status: 'paused' }
    this.log('simulation', 'Simulation paused', this.deviceOf(this.session.deviceId))
    this.emitter.emit('simulation:paused', { ...this.session })
    return { ...this.session }
  }

  resumeSimulation(): SimulationSession {
    if (!this.session) throw new Error('No active simulation')
    this.session = { ...this.session, status: 'running' }
    this.log('simulation', 'Simulation resumed', this.deviceOf(this.session.deviceId))
    this.emitter.emit('simulation:resumed', { ...this.session })
    return { ...this.session }
  }

  stopSimulation(): SimulationSession {
    if (!this.session) throw new Error('No active simulation')
    this.session = { ...this.session, status: 'idle' }
    this.log('simulation', 'Simulation stopped', this.deviceOf(this.session.deviceId))
    this.emitter.emit('simulation:stopped', { ...this.session })
    return { ...this.session }
  }

  resetSimulation(): SimulationSession {
    if (!this.session) throw new Error('No active simulation')
    const device = this.devices.find((d) => d.id === this.session?.deviceId)
    if (device && this.startSnapshot) {
      device.environment = clone(this.startSnapshot.environment)
      device.state = clone(this.startSnapshot.state)
      this.emitter.emit('device:updated', clone(device))
    }
    this.sessionSeries = []
    this.session = { ...this.session, elapsedSec: 0, simulatedTime: '00:00', status: 'idle' }
    this.log('simulation', 'Simulation environment reset to the starting configuration')
    this.emitter.emit('simulation:stopped', { ...this.session })
    return { ...this.session }
  }

  /** Live environment edits from the Simulation Lab — no activity log spam. */
  applyEnvironment(
    deviceId: string,
    patch: Partial<AcDevice['environment']> & { roomTempC?: number; targetTempC?: number },
  ): AcDevice {
    const device = this.devices.find((d) => d.id === deviceId)
    if (!device) throw new Error('Device not found')

    const { roomTempC, targetTempC, ...environment } = patch
    device.environment = { ...device.environment, ...environment }
    if (roomTempC != null) device.state.roomTempC = clamp(roomTempC, 4, 50)
    if (targetTempC != null) {
      device.state.targetTempC = round(
        clamp(targetTempC, device.targetRange[0], device.targetRange[1]),
        1,
      )
    }
    device.state.outsideTempC = device.environment.outsideTempC
    if (patch.humidityPct != null) device.state.humidityPct = patch.humidityPct
    device.state.updatedAt = new Date().toISOString()

    const snapshot = clone(device)
    this.emitter.emit('device:updated', snapshot)
    return snapshot
  }

  setSimulationSpeed(speed: number): SimulationSession {
    if (!this.session) throw new Error('No active simulation')
    this.session = { ...this.session, speed }
    return { ...this.session }
  }

  private deviceOf(id: string | undefined): AcDevice | undefined {
    return this.devices.find((d) => d.id === id)
  }

  /* -------------------------- Telemetry ------------------------- */

  getHistory(deviceId: string, rangeSeconds = 86_400, maxPoints = 120): SimulationSample[] {
    const all = this.history.get(deviceId) ?? []
    const cutoff = Date.now() - rangeSeconds * 1000
    const filtered = all.filter((s) => new Date(s.time).getTime() >= cutoff)
    return this.downsample(filtered, maxPoints)
  }

  getRecentSamples(deviceId: string, count = 20): SimulationSample[] {
    return clone((this.history.get(deviceId) ?? []).slice(-count))
  }

  /** Fleet-wide history aligned into fixed time buckets (sum power, mean temps). */
  fleetSeries(
    rangeSeconds = 86_400,
    buckets = 96,
  ): Array<{
    time: string
    roomTempC: number
    targetTempC: number
    outsideTempC: number
    powerW: number
    energyKwh: number
  }> {
    const now = Date.now()
    const from = now - rangeSeconds * 1000
    const bucketMs = (rangeSeconds * 1000) / buckets
    const agg = new Map<
      number,
      { room: number[]; target: number[]; outside: number[]; power: number[]; energy: number }
    >()

    this.devices.forEach((device) => {
      if (!device.state.online) return
      const samples = (this.history.get(device.id) ?? [])
        .filter((s) => new Date(s.time).getTime() >= from)
        .map((s) => ({ ...s, ts: new Date(s.time).getTime() }))
        .sort((a, b) => a.ts - b.ts)

      samples.forEach((sample, index) => {
        const next = samples[index + 1]
        const dtSec = next ? Math.max(1, Math.min(3600, (next.ts - sample.ts) / 1000)) : 60
        const key = Math.floor((sample.ts - from) / bucketMs)
        const entry = agg.get(key) ?? { room: [], target: [], outside: [], power: [], energy: 0 }
        entry.room.push(sample.roomTempC)
        entry.target.push(sample.targetTempC)
        entry.outside.push(sample.outsideTempC)
        entry.power.push(sample.powerW)
        entry.energy += (sample.powerW * dtSec) / 3_600_000
        agg.set(key, entry)
      })
    })

    const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)

    return Array.from(agg.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([key, entry]) => ({
        time: new Date(from + key * bucketMs).toISOString(),
        roomTempC: round(mean(entry.room), 1),
        targetTempC: round(mean(entry.target), 1),
        outsideTempC: round(mean(entry.outside), 1),
        powerW: Math.round(mean(entry.power)),
        energyKwh: round(entry.energy, 2),
      }))
  }

  private downsample(samples: SimulationSample[], maxPoints: number): SimulationSample[] {
    if (samples.length <= maxPoints) return clone(samples)
    const stride = samples.length / maxPoints
    const out: SimulationSample[] = []
    for (let i = 0; i < maxPoints; i += 1) {
      out.push(clone(samples[Math.min(samples.length - 1, Math.floor(i * stride))]))
    }
    return out
  }

  /* -------------------------- Analytics ------------------------- */

  setPrice(price: number): void {
    this.pricePerKwh = price
  }

  analytics(deviceId: string | undefined, days: number, price = this.pricePerKwh): AnalyticsDataset {
    const ids = deviceId ? [deviceId] : this.devices.map((d) => d.id)
    const fromMs = Date.now() - days * 86_400_000
    const points: AnalyticsPointSample[] = []

    // Integrate energy per device: samples from different devices share the same
    // wall-clock window, so a single merged series would collapse every interval.
    ids.forEach((id) => {
      const samples = (this.history.get(id) ?? [])
        .filter((s) => new Date(s.time).getTime() >= fromMs)
        .map((s) => ({ ...s, ts: new Date(s.time).getTime() }))
        .sort((a, b) => a.ts - b.ts)

      samples.forEach((sample, index) => {
        const next = samples[index + 1]
        const durSec = next ? Math.max(1, Math.min(3600, (next.ts - sample.ts) / 1000)) : 60
        points.push({ ...sample, durSec })
      })
    })

    points.sort((a, b) => a.ts - b.ts)

    const summary = this.summarize(points, price)
    const granularity: AnalyticsDataset['granularity'] = days <= 2 ? 'hour' : 'day'

    return {
      summary: { ...summary, source: 'mock' as const },
      series: this.bucketByHour(points),
      hourly: this.bucketEnergy(points, 'hour', price),
      daily: this.bucketEnergy(points, 'day', price),
      weekly: this.bucketEnergy(points, 'week', price),
      monthly: this.bucketEnergy(points, 'month', price),
      granularity,
    }
  }

  private summarize(
    points: AnalyticsPointSample[],
    price: number,
  ): Omit<AnalyticsDataset['summary'], 'source'> {
    let energyKwh = 0
    let powerSum = 0
    let peakPowerW = 0
    let compressorSec = 0
    let roomSum = 0
    let targetSum = 0

    points.forEach((p) => {
      energyKwh += (p.powerW * p.durSec) / 3_600_000
      powerSum += p.powerW
      peakPowerW = Math.max(peakPowerW, p.powerW)
      if (p.compressorOn) compressorSec += p.durSec
      roomSum += p.roomTempC
      targetSum += p.targetTempC
    })

    const avgRoom = points.length ? roomSum / points.length : 0
    const avgTarget = points.length ? targetSum / points.length : 0

    return {
      totalEnergyKwh: round(energyKwh, 2),
      avgPowerW: Math.round(points.length ? powerSum / points.length : 0),
      peakPowerW: Math.round(peakPowerW),
      estimatedCost: round(energyKwh * price, 2),
      compressorRuntimeMin: Math.round(compressorSec / 60),
      coolingDurationMin: Math.round(compressorSec / 60),
      avgRoomTempC: round(avgRoom, 1),
      avgTargetTempC: round(avgTarget, 1),
      avgDeltaC: round(avgRoom - avgTarget, 1),
      currency: 'USD',
      pricePerKwh: price,
    }
  }

  private bucketByHour(points: AnalyticsPointSample[]): AnalyticsPoint[] {
    const buckets = new Map<
      number,
      { power: number[]; energy: number; room: number[]; target: number[]; outside: number[]; runtime: number }
    >()
    points.forEach((p) => {
      const key = new Date(p.ts).setMinutes(0, 0, 0)
      const b = buckets.get(key) ?? { power: [], energy: 0, room: [], target: [], outside: [], runtime: 0 }
      b.power.push(p.powerW)
      b.energy += (p.powerW * p.durSec) / 3_600_000
      b.room.push(p.roomTempC)
      b.target.push(p.targetTempC)
      b.outside.push(p.outsideTempC)
      if (p.compressorOn) b.runtime += p.durSec / 60
      buckets.set(key, b)
    })
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)
    return Array.from(buckets.entries())
      .slice(-48)
      .map(([key, b]) => ({
        time: new Date(key).toISOString(),
        powerW: Math.round(avg(b.power)),
        energyKwh: round(b.energy, 2),
        roomTempC: round(avg(b.room), 1),
        targetTempC: round(avg(b.target), 1),
        outsideTempC: round(avg(b.outside), 1),
        compressorRuntimeMin: Math.round(b.runtime),
        cost: round(b.energy * this.pricePerKwh, 2),
      }))
  }

  private bucketEnergy(
    points: AnalyticsPointSample[],
    unit: 'hour' | 'day' | 'week' | 'month',
    price: number,
  ): EnergyBucket[] {
    const buckets = new Map<number, { energy: number; power: number[]; date: Date }>()

    points.forEach((p) => {
      const date = new Date(p.ts)
      const key =
        unit === 'hour'
          ? date.setMinutes(0, 0, 0)
          : unit === 'day'
            ? date.setHours(0, 0, 0, 0)
            : unit === 'week'
              ? date.setHours(0, 0, 0, 0) - date.getDay() * 86_400_000
              : new Date(date.getFullYear(), date.getMonth(), 1).getTime()

      const b = buckets.get(key) ?? { energy: 0, power: [], date: new Date(key) }
      b.energy += (p.powerW * p.durSec) / 3_600_000
      b.power.push(p.powerW)
      buckets.set(key, b)
    })

    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .slice(unit === 'hour' ? -24 : unit === 'day' ? -30 : unit === 'week' ? -8 : -6)
      .map(([key, b]) => {
        const d = new Date(key)
        const label =
          unit === 'hour'
            ? `${d.getHours().toString().padStart(2, '0')}:00`
            : unit === 'day'
              ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : unit === 'week'
                ? `Wk ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        return {
          label,
          energyKwh: round(b.energy, 2),
          cost: round(b.energy * price, 2),
          avgPowerW: Math.round(b.power.reduce((a, c) => a + c, 0) / Math.max(1, b.power.length)),
        }
      })
  }

  /* ------------------------ ThingsBoard ------------------------- */

  getThingsBoardStatus(): ThingsBoardStatus {
    if (!this.thingsboard) {
      this.thingsboard = this.buildThingsBoardStatus(this.devices[0])
    }
    return clone(this.thingsboard)
  }

  private buildThingsBoardStatus(device: AcDevice | undefined): ThingsBoardStatus {
    if (!device) {
      return {
        connected: false,
        registered: false,
        synchronized: false,
        lastSyncAt: null,
        lastTelemetryAt: null,
        deviceKeyMasked: '—',
        errors: ['No devices registered'],
        telemetry: null,
        source: 'mock',
      }
    }
    return {
      connected: true,
      registered: true,
      synchronized: true,
      lastSyncAt: iso(65_000),
      lastTelemetryAt: iso(4_000),
      deviceKeyMasked: `${device.key.slice(0, 4)}••••${device.key.slice(-2)}`,
      errors: [],
      telemetry: {
        roomTempC: device.state.roomTempC,
        humidityPct: device.state.humidityPct,
        outsideTempC: device.state.outsideTempC,
        targetTempC: device.state.targetTempC,
        acState: device.state.power,
        compressorState: device.state.compressorOn,
        powerW: device.state.powerW,
        energyKwh: device.state.energyKwh,
        coolingCapacityKw: device.coolingCapacityKw,
        timestamp: iso(4_000),
      },
      source: 'mock',
    }
  }

  syncThingsBoard(silent = false): ThingsBoardStatus {
    const device = this.devices.find((d) => d.id === this.session?.deviceId) ?? this.devices[0]
    this.thingsboard = {
      ...this.buildThingsBoardStatus(device),
      lastSyncAt: new Date().toISOString(),
      lastTelemetryAt: new Date().toISOString(),
      errors: device?.state.online ? [] : ['Device is offline — telemetry queued'],
    }
    if (!silent) this.log('sync', `Telemetry synchronized to ThingsBoard (${this.thingsboard.telemetry?.powerW ?? 0} W)`, device)
    this.emitter.emit('thingsboard:status', clone(this.thingsboard))
    return clone(this.thingsboard)
  }

  /* --------------------------- Activity ------------------------- */

  listActivities(): Activity[] {
    return clone(this.activities)
  }

  private log(kind: Activity['kind'], message: string, device?: AcDevice): void {
    const activity: Activity = {
      id: `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      message,
      deviceId: device?.id,
      deviceName: device?.name,
      at: new Date().toISOString(),
    }
    this.activities = [activity, ...this.activities].slice(0, MAX_ACTIVITIES)
    this.persist()
    this.emitter.emit('activity:new', activity)
  }

  /* ---------------------------- Tick ---------------------------- */

  private tick(): void {
    if (this.devices.length === 0) return
    const now = Date.now()

    this.devices.forEach((device) => {
      if (!device.state.online) return
      const isSession = this.session?.deviceId === device.id
      if (isSession && this.session?.status === 'paused') return

      const simSeconds =
        isSession && this.session?.status === 'running' ? this.session.speed : AMBIENT_SIM_SPEED

      const result = stepThermal(device, simSeconds)
      device.state = result.state

      const telemetry: Telemetry = {
        deviceId: device.id,
        timestamp: result.state.updatedAt,
        roomTempC: result.state.roomTempC,
        targetTempC: result.state.targetTempC,
        outsideTempC: device.environment.outsideTempC,
        humidityPct: result.state.humidityPct,
        powerW: result.state.powerW,
        energyKwh: result.state.energyKwh,
        compressorOn: result.state.compressorOn,
        compressorModulation: result.state.compressorModulation,
        coolingKw: result.coolingKw,
      }

      this.emitter.emit('telemetry:update', telemetry)
      this.emitter.emit('device:status', { deviceId: device.id, state: result.state })
      this.emitter.emit('device:updated', clone(device))

      if (isSession && this.session) {
        this.session = {
          ...this.session,
          elapsedSec: this.session.elapsedSec + simSeconds,
          simulatedTime: new Date(now).toISOString(),
        }
        const sample: SimulationSample = {
          t: Math.round(this.session.elapsedSec / 60),
          elapsedSec: this.session.elapsedSec,
          time: new Date(now).toISOString(),
          roomTempC: result.state.roomTempC,
          targetTempC: result.state.targetTempC,
          outsideTempC: device.environment.outsideTempC,
          powerW: result.state.powerW,
          energyKwh: result.state.energyKwh,
          compressorOn: result.state.compressorOn,
          compressorModulation: result.state.compressorModulation,
          coolingKw: result.coolingKw,
        }
        this.sessionSeries = [...this.sessionSeries, sample].slice(-900)

        const update: SimulationUpdate = {
          session: { ...this.session },
          sample,
          device: clone(device),
          source: 'mock',
        }
        this.emitter.emit('simulation:update', update)
      }
    })

    this.tickCount += 1
    if (this.tickCount % 5 === 0) {
      this.devices.forEach((device) => {
        if (!device.state.online) return
        const arr = this.history.get(device.id) ?? []
        arr.push({
          t: 0,
          elapsedSec: 0,
          time: new Date(now).toISOString(),
          roomTempC: device.state.roomTempC,
          targetTempC: device.state.targetTempC,
          outsideTempC: device.environment.outsideTempC,
          powerW: device.state.powerW,
          energyKwh: device.state.energyKwh,
          compressorOn: device.state.compressorOn,
          compressorModulation: device.state.compressorModulation,
          coolingKw: device.state.coolingOutputKw,
        })
        if (arr.length > 1600) arr.splice(0, arr.length - 1600)
        this.history.set(device.id, arr)
      })
    }

    if (this.tickCount % 30 === 0) this.persist()
  }

  private persist(): void {
    const storable = this.devices.map((device) => ({
      ...device,
      // Persist configuration + a coarse state snapshot; live values are rebuilt on load.
      state: device.state,
    }))
    writeStore(DEVICES_KEY, storable)
    writeStore(ACTIVITIES_KEY, this.activities.slice(0, 30))
  }
}

/** Single engine instance for the whole browser session. */
export const mockEngine = new MockEngine()
