import { http, HttpResponse } from 'msw'

import type { DashboardSummary } from '@/features/dashboard'
import type { ApiItem } from '@/types/api'

import { apiPath, latency, requireAuth } from '../utils'
import { warningPolicies } from '../warning-policies/handlers'

export const dashboardHandlers = [
  http.get(apiPath('/dashboard/summary'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized

    return HttpResponse.json<ApiItem<DashboardSummary>>({
      data: {
        headcount: 248,
        presentToday: 221,
        onLeave: 14,
        openPositions: 9,
        activeWarningPolicies: warningPolicies.all().length,
      },
    })
  }),
]
