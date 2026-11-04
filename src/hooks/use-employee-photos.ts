import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import { isMockApi } from '@/lib/env'

interface EmployeePhoto {
  employeeId: string
  name: string
  photoUrl: string | null
}

interface PhotoIndex {
  byId: Map<string, string | null>
  byName: Map<string, string | null>
}

/** Rows that carry only a name match on it, unless two people share that name. */
function indexPhotos(rows: EmployeePhoto[]): PhotoIndex {
  const shared = new Set<string>()
  const byName = new Map<string, string | null>()
  for (const row of rows) {
    if (byName.has(row.name)) shared.add(row.name)
    byName.set(row.name, row.photoUrl)
  }
  for (const name of shared) byName.delete(name)
  return { byId: new Map(rows.map((row) => [row.employeeId, row.photoUrl])), byName }
}

/**
 * A person's photo from the company's list (`GET /employees/photos`), by id, else by name. Read
 * once and shared; the signed links last 30 minutes, so it refreshes sooner.
 */
export function useEmployeePhotoUrl(
  employeeId: string | null | undefined,
  name: string,
): string | null {
  const { data } = useQuery({
    queryKey: ['employees', 'photos'],
    queryFn: async ({ signal }) => {
      const res = await apiClient.get<{ data: EmployeePhoto[] }>('/employees/photos', { signal })
      return indexPhotos(res.data.data)
    },
    enabled: !isMockApi,
    staleTime: 20 * 60_000,
  })
  return (employeeId ? data?.byId.get(employeeId) : data?.byName.get(name)) ?? null
}
