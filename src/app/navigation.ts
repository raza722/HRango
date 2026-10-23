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
import type { FileRouteTypes } from '@/routeTree.gen'

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
}

/** Sidebar entries, in the order drawn in the Figma side menu. */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', to: '/', icon: DashboardIcon, exact: true },
  { label: 'Recruitment', to: '/recruitment', icon: RecruitmentIcon },
  { label: 'Talent Management', to: '/talent-management', icon: TalentManagementIcon },
  { label: 'Separation Management', to: '/separation-management', icon: SeparationManagementIcon },
  {
    label: 'Attendance',
    to: '/attendance',
    icon: AttendanceIcon,
    children: [
      { label: 'Attendance Overview', to: '/attendance/overview' },
      { label: 'Time Sheet', to: '/attendance/time-sheet' },
      { label: 'Attendance Logs', to: '/attendance/logs' },
      { label: 'Attendance Settings', to: '/attendance/settings' },
    ],
  },
  { label: 'Leaves', to: '/leaves', icon: LeavesNavIcon },
  {
    label: 'Requests',
    to: '/requests',
    icon: RequestsNavIcon,
    // The Request Settings frames (3894:26499) draw the sidebar's Requests as this tree; its
    // items follow the in-page sub menu (Travel and Transfer included, Requisition left out:
    // it has no screens). "Relaxion" and "Deligation" are spelt correctly.
    tree: true,
    children: [
      { label: 'Punch', to: '/requests/punch' },
      { label: 'Expense', to: '/requests/$type', params: { type: 'expense' } },
      { label: 'Leave', to: '/requests/$type', params: { type: 'leave' } },
      { label: 'Shift Request', to: '/requests/shift' },
      { label: 'Loan & Advances', to: '/requests/$type', params: { type: 'loan-advances' } },
      { label: 'Work from Home', to: '/requests/$type', params: { type: 'work-from-home' } },
      { label: 'Official Visit', to: '/requests/$type', params: { type: 'official-visits' } },
      { label: 'Promotion', to: '/requests/$type', params: { type: 'promotion' } },
      { label: 'Relaxation', to: '/requests/$type', params: { type: 'relaxation' } },
      { label: 'Rest Days', to: '/requests/$type', params: { type: 'rest-days' } },
      { label: 'Travel', to: '/requests/$type', params: { type: 'travel' } },
      { label: 'Transfer', to: '/requests/transfer' },
      { label: 'Resignation', to: '/requests/$type', params: { type: 'resignation' } },
      {
        label: 'Settings',
        to: '/requests/settings',
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
    // The Project Management files' side menu (388:137608): four dashboards and Create
    // Workspace, drawn as a tree between Payroll and Performance.
    tree: true,
    children: [
      { label: 'Home Dashboard', to: '/project-management/home' },
      { label: 'Workspace Dashboard', to: '/project-management/workspace-dashboard' },
      { label: 'Project Dashboard', to: '/project-management/project-dashboard' },
      { label: 'Task Dashboard', to: '/project-management/task-dashboard' },
      { label: 'Create Workspace', to: '/project-management/workspaces' },
    ],
  },
  { label: 'Performance', to: '/performance', icon: PerformanceIcon },
  // HRango Dashboard App Version, section Benefits: one item, right after Performance.
  { label: 'Benefits', to: '/benefits', icon: BenefitsIcon },
  { label: 'Roster', to: '/roster', icon: RosterIcon },
  { label: 'Warning', to: '/warning', icon: WarningIcon },
  { label: 'Scheduling', to: '/scheduling', icon: SchedulingIcon },
  { label: 'Configuration', to: '/configuration', icon: ConfigurationIcon },
  { label: 'Custom Form', to: '/custom-form', icon: CustomFormIcon },
  {
    label: 'Manpower Planning',
    to: '/manpower-planning',
    icon: ManpowerPlanningIcon,
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
      { label: 'Custom Forms', to: '/settings/custom-forms' },
      { label: 'Control Panel', to: '/settings/control-panel' },
      { label: 'Off Boarding Settings', to: '/settings/off-boarding' },
      { label: 'System User', to: '/settings/system-users' },
      { label: 'User Group Permissions', to: '/settings/user-group-permissions' },
      { label: 'Biometric Devices', to: '/settings/biometric-devices' },
    ],
  },
]
