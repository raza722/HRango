import { LEAVE_CODES } from '@/features/leaves'
import { PERF_CODES } from '@/features/performance'
import { RC_CODES } from '@/features/recruitment'
import { TM_CODES } from '@/features/talent-management'
import { can, canViewUnder } from '@/lib/permissions'
import { useAuthStore } from '@/stores/auth-store'

/**
 * What the signed-in user may see and do from the dashboard, by the permission codes the
 * modules themselves check (a widget the user may not read is left out, not shown empty).
 * Screen prefixes go through `canViewUnder`, as the sidebar does. In mock mode (no permissions
 * list) everything is allowed.
 */
export function useDashboardAccess() {
  const user = useAuthStore((state) => state.user)
  return {
    // Where the key figures open.
    employees: canViewUnder(user, 'employees'),
    timeSheet: canViewUnder(user, 'attendance.time_sheet'),
    openings: can(user, RC_CODES.openingsView),
    approvals: can(user, 'requests.approvals.view'),
    // Module cards.
    payroll: can(user, 'payroll.dashboard.view'),
    payrollRuns: can(user, 'payroll.payrolls.view'),
    recruitment: can(user, RC_CODES.dashboard),
    performance: canViewUnder(user, 'performance'),
    selfReviews: can(user, PERF_CODES.reviewsSelf),
    managerReviews: can(user, PERF_CODES.reviewsManager),
    leaves: can(user, LEAVE_CODES.applicationsView),
    exits: canViewUnder(user, 'offboarding.end_of_employment'),
    settlements: canViewUnder(user, 'payroll.final_settlement'),
    separation: canViewUnder(user, 'offboarding'),
    benefits: canViewUnder(user, 'benefits'),
    warning: can(user, 'warning.settings.policies.view'),
    myLeaves: canViewUnder(user, 'leaves') || can(user, LEAVE_CODES.requestView),
    // Quick actions.
    applyLeave: can(user, LEAVE_CODES.apply),
    addEmployee: can(user, TM_CODES.create),
    newOpening: can(user, RC_CODES.openingsCreate),
    runPayroll: can(user, 'payroll.payrolls.process'),
  }
}

export type DashboardAccess = ReturnType<typeof useDashboardAccess>
