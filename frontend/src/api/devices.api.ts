import type { AcDevice, CreateDeviceInput, SimulationSample, UpdateDeviceInput } from '@/types'
import { IS_MOCK } from '@/utils/constants'
import { mockEngine } from '@/services/mock/engine'
import { api, simulateLatency } from './axios'

function mock() {
  mockEngine.init()
  return mockEngine
}

export async function listDevices(): Promise<AcDevice[]> {
  if (IS_MOCK) {
    await simulateLatency(220)
    return mock().listDevices()
  }
  const { data } = await api.get<AcDevice[]>('/devices')
  return data
}

export async function getDevice(id: string): Promise<AcDevice> {
  if (IS_MOCK) {
    await simulateLatency(180)
    const device = mock().getDevice(id)
    if (!device) throw new Error('Device not found')
    return device
  }
  const { data } = await api.get<AcDevice>(`/devices/${id}`)
  return data
}

export async function createDevice(input: CreateDeviceInput): Promise<AcDevice> {
  if (IS_MOCK) {
    await simulateLatency(420)
    return mock().createDevice(input)
  }
  const { data } = await api.post<AcDevice>('/devices', input)
  return data
}

export async function updateDevice(id: string, input: UpdateDeviceInput): Promise<AcDevice> {
  if (IS_MOCK) {
    await simulateLatency(320)
    return mock().updateDevice(id, input)
  }
  const { data } = await api.patch<AcDevice>(`/devices/${id}`, input)
  return data
}

export async function deleteDevice(id: string): Promise<void> {
  if (IS_MOCK) {
    await simulateLatency(260)
    mock().deleteDevice(id)
    return
  }
  await api.delete(`/devices/${id}`)
}

export async function getDeviceHistory(
  id: string,
  rangeSeconds = 86_400,
  maxPoints = 120,
): Promise<SimulationSample[]> {
  if (IS_MOCK) {
    await simulateLatency(160)
    return mock().getHistory(id, rangeSeconds, maxPoints)
  }
  const { data } = await api.get<SimulationSample[]>(`/devices/${id}/history`, {
    params: { range: rangeSeconds, limit: maxPoints },
  })
  return data
}
