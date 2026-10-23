import { queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem } from '@/types/api'

export interface DashboardSummary {
  headcount: number
  presentToday: number
  onLeave: number
  openPositions: number
  activeWarningPolicies: number
}

export const dashboardKeys = {
  summary: ['dashboard', 'summary'] as const,
}

export function dashboardSummaryQueryOptions() {
  return queryOptions({
    queryKey: dashboardKeys.summary,
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<ApiItem<DashboardSummary>>('/dashboard/summary', {
        signal,
      })
      return data.data
    },
  })
}
