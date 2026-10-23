import { useQuery } from '@tanstack/react-query'
import { differenceInCalendarDays, parse } from 'date-fns'

import { apiClient } from '@/lib/axios'
import type { ApiItem } from '@/types/api'

import { standardKeys } from '../../standard.api'
import type { StandardKind } from '../../standard.types'
import type { ShiftDay } from './work-from-home.types'

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())

/** The longest stretch one strip asks for (the mock's limit). */
export const MAX_STRIP_DAYS = 62

/**
 * A person's days between two dates (shift, "Rest Day" or "Day off"), for the
 * week strip. Kept under the type's query key, so approvals refresh it.
 */
export function useScheduleDays(
  kind: StandardKind,
  employeeId: string | null | undefined,
  from: string,
  to: string,
) {
  const span = from && to ? differenceInCalendarDays(day(to), day(from)) : -1
  return useQuery({
    queryKey: [...standardKeys.kind(kind), 'schedule', employeeId ?? '', from, to] as const,
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<ApiItem<ShiftDay[]>>(`/requests/${kind}/schedule`, {
        params: { employeeId, from, to },
        signal,
      })
      return data.data
    },
    enabled: Boolean(employeeId) && span >= 0 && span < MAX_STRIP_DAYS,
  })
}
