import type { ThingsBoardStatus } from '@/types'
import { IS_MOCK } from '@/utils/constants'
import { mockEngine } from '@/services/mock/engine'
import { api, simulateLatency } from './axios'

export async function getThingsBoardStatus(): Promise<ThingsBoardStatus> {
  if (IS_MOCK) {
    await simulateLatency(240)
    mockEngine.init()
    return mockEngine.getThingsBoardStatus()
  }
  const { data } = await api.get<ThingsBoardStatus>('/integrations/thingsboard/status')
  return data
}

export async function syncThingsBoard(): Promise<ThingsBoardStatus> {
  if (IS_MOCK) {
    await simulateLatency(680)
    mockEngine.init()
    return mockEngine.syncThingsBoard()
  }
  const { data } = await api.post<ThingsBoardStatus>('/integrations/thingsboard/sync')
  return data
}
