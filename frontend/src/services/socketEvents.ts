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
  'simulation:update': SimulationUpdate
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
