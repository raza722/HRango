import { useAuthStore } from '@/stores/auth-store'
import type { AuthUser } from '@/types/auth'

const REACH: Record<string, readonly string[]> = {
  team: ['team', 'department', 'branch', 'selected_units', 'company'],
  all: ['department', 'branch', 'selected_units', 'company'],
}

/**
 * Permission checks against the codes the API sends with the user (`GET /auth/me`).
 * Codes are module.screen.action (`requests.leave.create`); `*` matches any part:
 * `can(user, 'payroll.*.view')`. The server checks every request anyway; this only
 * hides what the user cannot use.
 *
 * `@team` asks for the code beyond the person's own records, `@all` beyond their team: a My / Team
 * / All tab reads the scope of one view code (`performance.goals.view@team`).
 *
 * A user without a permissions list (the mock API) is treated as allowed everything.
 */
export function can(user: AuthUser | null, pattern: string): boolean {
  if (!user) return false
  if (!user.permissions) return true
  const [code = '', reach] = pattern.split('@')
  const scopes = reach ? REACH[reach] : undefined
  const held = scopes ? user.permissions.filter((p) => scopes.includes(p.scope)) : user.permissions
  if (!code.includes('*')) return held.some((p) => p.code === code)
  const re = new RegExp(`^${code.split('*').map(escapeRegExp).join('[^.]*')}$`)
  return held.some((p) => re.test(p.code))
}

/** True when the user may do this; re-renders when the session changes. */
export function useCan(pattern: string): boolean {
  const user = useAuthStore((state) => state.user)
  return can(user, pattern)
}

/** May the user do this to one employee's record? A code held for their own records reaches only theirs. */
export function useCanOnEmployee(pattern: string, employeeId: string): boolean {
  const user = useAuthStore((state) => state.user)
  return can(user, user?.employeeId === employeeId ? pattern : `${pattern}@team`)
}

/**
 * May the user view any screen under a code prefix? `'payroll'` matches
 * `payroll.payslips.view` and `payroll.settings.tax.view`; `'attendance.overview'` matches
 * `attendance.overview.view`. The sidebar and the module landing pages use it.
 */
export function canViewUnder(user: AuthUser | null, prefix: string): boolean {
  const [screen = '', reach] = prefix.split('@')
  const suffix = reach ? `@${reach}` : ''
  return (
    can(user, `${screen}.view${suffix}`) ||
    can(user, `${screen}.*.view${suffix}`) ||
    can(user, `${screen}.*.*.view${suffix}`)
  )
}

function escapeRegExp(text: string): string {
  return text.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
}
