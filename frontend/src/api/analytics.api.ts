import type { AnalyticsDataset, ComparisonResult } from '@/types'
import { IS_MOCK } from '@/utils/constants'
import { mockEngine } from '@/services/mock/engine'
import { DEFAULT_COMPARISON_CONFIG, runComparison, type ComparisonConfig } from '@/services/mock/comparison'
import { api, simulateLatency } from './axios'

export async function getAnalytics(
  deviceId: string | undefined,
  days: number,
  pricePerKwh: number,
): Promise<AnalyticsDataset> {
  if (IS_MOCK) {
    await simulateLatency(280)
    mockEngine.init()
    return mockEngine.analytics(deviceId, days, pricePerKwh)
  }
  const { data } = await api.get<AnalyticsDataset>('/analytics', {
    params: { deviceId, days, pricePerKwh },
  })
  return data
}

export interface ComparisonResponse {
  inverter: ComparisonResult
  fixed: ComparisonResult
  config: ComparisonConfig
}

export async function runAcComparison(config: ComparisonConfig = DEFAULT_COMPARISON_CONFIG): Promise<ComparisonResponse> {
  if (IS_MOCK) {
    await simulateLatency(520)
    return runComparison(config)
  }
  const { data } = await api.post<ComparisonResponse>('/comparison/run', config)
  return data
}

export type { ComparisonConfig }
