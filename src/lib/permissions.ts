import { useAuthStore } from '@/stores/auth-store'
import type { AuthUser } from '@/types/auth'

/**
 * Permission checks against the codes the API sends with the user (`GET /auth/me`).
 * Codes are module.screen.action (`requests.leave.create`); `*` matches any part:
 * `can(user, 'payroll.*.view')`. The server checks every request anyway; this only
 * hides what the user cannot use.
 *
 * A user without a permissions list (the mock API) is treated as allowed everything.
 */
export function can(user: AuthUser | null, pattern: string): boolean {
  if (!user) return false
  if (!user.permissions) return true
  if (!pattern.includes('*')) return user.permissions.some((p) => p.code === pattern)
  const re = new RegExp(`^${pattern.split('*').map(escapeRegExp).join('[^.]*')}$`)
  return user.permissions.some((p) => re.test(p.code))
}

/** True when the user may do this; re-renders when the session changes. */
export function useCan(pattern: string): boolean {
  const user = useAuthStore((state) => state.user)
  return can(user, pattern)
}

function escapeRegExp(text: string): string {
  return text.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
}
