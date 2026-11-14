import { IS_MOCK } from '@/utils/constants'
import { mockEngine } from '@/services/mock/engine'
import { api, simulateLatency } from './axios'

export interface FleetPoint {
  time: string
  roomTempC: number
  targetTempC: number
  outsideTempC: number
  powerW: number
  energyKwh: number
}

export async function getFleetHistory(rangeSeconds: number, buckets = 96): Promise<FleetPoint[]> {
  if (IS_MOCK) {
    await simulateLatency(200)
    mockEngine.init()
    return mockEngine.fleetSeries(rangeSeconds, buckets)
  }
  const { data } = await api.get<FleetPoint[]>('/dashboard/history', {
    params: { range: rangeSeconds, buckets },
  })
  return data
}
