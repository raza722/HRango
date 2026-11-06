import { can } from '@/lib/permissions'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Which list a request page shows: the one chosen, else everyone's for a person who reaches other
 * people's requests (a manager's own list is usually empty) and their own for everyone else. A
 * user without a permissions list (the mock API) may see everyone's, so gets everyone's too.
 */
export function useRequestScope<S extends string>(
  chosen: S | undefined,
  viewCode: string,
): S | 'my' | 'all' {
  const user = useAuthStore((state) => state.user)
  if (chosen) return chosen
  return can(user, `${viewCode}@team`) ? 'all' : 'my'
}
