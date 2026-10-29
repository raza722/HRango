/*
 * The permission catalogue the mock's `GET /access/permissions` serves: every code the screens
 * of this app check (`useCan('…')`, `can(user, '…')`, the sidebar prefixes in `navigation.ts`,
 * `PERF_CODES`, `RC_CODES`, `CF_CODES`, `TM_CODES`, `PAYROLL_CODES`, the request type codes),
 * grouped by module and screen in the sidebar's order, so the role editor matches the app.
 * Payroll, access and salary codes are sensitive.
 */

/** One screen: its code prefix, readable name, the actions it checks and optional help text. */
type ScreenRow = readonly [
  prefix: string,
  screen: string,
  actions: readonly string[],
  hints?: Readonly<Record<string, string>>,
]

interface ModuleRow {
  module: string
  screens: readonly ScreenRow[]
}

const CRUD = ['view', 'create', 'edit', 'delete'] as const
const REQUEST = ['view', 'create', 'cancel', 'export'] as const

const MODULES: readonly ModuleRow[] = [
  {
    module: 'Dashboards',
    screens: [
      ['dashboard.employee', 'Employee Dashboard', ['view']],
      ['dashboard.hr', 'HR Dashboard', ['view']],
      ['dashboard.ceo', 'CEO Dashboard', ['view'], { view: 'Company-wide headcount and cost.' }],
      ['inbox.notifications', 'Inbox', ['view']],
    ],
  },
  {
    module: 'Recruitment',
    screens: [
      ['recruitment.dashboard', 'Dashboard', ['view']],
      [
        'recruitment.openings',
        'Job Openings',
        ['view', 'create', 'edit', 'delete', 'publish', 'hold', 'close', 'reopen'],
      ],
      ['recruitment.applicants', 'Candidates', CRUD],
      [
        'recruitment.applications',
        'Applications',
        ['view', 'create', 'delete', 'move', 'reject', 'withdraw', 'hire'],
        { hire: 'Creates the employee record from the application.' },
      ],
      [
        'recruitment.interviews',
        'Interviews',
        ['view', 'create', 'edit', 'cancel', 'complete', 'evaluate'],
      ],
      [
        'recruitment.offers',
        'Offers',
        ['view', 'create', 'edit', 'delete', 'send', 'respond', 'withdraw'],
        { view: 'Offers show the salary offered.' },
      ],
      ['recruitment.settings.rejection_reasons', 'Rejection Reasons', CRUD],
    ],
  },
  {
    module: 'Talent Management',
    screens: [
      ['employees.directory', 'Employees', ['view', 'create', 'edit', 'deactivate']],
      [
        'employees.identity',
        'Identity Documents',
        ['view', 'edit'],
        { edit: 'CNIC and passport.' },
      ],
      ['employees.update_requests', 'Update Requests', ['view', 'create']],
    ],
  },
  {
    module: 'Off-boarding',
    screens: [
      [
        'offboarding.end_of_employment',
        'End of Employment',
        CRUD,
        { create: 'Starts the leaving process for an employee.' },
      ],
      ['offboarding.rehire', 'Rehire', ['process']],
      ['offboarding.settings.checklist', 'Off Boarding Checklist', CRUD],
    ],
  },
  {
    module: 'Attendance',
    screens: [
      ['attendance.overview', 'Overview', ['view', 'export']],
      [
        'attendance.time_sheet',
        'Time Sheet',
        ['view', 'edit', 'clock', 'process', 'export'],
        { process: 'Recalculates the days from the punches.' },
      ],
      [
        'attendance.logs',
        'Attendance Logs',
        ['view', 'create', 'edit', 'delete', 'import', 'export'],
      ],
      ['attendance.settings.basic', 'Settings › Basic', ['view', 'edit']],
      ['attendance.settings.geo_fencing', 'Settings › Geo Fencing', CRUD],
      ['attendance.settings.ip_restrictions', 'Settings › IP Restrictions', CRUD],
      ['attendance.settings.overtime', 'Settings › Overtime', ['view', 'edit']],
      ['attendance.settings.overtime_policies', 'Settings › Overtime Policies', CRUD],
      ['attendance.settings.devices', 'Biometric Devices', CRUD],
    ],
  },
  {
    module: 'Leaves',
    screens: [
      ['leaves.applications', 'Leave Applications', ['view']],
      ['leaves.balances', 'Leave Balances', ['view']],
      ['leaves.allotment', 'Allotment', ['view', 'process']],
      ['leaves.settings.general', 'Settings › General', ['view', 'edit']],
      ['leaves.settings.types', 'Settings › Leave Types', CRUD],
      ['leaves.settings.policies', 'Settings › Leave Policies', [...CRUD, 'enroll']],
    ],
  },
  {
    module: 'Requests',
    screens: [
      [
        'requests.approvals',
        'Approvals',
        ['view', 'approve', 'reject'],
        { approve: 'Approves the requests waiting on this person.' },
      ],
      ['requests.punch', 'Punch', REQUEST],
      ['requests.expense', 'Expense', REQUEST],
      ['requests.leave', 'Leave', REQUEST],
      ['requests.shift_swap', 'Shift Request', REQUEST],
      ['requests.loan', 'Loan & Advances', REQUEST],
      ['requests.work_from_home', 'Work From Home', REQUEST],
      ['requests.official_visit', 'Official Visits', REQUEST],
      [
        'requests.promotion',
        'Promotion',
        REQUEST,
        { create: 'A promotion can carry a salary revision.' },
      ],
      ['requests.relaxation', 'Relaxation', REQUEST],
      ['requests.rest_day', 'Rest Days', REQUEST],
      ['requests.travel', 'Travel', REQUEST],
      ['requests.transfer', 'Transfer', REQUEST],
      ['requests.resignation', 'Resignation', REQUEST],
      ['requests.air_ticket', 'Air Tickets', REQUEST],
      ['requests.requisition', 'Requisition', REQUEST],
      ['requests.overtime', 'Overtime', ['view', 'create', 'cancel']],
      ['requests.settings.restrictions', 'Settings › Request Restriction', CRUD],
      ['requests.settings.delegations', 'Settings › Delegation', CRUD],
      ['requests.settings.flows', 'Settings › Request Flows', CRUD],
      ['requests.settings.authorities', 'Settings › Authorities', CRUD],
      ['requests.settings.expense_categories', 'Settings › Expense Categories', CRUD],
      ['requests.settings.reimbursement', 'Settings › Reimbursement', ['view', 'edit']],
      ['loans.settings.types', 'Settings › Loan Types', CRUD],
      ['loans.settings.categories', 'Settings › Loan Categories', CRUD],
    ],
  },
  {
    module: 'Payroll',
    screens: [
      ['payroll.dashboard', 'Dashboard', ['view'], { view: 'Shows the company’s pay totals.' }],
      ['payroll.settings.general', 'Settings › General', ['view', 'edit']],
      ['payroll.settings.tax', 'Settings › Tax', CRUD],
      ['payroll.settings.rewards', 'Settings › Rewards', CRUD],
      ['payroll.settings.pay_components', 'Settings › Pay Components', CRUD],
      ['payroll.settings.account_types', 'Settings › Account Type', CRUD],
      ['payroll.settings.disbursement_banks', 'Settings › Disbursement Banks', CRUD],
      [
        'payroll.payrolls',
        'Monthly Payroll',
        ['view', 'create', 'edit', 'delete', 'process', 'close'],
        { process: 'Runs the pay engine over every employee of the payroll.' },
      ],
      [
        'payroll.daily_wages',
        'Daily Wages',
        ['view', 'create', 'edit', 'delete', 'process', 'close', 'export'],
      ],
      ['payroll.salary_sheet', 'Salary Sheet', ['view', 'print', 'export']],
      [
        'payroll.payslips',
        'Pay Slips',
        ['view', 'edit', 'process', 'print', 'download', 'export'],
        { view: 'With the Company scope: everyone’s pay slips.' },
      ],
      [
        'payroll.vouchers',
        'Vouchers',
        ['view', 'create', 'edit', 'delete', 'verify', 'approve', 'reject'],
      ],
      ['payroll.final_settlement', 'Final Settlement', ['view', 'process', 'close']],
      ['payroll.opening_balances', 'Opening Balance', [...CRUD, 'import']],
      ['payroll.employee_accounts', 'Employee Accounts', [...CRUD, 'import']],
      [
        'payroll.salary_revision',
        'Salary Revision',
        [...CRUD, 'import'],
        { view: 'Shows current and revised salaries.' },
      ],
      ['payroll.leave_encashment', 'Leave Encashment', CRUD],
      ['payroll.reports', 'Reports', ['view', 'export']],
    ],
  },
  {
    module: 'Assets',
    screens: [
      ['assets.company_assets', 'Company Assets', CRUD],
      ['assets.allocations', 'Asset Allocations', ['view', 'assign']],
      ['assets.types', 'Asset Types', CRUD],
      ['assets.clearance', 'Asset Clearance Form', [...CRUD, 'approve']],
    ],
  },
  {
    module: 'Project Management',
    screens: [
      ['projects.workspaces', 'Workspaces', CRUD],
      ['projects.lists', 'Lists', ['view', 'create']],
      ['projects.tasks', 'Tasks', [...CRUD, 'assign']],
      ['projects.comments', 'Comments', CRUD],
      ['projects.time_tracking', 'Time Tracking', ['view', 'create', 'delete']],
      ['projects.reminders', 'Reminders', ['view', 'create']],
      ['projects.sharing', 'Sharing', ['view', 'edit']],
    ],
  },
  {
    module: 'Performance',
    screens: [
      ['performance.overview', 'Overview', ['view', 'view_team']],
      [
        'performance.goals',
        'Goals',
        ['view', 'view_team', 'view_all', 'create', 'edit', 'delete', 'check_in'],
      ],
      ['performance.kpis', 'KPIs', CRUD],
      [
        'performance.cycles',
        'Review Cycles',
        ['view', 'create', 'edit', 'delete', 'participants', 'launch', 'close'],
      ],
      [
        'performance.appraisals',
        'Appraisals',
        ['view', 'view_team', 'view_all', 'finalise', 'delete'],
        { finalise: 'Sets the final score, which salary increments follow.' },
      ],
      ['performance.reviews', 'Reviews', ['view', 'view_all', 'self', 'manager']],
    ],
  },
  {
    module: 'Benefits',
    screens: [
      ['benefits.plan_years', 'Plan Years', CRUD],
      ['benefits.plans', 'Plans', ['view', 'create', 'delete']],
      ['benefits.enrollment_windows', 'Enrollment Windows', ['view', 'create', 'delete']],
      ['benefits.files', 'Files', ['view', 'create', 'delete', 'download']],
    ],
  },
  {
    module: 'Roster',
    screens: [
      ['roster.groups', 'Roster Groups', CRUD],
      ['roster.enrolments', 'Enrolments', ['view', 'enroll', 'edit', 'delete']],
    ],
  },
  {
    module: 'Warning',
    screens: [
      ['warning.settings.policies', 'Warning Policies', CRUD],
      ['warning.settings.penalties', 'Penalties', ['view', 'edit']],
      ['warning.settings.history', 'History', ['view']],
    ],
  },
  {
    module: 'Scheduling',
    screens: [
      ['scheduling.schedules', 'Schedules', [...CRUD, 'export']],
      ['scheduling.settings.rest_days', 'Settings › Rest Days', CRUD],
      ['scheduling.settings.break_types', 'Settings › Break Types', CRUD],
      ['scheduling.settings.holidays', 'Settings › Holidays', CRUD],
    ],
  },
  {
    module: 'Custom Forms',
    screens: [
      ['forms.forms', 'Forms', [...CRUD, 'publish']],
      ['forms.my_forms', 'My Forms', ['view', 'submit']],
      ['forms.responses', 'Responses', ['view', 'export']],
    ],
  },
  {
    module: 'Manpower Planning',
    screens: [
      ['manpower.planning', 'Planning', CRUD],
      ['manpower.e_budgeting', 'E-Budgeting', CRUD],
      [
        'manpower.open_positions',
        'Open Positions',
        ['view', 'edit', 'close', 'reopen', 'download'],
      ],
      ['manpower.budget_approvals', 'Budget Approvals', ['view', 'approve', 'reject']],
      ['manpower.settings.positions', 'Settings › Positions', [...CRUD, 'import']],
      ['manpower.settings.budget_durations', 'Settings › Budget Durations', CRUD],
    ],
  },
  {
    module: 'Organisation',
    screens: [
      ['organisation.general', 'General Settings', ['view', 'edit']],
      ['organisation.branches', 'Branches', CRUD],
      ['organisation.locations', 'Locations', CRUD],
      ['organisation.areas', 'Areas', CRUD],
      ['organisation.job_titles', 'Job Titles', CRUD],
    ],
  },
  {
    module: 'Access',
    screens: [
      [
        'access.users',
        'System Users',
        ['view', 'create', 'edit', 'disable', 'password', 'roles', 'overrides', 'sessions'],
        {
          view: 'Lists every account with its roles and last sign-in.',
          create: 'Adds accounts that can sign in to the portal.',
          edit: 'Changes an account’s email, employee, companies and system admin.',
          disable: 'Switches accounts off and on; disabling ends their sessions.',
          password: 'Sets a new password for someone else and signs them out.',
          roles: 'Gives and takes away roles, which is all the access a role holds.',
          overrides: 'Grants or denies single permissions to one person.',
          sessions: 'Sees where people are signed in and signs them out.',
        },
      ],
      [
        'access.roles',
        'User Group Permissions',
        ['view', 'create', 'edit', 'delete', 'permissions'],
        {
          view: 'Lists the roles and what each may do.',
          create: 'Adds and copies roles.',
          edit: 'Renames, retires and restores roles.',
          delete: 'Deletes roles nobody holds.',
          permissions: 'Changes what every holder of a role may do.',
        },
      ],
    ],
  },
]

/** What the tick says (`label` is "<screen>: <action>"). */
export const ACTION_LABELS: Readonly<Record<string, string>> = {
  view: 'View',
  view_team: 'View team',
  view_all: 'View everyone',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  approve: 'Approve',
  reject: 'Reject',
  export: 'Export',
  import: 'Import',
  process: 'Process',
  close: 'Close',
  print: 'Print',
  download: 'Download',
  assign: 'Assign',
  cancel: 'Cancel',
  clock: 'Clock in and out',
  verify: 'Verify',
  publish: 'Publish',
  submit: 'Submit',
  hire: 'Hire',
  launch: 'Launch',
  finalise: 'Finalise',
  check_in: 'Check in',
  self: 'Write self review',
  manager: 'Write manager review',
  participants: 'Manage participants',
  hold: 'Put on hold',
  reopen: 'Reopen',
  move: 'Move between stages',
  withdraw: 'Withdraw',
  complete: 'Complete',
  evaluate: 'Evaluate',
  send: 'Send',
  respond: 'Record response',
  enroll: 'Enroll',
  deactivate: 'Deactivate',
  disable: 'Enable and disable',
  password: 'Set passwords',
  roles: 'Assign roles',
  overrides: 'Grant and deny',
  sessions: 'End sessions',
  permissions: 'Edit permissions',
}

const SENSITIVE_HINT = 'Shows pay and salary figures.'

/** Payroll, access and salary codes. */
const isSensitiveCode = (code: string) =>
  code.startsWith('payroll.') || code.startsWith('access.') || code.includes('salary')

export interface CatalogueEntry {
  id: string
  code: string
  module: string
  screen: string
  actionCode: string
  label: string
  hint: string | null
  isSensitive: boolean
}

/** Every tick, in screen order. */
export const PERMISSION_CATALOGUE: readonly CatalogueEntry[] = MODULES.flatMap(
  ({ module, screens }) =>
    screens.flatMap(([prefix, screen, actions, hints]) =>
      actions.map((actionCode) => {
        const code = `${prefix}.${actionCode}`
        const isSensitive = isSensitiveCode(code)
        return {
          code,
          module,
          screen,
          actionCode,
          label: `${screen}: ${ACTION_LABELS[actionCode] ?? actionCode}`,
          hint:
            hints?.[actionCode] ??
            (isSensitive && prefix.startsWith('payroll.') ? SENSITIVE_HINT : null),
          isSensitive,
        }
      }),
    ),
).map((entry, index) => ({ id: String(index + 1), ...entry }))

const BY_CODE = new Map(PERMISSION_CATALOGUE.map((entry) => [entry.code, entry]))

export const catalogueEntry = (code: string): CatalogueEntry | undefined => BY_CODE.get(code)

/** Codes of one module (`'Payroll'`) or under a prefix (`'requests.'`). */
export const codesWhere = (test: (entry: CatalogueEntry) => boolean): string[] =>
  PERMISSION_CATALOGUE.filter(test).map((entry) => entry.code)
