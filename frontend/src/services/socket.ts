import { io, type Socket } from 'socket.io-client'
import { IS_MOCK, SOCKET_URL } from '@/utils/constants'
import type { ConnectionState } from '@/types'
import { mockEngine } from './mock/engine'
import { TypedEmitter, type Listener, type ServerEventName, type ServerEvents } from './socketEvents'

const EVENT_NAMES: ServerEventName[] = [
  'telemetry:update',
  'simulation:update',
  'simulation:started',
  'simulation:paused',
  'simulation:resumed',
  'simulation:stopped',
  'device:status',
  'device:updated',
  'device:deleted',
  'activity:new',
  'thingsboard:status',
]

/**
 * One transport for the whole app.
 * Mock mode fans out the in-browser engine; production mode wraps a single
 * Socket.IO connection. Components never create their own connections.
 */
class SocketService {
  private emitter = new TypedEmitter()
  private socket: Socket | null = null
  private statusListeners = new Set<(state: ConnectionState) => void>()
  private mockUnsubscribers: Array<() => void> = []
  private state: ConnectionState = 'disconnected'
  private started = false

  getState(): ConnectionState {
    return this.state
  }

  onStatus(handler: (state: ConnectionState) => void): () => void {
    this.statusListeners.add(handler)
    handler(this.state)
    return () => this.statusListeners.delete(handler)
  }

  private setState(state: ConnectionState): void {
    this.state = state
    this.statusListeners.forEach((listener) => listener(state))
  }

  on<K extends ServerEventName>(event: K, handler: Listener<K>): () => void {
    return this.emitter.on(event, handler)
  }

  connect(token?: string): void {
    if (this.started) return

    if (IS_MOCK) {
      this.started = true
      this.setState('connecting')
      mockEngine.init()

      // Mirror the mock engine's bus onto the shared emitter.
      EVENT_NAMES.forEach((name) => {
        const unsubscribe = mockEngine.emitter.on(name, (payload) => {
          this.emitter.emit(name, payload as never)
        })
        this.mockUnsubscribers.push(unsubscribe)
      })

      window.setTimeout(() => this.setState('connected'), 450)
      return
    }

    this.started = true
    this.setState('connecting')
    const socket = io(SOCKET_URL || window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: token ? { token } : undefined,
      reconnectionAttempts: 8,
      reconnectionDelay: 1500,
    })
    this.socket = socket

    socket.on('connect', () => this.setState('connected'))
    socket.on('disconnect', () => this.setState('disconnected'))
    socket.on('connect_error', () => this.setState('disconnected'))

    EVENT_NAMES.forEach((name) => {
      socket.on(name, (payload: unknown) => {
        this.emitter.emit(name, payload as never)
      })
    })
  }

  disconnect(): void {
    this.mockUnsubscribers.forEach((off) => off())
    this.mockUnsubscribers = []
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
    }
    this.started = false
    this.setState('disconnected')
  }

  emitLocal<K extends ServerEventName>(event: K, payload: ServerEvents[K]): void {
    this.emitter.emit(event, payload)
  }
}

export const socketService = new SocketService()
