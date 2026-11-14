import type { Activity } from '@/types'
import { IS_MOCK } from '@/utils/constants'
import { mockEngine } from '@/services/mock/engine'
import { api, simulateLatency } from './axios'

export async function listActivities(): Promise<Activity[]> {
  if (IS_MOCK) {
    await simulateLatency(140)
    mockEngine.init()
    return mockEngine.listActivities()
  }
  const { data } = await api.get<Activity[]>('/activities', { params: { limit: 40 } })
  return data
}
