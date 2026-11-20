import type {
  AcDevice,
  Activity,
  DeviceState,
  SimulationSession,
  SimulationUpdate,
  Telemetry,
  ThingsBoardStatus,
} from '@/types'

/** Server → client events. Mirrors the NestJS Socket.IO gateway contract. */
export interface ServerEvents {
  'telemetry:update': Telemetry
  'simulation:telemetry': Telemetry & {
    simulationTime: number
    simulationId: string
  }
  'simulation:state': {
    simulationId: string
    deviceId: string
    status: string
    roomTemperature: number
    humidity: number
    compressorState: boolean
    powerConsumption: number
    energyConsumption: number
    targetTemperature: number
    outsideTemperature: number
    timestamp: string
  }
  'ac:state': {
    deviceId: string
    simulationTime: number
    roomTemperature: number
    roomHumidity: number
    outsideTemperature: number
    targetTemperature: number
    acPower: boolean
    compressorState: boolean
    fanState: boolean
    coolingCapacity: number
    heatingCapacity: number
    powerWatts: number
    energyKwh: number
    operatingMode: string
    fanSpeed: string
    timestamp: string
  }
  'ac:command:status': {
    deviceId: string
    success: boolean
    command: Record<string, unknown>
    message?: string
    timestamp: string
  }
  'simulation:update': SimulationUpdate
  'simulation.state.updated': {
    simulationId: string
    deviceId: string
    status: string
    roomTemperature: number
    humidity: number
    compressorState: boolean
    powerConsumption: number
    energyConsumption: number
    targetTemperature: number
    outsideTemperature: number
    timestamp: string
  }
  'simulation.started': ServerEvents['simulation.state.updated']
  'simulation.paused': ServerEvents['simulation.state.updated']
  'simulation.resumed': ServerEvents['simulation.state.updated']
  'simulation.stopped': ServerEvents['simulation.state.updated']
  'simulation.reset': ServerEvents['simulation.state.updated']
  'simulation:started': SimulationSession
  'simulation:paused': SimulationSession
  'simulation:resumed': SimulationSession
  'simulation:stopped': SimulationSession
  'device:status': { deviceId: string; state: DeviceState }
  'device:updated': AcDevice
  'device:deleted': { id: string }
  'activity:new': Activity
  'thingsboard:status': ThingsBoardStatus
  connect: { connected: true }
  disconnect: { connected: false }
}

export type ServerEventName = keyof ServerEvents
export type Listener<K extends ServerEventName> = (payload: ServerEvents[K]) => void

/** Minimal typed emitter used by the in-browser mock transport. */
export class TypedEmitter {
  private listeners = new Map<string, Set<(payload: never) => void>>()

  on<K extends ServerEventName>(event: K, handler: Listener<K>): () => void {
    const set = this.listeners.get(event) ?? new Set()
    set.add(handler as (payload: never) => void)
    this.listeners.set(event, set)
    return () => this.off(event, handler)
  }

  off<K extends ServerEventName>(event: K, handler: Listener<K>): void {
    this.listeners.get(event)?.delete(handler as (payload: never) => void)
  }

  emit<K extends ServerEventName>(event: K, payload: ServerEvents[K]): void {
    this.listeners.get(event)?.forEach((handler) => {
      try {
        ;(handler as Listener<K>)(payload)
      } catch (error) {
        console.error(`[socket] listener failed for ${event}`, error)
      }
    })
  }

  clear(): void {
    this.listeners.clear()
  }
}
