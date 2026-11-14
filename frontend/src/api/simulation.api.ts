import type { AcDevice, SimulationConfig, SimulationSample, SimulationSession } from '@/types'
import { IS_MOCK } from '@/utils/constants'
import { mockEngine } from '@/services/mock/engine'
import { api, simulateLatency } from './axios'

function mock() {
  mockEngine.init()
  return mockEngine
}

export async function getSimulation(): Promise<SimulationSession | null> {
  if (IS_MOCK) {
    await simulateLatency(80)
    return mock().getSession()
  }
  const { data } = await api.get<SimulationSession | null>('/simulation')
  return data
}

export async function startSimulation(config: SimulationConfig): Promise<SimulationSession> {
  if (IS_MOCK) {
    await simulateLatency(360)
    return mock().startSimulation(config)
  }
  const { data } = await api.post<SimulationSession>('/simulation/start', config)
  return data
}

export async function pauseSimulation(): Promise<SimulationSession> {
  if (IS_MOCK) {
    await simulateLatency(160)
    return mock().pauseSimulation()
  }
  const { data } = await api.post<SimulationSession>('/simulation/pause')
  return data
}

export async function resumeSimulation(): Promise<SimulationSession> {
  if (IS_MOCK) {
    await simulateLatency(160)
    return mock().resumeSimulation()
  }
  const { data } = await api.post<SimulationSession>('/simulation/resume')
  return data
}

export async function stopSimulation(): Promise<SimulationSession> {
  if (IS_MOCK) {
    await simulateLatency(200)
    return mock().stopSimulation()
  }
  const { data } = await api.post<SimulationSession>('/simulation/stop')
  return data
}

export async function resetSimulation(): Promise<SimulationSession> {
  if (IS_MOCK) {
    await simulateLatency(240)
    return mock().resetSimulation()
  }
  const { data } = await api.post<SimulationSession>('/simulation/reset')
  return data
}

export async function setSimulationSpeed(speed: number): Promise<SimulationSession> {
  if (IS_MOCK) {
    await simulateLatency(100)
    return mock().setSimulationSpeed(speed)
  }
  const { data } = await api.patch<SimulationSession>('/simulation/speed', { speed })
  return data
}

export async function updateSimulationEnvironment(
  deviceId: string,
  patch: Partial<AcDevice['environment']> & { roomTempC?: number; targetTempC?: number },
): Promise<AcDevice> {
  if (IS_MOCK) {
    await simulateLatency(120)
    return mock().applyEnvironment(deviceId, patch)
  }
  const { data } = await api.patch<AcDevice>('/simulation/environment', { deviceId, ...patch })
  return data
}

export async function getSimulationSeries(): Promise<SimulationSample[]> {
  if (IS_MOCK) {
    await simulateLatency(80)
    return mock().getSessionSeries()
  }
  const { data } = await api.get<SimulationSample[]>('/simulation/series')
  return data
}
