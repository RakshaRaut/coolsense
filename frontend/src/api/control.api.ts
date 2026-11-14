import type { AcControlCommand, AcDevice } from '@/types'
import { IS_MOCK } from '@/utils/constants'
import { mockEngine } from '@/services/mock/engine'
import { api, simulateLatency } from './axios'

export async function sendControl(deviceId: string, command: AcControlCommand): Promise<AcDevice> {
  if (IS_MOCK) {
    await simulateLatency(240)
    mockEngine.init()
    return mockEngine.control(deviceId, command)
  }
  const { data } = await api.post<AcDevice>(`/devices/${deviceId}/control`, command)
  return data
}
