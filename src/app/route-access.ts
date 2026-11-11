import { canViewUnder } from '@/lib/permissions'
import type { AuthUser } from '@/types/auth'

/**
 * Which screens a page needs, as permission code prefixes (`app/catalogue/<module>.py` on the
 * API), the one list the sidebar and the page guard share. The longest matching path decides, so
 * a module's pages sit under their own screen: having your own payslips does not open Payroll
 * Settings. `@team` asks for more than the person's own records (`@all`: more than their team).
 * A path with no rule is open to everyone signed in.
 */
const RULES: readonly (readonly [path: string, screens: string | readonly string[]])[] = [
  ['/recruitment', 'recruitment'],
  ['/recruitment/dashboard', 'recruitment.dashboard'],
  ['/recruitment/openings', 'recruitment.openings'],
  ['/recruitment/candidates', 'recruitment.applicants'],
  ['/recruitment/applications', 'recruitment.applications'],
  ['/recruitment/interviews', 'recruitment.interviews'],
  ['/recruitment/offers', 'recruitment.offers'],
  ['/recruitment/settings', 'recruitment.settings'],
  ['/talent-management', 'employees'],
  ['/separation-management', 'offboarding@team'],
  ['/attendance', ['attendance', 'scheduling', 'requests.overtime', 'requests.official_visit']],
  ['/attendance/overview', 'attendance.overview'],
  ['/attendance/insights', 'attendance.overview'],
  ['/attendance/time-sheet', 'attendance.time_sheet'],
  ['/attendance/missing-punch', 'attendance.time_sheet'],
  ['/attendance/logs', 'attendance.logs'],
  ['/attendance/official-visits', 'requests.official_visit'],
  ['/attendance/overtime', 'requests.overtime'],
  ['/attendance/scheduling', 'scheduling.schedules'],
  ['/attendance/settings', ['attendance.settings', 'scheduling.settings']],
  ['/attendance/my-warnings', 'warning.warnings'],
  ['/leaves', 'leaves'],
  ['/leaves/settings', 'leaves.settings'],
  ['/requests/settings', 'requests.settings'],
  ['/requests/transfer', 'requests.transfer'],
  ['/requests/promotion', 'requests.promotion'],
  ['/payroll', 'payroll'],
  ['/payroll/dashboard', 'payroll.dashboard'],
  ['/payroll/settings', 'payroll.settings'],
  ['/payroll/settings/loans', 'loans.settings'],
  ['/payroll/settings/appraisal', 'performance.appraisals'],
  ['/payroll/payrolls', ['payroll.payrolls', 'payroll.daily_wages']],
  ['/payroll/payrolls/monthly', 'payroll.payrolls'],
  ['/payroll/payrolls/daily-wages', 'payroll.daily_wages'],
  ['/payroll/salary-sheet', 'payroll.salary_sheet'],
  ['/payroll/pay-slips', 'payroll.payslips'],
  ['/payroll/pay-slips/all', 'payroll.payslips@team'],
  ['/payroll/vouchers', 'payroll.vouchers'],
  ['/payroll/final-settlement', 'payroll.final_settlement@team'],
  ['/payroll/balances', ['payroll.opening_balances@team', 'payroll.employee_accounts@team']],
  ['/payroll/balances/opening-balance', 'payroll.opening_balances@team'],
  ['/payroll/balances/employee-accounts', 'payroll.employee_accounts@team'],
  ['/payroll/balances/account-statement', 'payroll.employee_accounts@team'],
  ['/payroll/salary-revision', 'payroll.salary_revision'],
  ['/payroll/leave-encashment', 'payroll.leave_encashment'],
  ['/payroll/reports', 'payroll.reports'],
  ['/assets', 'assets'],
  ['/assets/company-assets', 'assets.company_assets'],
  ['/assets/allocations', 'assets.allocations'],
  ['/assets/types', 'assets.types'],
  ['/assets/clearance-form', 'assets.clearance@team'],
  ['/end-of-employment', 'offboarding.end_of_employment@team'],
  ['/performance', ['performance', 'training']],
  ['/performance/overview', 'performance.overview'],
  ['/performance/goals', 'performance.goals'],
  ['/performance/kpis', 'performance.kpis@team'],
  ['/performance/cycles', 'performance.appraisals'],
  ['/performance/appraisals', 'performance.appraisals'],
  ['/performance/reviews', 'performance.reviews'],
  ['/benefits', 'benefits'],
  ['/roster', 'roster'],
  ['/warning', 'warning.settings'],
  ['/warning/policy', 'warning.settings.policies'],
  ['/warning/penalty', 'warning.settings.penalties'],
  ['/scheduling', 'scheduling@team'],
  ['/configuration', ['assets.types', 'requests.settings', 'offboarding.settings']],
  ['/manpower-planning', 'manpower'],
  ['/manpower-planning/planning', 'manpower.planning'],
  ['/manpower-planning/e-budgeting', 'manpower.e_budgeting'],
  ['/manpower-planning/open-positions', 'manpower.open_positions'],
  ['/manpower-planning/budget-approvals', 'manpower.budget_approvals'],
  ['/manpower-planning/e-budget-settings', 'manpower.settings'],
  ['/settings/control-panel', 'organisation'],
  ['/settings/off-boarding', 'offboarding.settings'],
  ['/settings/system-users', 'access.users'],
  ['/settings/user-group-permissions', 'access.roles'],
  ['/settings/biometric-devices', 'attendance.settings.devices'],
]

/** Lists of other people: a person's own profile opens, the directory is for those who manage people. */
const LISTS: Readonly<Record<string, string>> = {
  '/talent-management': 'employees.directory@team',
  '/talent-management/employees': 'employees.directory@team',
}

function ruleFor(path: string) {
  let best: (typeof RULES)[number] | undefined
  for (const rule of RULES) {
    const matches = path === rule[0] || path.startsWith(`${rule[0]}/`)
    if (matches && (!best || rule[0].length > best[0].length)) best = rule
  }
  return best
}

/** May the user open this page? A user without a permissions list (the mock API) opens everything. */
export function canOpen(user: AuthUser | null, path: string): boolean {
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : path
  const list = LISTS[clean]
  if (list) return canViewUnder(user, list)
  const rule = ruleFor(clean)
  if (!rule) return true
  const screens: readonly string[] = typeof rule[1] === 'string' ? [rule[1]] : rule[1]
  return screens.some((screen) => canViewUnder(user, screen))
}
