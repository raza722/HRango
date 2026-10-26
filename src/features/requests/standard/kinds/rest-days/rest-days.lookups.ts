import { apiClient } from '@/lib/axios'

import type { RestDayLookups, RosterOption } from './rest-days.types'

/** The Roster drop-down: `GET /scheduling/options/roster-groups`. */
export async function loadRestDaysLookups(signal?: AbortSignal): Promise<RestDayLookups> {
  const { data } = await apiClient
    .get<{ data: RosterOption[] }>('/scheduling/options/roster-groups', { signal })
    .catch(() => ({ data: { data: [] as RosterOption[] } }))
  return {
    rosters: data.data.map((row) => ({
      id: row.id,
      name: row.name,
      startTime: row.startTime,
      endTime: row.endTime,
    })),
  }
}
