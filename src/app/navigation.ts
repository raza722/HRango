import type { ComponentType, SVGProps } from 'react'

import { BenefitsIcon } from '@/components/icons/benefits-icon'
import {
  AssetsIcon,
  AttendanceIcon,
  ConfigurationIcon,
  CustomFormIcon,
  DashboardIcon,
  EndOfEmploymentIcon,
  PayrollIcon,
  PerformanceIcon,
  RecruitmentIcon,
  SeparationManagementIcon,
  SettingsIcon,
  TalentManagementIcon,
  WarningIcon,
} from '@/components/icons/figma-icons'
import {
  BudgetApprovalsNavIcon,
  EBudgetingNavIcon,
  EBudgetSettingsNavIcon,
  ManpowerPlanningIcon,
  OpenPositionsNavIcon,
  PlanningNavIcon,
} from '@/components/icons/manpower-planning-icon'
import { ProjectManagementIcon } from '@/components/icons/project-management-icon'
import { LeavesNavIcon, RequestsNavIcon } from '@/components/icons/request-icons'
import { RosterIcon } from '@/components/icons/roster-icon'
import { SchedulingIcon } from '@/components/icons/scheduling-icon'
import { canViewUnder } from '@/lib/permissions'
import type { FileRouteTypes } from '@/routeTree.gen'
import type { AuthUser } from '@/types/auth'

/** Every navigable path in the app, derived from the generated route tree. */
export type AppPath = FileRouteTypes['to']

export interface NavChild {
  label: string
  to: AppPath
  /** Path parameters, for pages of a shared route (`/requests/$type`). */
  params?: Record<string, string>
  /** A sub-group (Payroll's menu): its own page or prefix, then its pages. */
  children?: readonly NavChild[]
  /** The sub-group is always drawn open (Payroll Settings). */
  alwaysOpen?: boolean
  /** Drawn in place of the tree's ring bullet (Manpower Planning's pages). */
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  /** Who sees it: see {@link NavPermission}. Without one the item follows its parent. */
  permission?: NavPermission
}

export interface NavItem {
  label: string
  /** The item's own page, or the path its children live under. */
  to: AppPath
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Highlight only on an exact path match (needed for "/"). */
  exact?: boolean
  /** Sub-pages; the item then expands instead of navigating. */
  children?: readonly NavChild[]
  /** Draw the children as Payroll's tree: circle bullets, nested groups. */
  tree?: boolean
  /** Who sees it: see {@link NavPermission}. Without one the item is always shown. */
  permission?: NavPermission
}

/**
 * Screens a menu entry opens, as permission code prefixes (`app/catalogue/<module>.py` on the
 * API): the entry shows when the user may view any screen under one of them. `'payroll'`
 * matches `payroll.payslips.view` and `payroll.settings.tax.view`; `'attendance.overview'`
 * matches `attendance.overview.view`.
 */
export type NavPermission = string | readonly string[]

function allowed(user: AuthUser | null, permission: NavPermission | undefined): boolean {
  if (permission === undefined) return true
  const prefixes: readonly string[] = typeof permission === 'string' ? [permission] : permission
  return prefixes.some((prefix) => canViewUnder(user, prefix))
}

function visibleChildren(
  children: readonly NavChild[],
  user: AuthUser | null,
): readonly NavChild[] {
  return children.flatMap((child): NavChild[] => {
    if (!allowed(user, child.permission)) return []
    if (!child.children) return [child]
    const nested = visibleChildren(child.children, user)
    // A group whose pages are all hidden goes too; one with its own permission keeps its page.
    if (nested.length === 0 && child.permission === undefined) return []
    return [{ ...child, children: nested }]
  })
}

/**
 * The menu the user may use: items and pages they hold no view permission for are left out,
 * and a parent whose children are all hidden goes too. A user without a permissions list
 * (the mock API) sees everything. The server checks every request anyway.
 */
export function filterNavItems(items: readonly NavItem[], user: AuthUser | null): NavItem[] {
  return items.flatMap((item): NavItem[] => {
    if (!allowed(user, item.permission)) return []
    if (!item.children) return [item]
    const children = visibleChildren(item.children, user)
    return children.length === 0 ? [] : [{ ...item, children }]
  })
}

/** Sidebar entries, in the order drawn in the Figma side menu. */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', to: '/', icon: DashboardIcon, exact: true },
  {
    label: 'Recruitment',
    to: '/recruitment',
    icon: RecruitmentIcon,
    permission: 'recruitment',
    // Not drawn (no current-style frame): the API's screens, in the order of the hiring flow.
    tree: true,
    children: [
      { label: 'Dashboard', to: '/recruitment/dashboard' },
      { label: 'Job Openings', to: '/recruitment/openings' },
      { label: 'Candidates', to: '/recruitment/candidates' },
      { label: 'Applications', to: '/recruitment/applications' },
      { label: 'Interviews', to: '/recruitment/interviews' },
      { label: 'Offers', to: '/recruitment/offers' },
      { label: 'Settings', to: '/recruitment/settings' },
    ],
  },
  {
    label: 'Talent Management',
    to: '/talent-management',
    icon: TalentManagementIcon,
    permission: 'employees',
  },
  {
    label: 'Separation Management',
    to: '/separation-management',
    icon: SeparationManagementIcon,
    permission: 'offboarding',
  },
  {
    label: 'Attendance',
    to: '/attendance',
    icon: AttendanceIcon,
    permission: ['attendance', 'scheduling.settings'],
    children: [
      {
        label: 'Attendance Overview',
        to: '/attendance/overview',
        permission: 'attendance.overview',
      },
      { label: 'Time Sheet', to: '/attendance/time-sheet', permission: 'attendance.time_sheet' },
      { label: 'Attendance Logs', to: '/attendance/logs', permission: 'attendance.logs' },
      {
        label: 'Attendance Settings',
        to: '/attendance/settings',
        // Scheduling's tabs (rest days, break types, holidays, time slots) live here too.
        permission: ['attendance.settings', 'scheduling.settings'],
      },
    ],
  },
  { label: 'Leaves', to: '/leaves', icon: LeavesNavIcon, permission: 'leaves' },
  {
    label: 'Requests',
    to: '/requests',
    icon: RequestsNavIcon,
    permission: 'requests',
    // The Request Settings frames (3894:26499) draw the sidebar's Requests as this tree; its
    // items follow the in-page sub menu (Travel and Transfer included, Requisition left out:
    // it has no screens). "Relaxion" and "Deligation" are spelt correctly.
    tree: true,
    children: [
      { label: 'Punch', to: '/requests/punch', permission: 'requests.punch' },
      {
        label: 'Expense',
        to: '/requests/$type',
        params: { type: 'expense' },
        permission: 'requests.expense',
      },
      {
        label: 'Leave',
        to: '/requests/$type',
        params: { type: 'leave' },
        permission: 'requests.leave',
      },
      { label: 'Shift Request', to: '/requests/shift', permission: 'requests.shift_swap' },
      {
        label: 'Loan & Advances',
        to: '/requests/$type',
        params: { type: 'loan-advances' },
        permission: 'requests.loan',
      },
      {
        label: 'Work from Home',
        to: '/requests/$type',
        params: { type: 'work-from-home' },
        permission: 'requests.work_from_home',
      },
      {
        label: 'Official Visit',
        to: '/requests/$type',
        params: { type: 'official-visits' },
        permission: 'requests.official_visit',
      },
      {
        label: 'Promotion',
        to: '/requests/$type',
        params: { type: 'promotion' },
        permission: 'requests.promotion',
      },
      {
        label: 'Relaxation',
        to: '/requests/$type',
        params: { type: 'relaxation' },
        permission: 'requests.relaxation',
      },
      {
        label: 'Rest Days',
        to: '/requests/$type',
        params: { type: 'rest-days' },
        permission: 'requests.rest_day',
      },
      {
        label: 'Travel',
        to: '/requests/$type',
        params: { type: 'travel' },
        permission: 'requests.travel',
      },
      { label: 'Transfer', to: '/requests/transfer', permission: 'requests.transfer' },
      {
        label: 'Resignation',
        to: '/requests/$type',
        params: { type: 'resignation' },
        permission: 'requests.resignation',
      },
      {
        label: 'Settings',
        to: '/requests/settings',
        permission: 'requests.settings',
        children: [
          { label: 'Request Restriction', to: '/requests/settings/restrictions' },
          { label: 'Delegation', to: '/requests/settings/delegation' },
          { label: 'Request Flows', to: '/requests/settings/flows' },
        ],
      },
    ],
  },
  {
    label: 'Payroll',
    to: '/payroll',
    icon: PayrollIcon,
    permission: 'payroll',
    tree: true,
    children: [
      { label: 'Dashboard', to: '/payroll/dashboard' },
      {
        label: 'Payroll Settings',
        to: '/payroll/settings',
        alwaysOpen: true,
        children: [
          { label: 'General', to: '/payroll/settings/general' },
          { label: 'Tax', to: '/payroll/settings/tax' },
          { label: 'Rewards', to: '/payroll/settings/rewards' },
          { label: 'Pay Components', to: '/payroll/settings/pay-components' },
          { label: 'Account Type', to: '/payroll/settings/account-type' },
          { label: 'Disbursement Banks', to: '/payroll/settings/disbursement-banks' },
        ],
      },
      {
        label: 'Payrolls',
        to: '/payroll/payrolls',
        children: [
          { label: 'Monthly', to: '/payroll/payrolls/monthly' },
          { label: 'Daily Wages', to: '/payroll/payrolls/daily-wages' },
        ],
      },
      { label: 'Salary Sheet', to: '/payroll/salary-sheet' },
      {
        label: 'Pay Slips',
        to: '/payroll/pay-slips',
        children: [
          { label: 'My', to: '/payroll/pay-slips/my' },
          { label: 'All', to: '/payroll/pay-slips/all' },
        ],
      },
      {
        label: 'Vouchers',
        to: '/payroll/vouchers',
        children: [{ label: 'Employee Voucher Creation', to: '/payroll/vouchers/employee' }],
      },
      { label: 'Final Settlement', to: '/payroll/final-settlement' },
      {
        label: 'Balances',
        to: '/payroll/balances',
        children: [
          { label: 'Opening Balance', to: '/payroll/balances/opening-balance' },
          { label: 'Employee Accounts', to: '/payroll/balances/employee-accounts' },
          { label: 'Employee Account Statement', to: '/payroll/balances/account-statement' },
        ],
      },
      { label: 'Salary Revision', to: '/payroll/salary-revision' },
      { label: 'Leave Encashment', to: '/payroll/leave-encashment' },
      {
        label: 'Reports',
        to: '/payroll/reports',
        children: [{ label: 'Employee Accounts', to: '/payroll/reports/employee-accounts' }],
      },
    ],
  },
  {
    label: 'Assets',
    to: '/assets',
    icon: AssetsIcon,
    permission: 'assets',
    tree: true,
    children: [
      { label: 'Company Assets', to: '/assets/company-assets' },
      { label: 'Asset Allocations', to: '/assets/allocations' },
      { label: 'Asset Types', to: '/assets/types' },
      { label: 'Asset Clearance Form', to: '/assets/clearance-form' },
    ],
  },
  {
    label: 'End of Employment',
    to: '/end-of-employment',
    icon: EndOfEmploymentIcon,
    permission: 'offboarding.end_of_employment',
    tree: true,
    children: [
      { label: 'All', to: '/end-of-employment/all' },
      { label: 'Completed', to: '/end-of-employment/completed' },
      { label: 'Pending', to: '/end-of-employment/pending' },
    ],
  },
  {
    label: 'Project Management',
    to: '/project-management',
    icon: ProjectManagementIcon,
    permission: 'projects',
    // The Project Management files' side menu (388:137608): four dashboards and Create
    // Workspace, drawn as a tree between Payroll and Performance.
    tree: true,
    children: [
      { label: 'Home Dashboard', to: '/project-management/home' },
      { label: 'Workspace Dashboard', to: '/project-management/workspace-dashboard' },
      { label: 'Project Dashboard', to: '/project-management/project-dashboard' },
      { label: 'Task Dashboard', to: '/project-management/task-dashboard' },
      { label: 'Create Workspace', to: '/project-management/workspaces' },
      // Not drawn: the BRD's "own reminders", listed (they are set from a task's Remind Me).
      { label: 'Reminders', to: '/project-management/reminders' },
    ],
  },
  {
    label: 'Performance',
    to: '/performance',
    icon: PerformanceIcon,
    permission: ['performance', 'training'],
    // Not drawn: the API's screens (goals, KPIs, review cycles and their appraisals).
    tree: true,
    children: [
      { label: 'Overview', to: '/performance/overview' },
      { label: 'Goals', to: '/performance/goals' },
      { label: 'KPIs', to: '/performance/kpis' },
      { label: 'Review Cycles', to: '/performance/cycles' },
      { label: 'Appraisals', to: '/performance/appraisals' },
      { label: 'Reviews', to: '/performance/reviews' },
    ],
  },
  // HRango Dashboard App Version, section Benefits: one item, right after Performance.
  { label: 'Benefits', to: '/benefits', icon: BenefitsIcon, permission: 'benefits' },
  { label: 'Roster', to: '/roster', icon: RosterIcon, permission: 'roster' },
  { label: 'Warning', to: '/warning', icon: WarningIcon, permission: 'warning' },
  { label: 'Scheduling', to: '/scheduling', icon: SchedulingIcon, permission: 'scheduling' },
  { label: 'Configuration', to: '/configuration', icon: ConfigurationIcon },
  {
    label: 'Custom Form',
    to: '/custom-form',
    icon: CustomFormIcon,
    // Not drawn, and no API yet (Backend Dependencies): build, fill and read the answers.
    tree: true,
    children: [
      { label: 'Forms', to: '/custom-form/forms' },
      { label: 'My Forms', to: '/custom-form/my-forms' },
      { label: 'Responses', to: '/custom-form/responses' },
    ],
  },
  {
    label: 'Manpower Planning',
    to: '/manpower-planning',
    icon: ManpowerPlanningIcon,
    permission: 'manpower',
    // HRango Dashboard App Version, page App UI: the Manpower Planning frames' side menu.
    tree: true,
    children: [
      { label: 'Planning', to: '/manpower-planning/planning', icon: PlanningNavIcon },
      { label: 'E-Budgeting', to: '/manpower-planning/e-budgeting', icon: EBudgetingNavIcon },
      {
        label: 'Open Positions',
        to: '/manpower-planning/open-positions',
        icon: OpenPositionsNavIcon,
      },
      {
        label: 'Budget Approvals',
        to: '/manpower-planning/budget-approvals',
        icon: BudgetApprovalsNavIcon,
      },
      {
        label: 'E-Budget Settings',
        to: '/manpower-planning/e-budget-settings',
        icon: EBudgetSettingsNavIcon,
      },
    ],
  },
  {
    label: 'Settings',
    to: '/settings',
    icon: SettingsIcon,
    children: [
      // No API module yet: shown to everyone (a placeholder page).
      { label: 'Custom Forms', to: '/settings/custom-forms' },
      { label: 'Control Panel', to: '/settings/control-panel', permission: 'organisation' },
      {
        label: 'Off Boarding Settings',
        to: '/settings/off-boarding',
        permission: 'offboarding.settings',
      },
      { label: 'System User', to: '/settings/system-users', permission: 'access.users' },
      {
        label: 'User Group Permissions',
        to: '/settings/user-group-permissions',
        permission: 'access.roles',
      },
      {
        label: 'Biometric Devices',
        to: '/settings/biometric-devices',
        permission: 'attendance.settings.devices',
      },
    ],
  },
]
