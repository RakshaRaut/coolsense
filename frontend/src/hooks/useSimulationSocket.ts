import { useEffect, useState } from 'react'
import type { ServerEvents } from '@/services/socketEvents'
import { socketService } from '@/services/socket'

type LiveTelemetry = ServerEvents['simulation:telemetry']
type SimulationState = ServerEvents['simulation:state']
type CommandStatus = ServerEvents['ac:command:status']

export function useSimulationSocket(deviceId?: string) {
  const [telemetry, setTelemetry] = useState<LiveTelemetry | null>(null)
  const [simulation, setSimulation] = useState<SimulationState | null>(null)
  const [commandStatus, setCommandStatus] = useState<CommandStatus | null>(null)

  useEffect(() => {
    setTelemetry(null)
    setSimulation(null)
    setCommandStatus(null)
    if (!deviceId) return

    const isSelectedDevice = (payload: { deviceId: string }) =>
      payload.deviceId === deviceId
    const updateTelemetry = (payload: LiveTelemetry) => {
      if (!isSelectedDevice(payload)) return
      setTelemetry((current) =>
        current && current.timestamp >= payload.timestamp ? current : payload,
      )
    }

    const offTelemetry = socketService.on('simulation:telemetry', updateTelemetry)
    const offLegacyTelemetry = socketService.on('telemetry:update', (payload) => {
      if (isSelectedDevice(payload)) {
        updateTelemetry({
          ...payload,
          simulationTime: 0,
          simulationId: '',
        })
      }
    })
    const offState = socketService.on('simulation:state', (payload) => {
      if (isSelectedDevice(payload)) setSimulation(payload)
    })
    const offCommand = socketService.on('ac:command:status', (payload) => {
      if (isSelectedDevice(payload)) setCommandStatus(payload)
    })
    const offAcState = socketService.on('ac:state', (payload) => {
      if (!isSelectedDevice(payload)) return
      setSimulation((current) => ({
        simulationId: current?.simulationId ?? '',
        deviceId: payload.deviceId,
        status: current?.status ?? 'idle',
        roomTemperature: payload.roomTemperature,
        humidity: payload.roomHumidity,
        compressorState: payload.compressorState,
        powerConsumption: payload.powerWatts,
        energyConsumption: payload.energyKwh,
        targetTemperature: payload.targetTemperature,
        outsideTemperature: payload.outsideTemperature,
        timestamp: payload.timestamp,
      }))
    })

    return () => {
      offTelemetry()
      offLegacyTelemetry()
      offState()
      offCommand()
      offAcState()
    }
  }, [deviceId])

  return { telemetry, simulation, commandStatus }
}
