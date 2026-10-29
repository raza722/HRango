import { DEMO_ACCOUNT } from '@/features/auth'

import { createMockCollection } from '../collection'
import { randomHex } from '../utils'
import { codesWhere, PERMISSION_CATALOGUE } from './catalogue'

/*
 * The Access module's tables: accounts, roles with their ticks, per-person overrides, sessions
 * and the audit log. Ids are numeric strings, as the API's are; the roles keep the ids Request
 * Flows' Role nodes use ('1' Company Administrator, '6' HR Manager, '7' HR Officer,
 * '8' Line Manager).
 */

export type StoredScope = 'own' | 'team' | 'department' | 'branch' | 'selected_units' | 'company'
export type StoredUnitType = 'branch' | 'department' | 'location'

export interface StoredTick {
  code: string
  scope: StoredScope
  units: { unitType: StoredUnitType; unitId: string }[]
}

export interface StoredRole {
  id: string
  code: string
  name: string
  description: string | null
  isSystem: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string | null
  rowVersion: string
  permissions: StoredTick[]
}

export interface StoredUser {
  id: string
  email: string
  displayName: string | null
  employeeId: string | null
  /** The first is the home company. */
  companyIds: string[]
  isActive: boolean
  isSystemAdmin: boolean
  lastLoginAt: string | null
  roleIds: string[]
  /** The mock keeps the last password set, only to check "current password". */
  password: string | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface StoredOverride {
  id: string
  userAccountId: string
  code: string
  effect: 'grant' | 'deny'
  scope: StoredScope | null
  reason: string | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface StoredSession {
  id: string
  userAccountId: string
  device: string | null
  ipAddress: string | null
  signedInAt: string
  lastSeenAt: string | null
  expiresAt: string | null
  revokedAt: string | null
}

export interface StoredAudit {
  id: string
  entityType: 'role' | 'user'
  entityId: string
  entityName: string | null
  fieldName: string | null
  oldValue: string | null
  newValue: string | null
  actionName: string | null
  performedAt: string
  performedByUserId: string | null
  performedByName: string | null
}

export const COMPANY_ADMIN_ROLE_ID = '1'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const ahead = (ms: number) => new Date(Date.now() + ms).toISOString()
export const newRowVersion = () => randomHex(8)

const ticks = (
  codes: readonly string[],
  scope: StoredScope,
  units: StoredTick['units'] = [],
): StoredTick[] => codes.map((code) => ({ code, scope, units }))

const inModules = (...modules: string[]) => codesWhere((entry) => modules.includes(entry.module))

/** Merges tick lists; a later list wins for a code. */
const merge = (...lists: StoredTick[][]): StoredTick[] => {
  const byCode = new Map<string, StoredTick>()
  for (const list of lists) for (const tick of list) byCode.set(tick.code, tick)
  return PERMISSION_CATALOGUE.flatMap((entry) => {
    const tick = byCode.get(entry.code)
    return tick ? [tick] : []
  })
}

const REQUEST_SELF_SERVICE = codesWhere(
  (entry) =>
    entry.module === 'Requests' &&
    !entry.code.startsWith('requests.settings.') &&
    !entry.code.startsWith('requests.approvals.') &&
    !entry.code.startsWith('loans.') &&
    entry.actionCode !== 'export',
)

function seedRoles(): StoredRole[] {
  const role = (
    id: string,
    code: string,
    name: string,
    description: string,
    isSystem: boolean,
    permissions: StoredTick[],
    options: { isActive?: boolean; createdDaysAgo?: number; updatedDaysAgo?: number } = {},
  ): StoredRole => ({
    id,
    code,
    name,
    description,
    isSystem,
    isActive: options.isActive ?? true,
    createdAt: ago((options.createdDaysAgo ?? 400) * DAY),
    updatedAt: options.updatedDaysAgo === undefined ? null : ago(options.updatedDaysAgo * DAY),
    rowVersion: `seedrole${id.padStart(8, '0')}`,
    permissions,
  })

  const employee = merge(
    ticks(
      [
        'dashboard.employee.view',
        'inbox.notifications.view',
        'attendance.time_sheet.view',
        'attendance.time_sheet.clock',
        'leaves.balances.view',
        'payroll.payslips.view',
        'payroll.payslips.download',
        'payroll.payslips.print',
        'performance.overview.view',
        'performance.goals.view',
        'performance.goals.check_in',
        'performance.reviews.view',
        'performance.reviews.self',
        'performance.appraisals.view',
        'forms.my_forms.view',
        'forms.my_forms.submit',
        'employees.update_requests.view',
        'employees.update_requests.create',
        'scheduling.schedules.view',
        'projects.workspaces.view',
        'projects.tasks.view',
        'projects.comments.view',
        'projects.comments.create',
        ...REQUEST_SELF_SERVICE,
      ],
      'own',
    ),
  )

  const hrManager = merge(
    ticks(
      [
        ...inModules(
          'Recruitment',
          'Talent Management',
          'Off-boarding',
          'Attendance',
          'Leaves',
          'Requests',
          'Performance',
          'Benefits',
          'Custom Forms',
          'Roster',
          'Warning',
          'Scheduling',
        ),
        'dashboard.hr.view',
        'dashboard.employee.view',
        'inbox.notifications.view',
        ...codesWhere((entry) => entry.module === 'Organisation'),
        'payroll.dashboard.view',
        'payroll.payslips.view',
        'payroll.salary_revision.view',
        'access.users.view',
        'access.users.create',
        'access.users.edit',
        'access.users.disable',
        'access.users.password',
        'access.users.roles',
        'access.users.sessions',
        'access.roles.view',
      ],
      'company',
    ),
  )

  const hrOfficer = merge(
    ticks(
      [
        'dashboard.hr.view',
        'inbox.notifications.view',
        ...inModules('Recruitment').filter((code) => !code.endsWith('.hire')),
        'leaves.settings.types.view',
        'leaves.settings.policies.view',
        'access.users.view',
      ],
      'company',
    ),
    ticks(
      [
        'employees.directory.view',
        'employees.directory.edit',
        'employees.identity.view',
        'leaves.applications.view',
        'leaves.balances.view',
        'attendance.overview.view',
        'attendance.time_sheet.view',
        'attendance.time_sheet.edit',
        'attendance.logs.view',
        'requests.approvals.view',
      ],
      'branch',
    ),
  )

  const lineManager = merge(
    ticks(
      [
        'requests.approvals.view',
        'requests.approvals.approve',
        'requests.approvals.reject',
        'attendance.overview.view',
        'attendance.time_sheet.view',
        'leaves.applications.view',
        'leaves.balances.view',
        'performance.overview.view_team',
        'performance.goals.view_team',
        'performance.goals.create',
        'performance.goals.edit',
        'performance.appraisals.view_team',
        'performance.reviews.manager',
        'scheduling.schedules.view',
        'roster.groups.view',
      ],
      'team',
    ),
  )

  const payrollOfficer = merge(
    ticks(inModules('Payroll'), 'company'),
    ticks(['employees.directory.view', 'leaves.balances.view'], 'company'),
  )

  const recruiter = merge(
    ticks(['recruitment.dashboard.view', 'recruitment.settings.rejection_reasons.view'], 'company'),
    ticks(
      codesWhere(
        (entry) =>
          entry.module === 'Recruitment' &&
          !entry.code.startsWith('recruitment.settings.') &&
          entry.code !== 'recruitment.dashboard.view' &&
          entry.actionCode !== 'hire',
      ),
      'selected_units',
      [
        { unitType: 'branch', unitId: 'br_lhr_ho' },
        { unitType: 'branch', unitId: 'br_khi' },
      ],
    ),
  )

  return [
    role(
      COMPANY_ADMIN_ROLE_ID,
      'company_admin',
      'Company Administrator',
      'Every screen and action of the company. Its permissions are fixed.',
      true,
      ticks(
        PERMISSION_CATALOGUE.map((entry) => entry.code),
        'company',
      ),
      { createdDaysAgo: 600 },
    ),
    role(
      '2',
      'employee',
      'Employee',
      'Self-service: requests, time sheet, pay slips, goals and forms, for their own records.',
      true,
      employee,
      { createdDaysAgo: 600, updatedDaysAgo: 30 },
    ),
    role('6', 'hr_manager', 'HR Manager', 'Runs HR for the whole company.', true, hrManager, {
      createdDaysAgo: 600,
      updatedDaysAgo: 12,
    }),
    role(
      '7',
      'hr_officer',
      'HR Officer',
      'Day-to-day HR for their branch; recruitment across the company.',
      true,
      hrOfficer,
      { createdDaysAgo: 600, updatedDaysAgo: 40 },
    ),
    role(
      '8',
      'line_manager',
      'Line Manager',
      'Approves requests and reviews the people who report to them.',
      true,
      lineManager,
      { createdDaysAgo: 600 },
    ),
    role(
      '9',
      'payroll_officer',
      'Payroll Officer',
      'Runs payroll: settings, pay runs, slips, vouchers and settlements.',
      false,
      payrollOfficer,
      { createdDaysAgo: 300, updatedDaysAgo: 5 },
    ),
    role(
      '10',
      'recruiter',
      'Recruiter',
      'Hiring for the Lahore Head Office and Karachi Sales Office.',
      false,
      recruiter,
      { createdDaysAgo: 200, updatedDaysAgo: 3 },
    ),
    role(
      '11',
      'finance_viewer',
      'Finance Viewer',
      'Reads the payroll dashboard and reports. Nobody holds it yet.',
      false,
      ticks(
        ['payroll.dashboard.view', 'payroll.reports.view', 'payroll.reports.export'],
        'company',
      ),
      { createdDaysAgo: 20 },
    ),
    role(
      '12',
      'it_support',
      'IT Support',
      'Kept for its history: biometric devices and attendance logs.',
      false,
      ticks(
        [
          'attendance.settings.devices.view',
          'attendance.settings.devices.edit',
          'attendance.logs.view',
        ],
        'company',
      ),
      { isActive: false, createdDaysAgo: 500, updatedDaysAgo: 90 },
    ),
  ]
}

const MAIN = 'co_topedge'
const UAE = 'co_topedge_me'

function seedUsers(): StoredUser[] {
  const user = (
    id: string,
    email: string,
    employeeId: string | null,
    roleIds: string[],
    options: {
      displayName?: string
      isActive?: boolean
      isSystemAdmin?: boolean
      lastLoginMs?: number | null
      companyIds?: string[]
      createdDaysAgo?: number
    } = {},
  ): StoredUser => ({
    id,
    email,
    displayName: options.displayName ?? null,
    employeeId,
    companyIds: options.companyIds ?? [MAIN],
    isActive: options.isActive ?? true,
    isSystemAdmin: options.isSystemAdmin ?? false,
    lastLoginAt:
      options.lastLoginMs === null ? null : ago(options.lastLoginMs ?? 2 * DAY + Number(id) * HOUR),
    roleIds,
    password: null,
    createdAt: ago((options.createdDaysAgo ?? 200) * DAY),
    updatedAt: null,
    rowVersion: `seeduser${id.padStart(8, '0')}`,
  })
  return [
    user('1', 'admin@topedge.tech', null, [COMPANY_ADMIN_ROLE_ID], {
      displayName: 'Administrator',
      isSystemAdmin: true,
      lastLoginMs: 3 * DAY,
      companyIds: [MAIN, UAE],
      createdDaysAgo: 600,
    }),
    user('2', DEMO_ACCOUNT.email, 'em_shelley', ['6'], {
      isSystemAdmin: true,
      lastLoginMs: 20 * 60_000,
      companyIds: [MAIN, UAE],
      createdDaysAgo: 580,
    }),
    user('3', 'kaleem.murtaza@topedge.tech', 'em_kaleem', ['7', '2']),
    user('4', 'sadia.rehman@topedge.tech', 'em_sadia', ['7', '10', '2']),
    user('5', 'laiba.shah@topedge.tech', 'em_laiba', ['10', '2'], { createdDaysAgo: 90 }),
    user('6', 'omer.farooq@topedge.tech', 'em_omer', ['9', '2']),
    user('7', 'hina.raza@topedge.tech', 'em_hina', ['9', '8', '2']),
    user('8', 'bilal.ahmed@topedge.tech', 'em_bilal', ['8', '2']),
    user('9', 'sara.khan@topedge.tech', 'em_sara', ['8', '2']),
    user('10', 'daniel.brooks@topedge.tech', 'em_daniel', ['8', '2'], {
      companyIds: [UAE, MAIN],
    }),
    user('11', 'haroon.jalani@topedge.tech', 'em_haroon', ['2'], { lastLoginMs: 6 * HOUR }),
    // Left the company (Off-boarding completed) but the account is still on.
    user('12', 'nida.hassan@topedge.tech', 'em_nida', ['2'], { lastLoginMs: 55 * DAY }),
    user('13', 'faisal.khan@topedge.tech', 'em_faisal', ['2'], {
      isActive: false,
      lastLoginMs: 120 * DAY,
    }),
  ]
}

function seedOverrides(): StoredOverride[] {
  return [
    {
      id: '1',
      userAccountId: '6',
      code: 'payroll.payrolls.close',
      effect: 'deny',
      scope: null,
      reason: 'Closing a payroll needs Hina Raza’s sign-off.',
      createdAt: ago(25 * DAY),
      updatedAt: null,
      rowVersion: 'seedover00000001',
    },
    {
      id: '2',
      userAccountId: '9',
      code: 'payroll.reports.view',
      effect: 'grant',
      scope: 'department',
      reason: 'Sales commission reports for her department.',
      createdAt: ago(14 * DAY),
      updatedAt: null,
      rowVersion: 'seedover00000002',
    },
    {
      id: '3',
      userAccountId: '2',
      code: 'payroll.vouchers.view',
      effect: 'grant',
      scope: 'company',
      reason: 'Audit of employee vouchers this quarter.',
      createdAt: ago(8 * DAY),
      updatedAt: null,
      rowVersion: 'seedover00000003',
    },
  ]
}

function seedSessions(): StoredSession[] {
  const session = (
    id: string,
    userAccountId: string,
    device: string,
    ipAddress: string,
    signedInMs: number,
    lastSeenMs: number,
    revokedMs: number | null = null,
  ): StoredSession => ({
    id,
    userAccountId,
    device,
    ipAddress,
    signedInAt: ago(signedInMs),
    lastSeenAt: ago(lastSeenMs),
    expiresAt: revokedMs === null ? ahead(7 * DAY - signedInMs) : ago(revokedMs),
    revokedAt: revokedMs === null ? null : ago(revokedMs),
  })
  return [
    session('1', '2', 'Chrome 141 on Windows', '10.20.30.68', 2 * HOUR, 60_000),
    session('2', '2', 'Safari on iPhone', '39.42.110.7', 2 * DAY, 5 * HOUR),
    session('3', '1', 'Edge on Windows', '10.20.30.12', 3 * DAY, 3 * DAY - HOUR, 2 * DAY),
    session('4', '3', 'Chrome on Android', '39.40.18.201', DAY, 3 * HOUR),
    session('5', '6', 'Firefox on Ubuntu', '10.20.30.44', 5 * HOUR, 20 * 60_000),
    session('6', '6', 'Chrome on macOS', '10.20.30.45', 4 * DAY, 3 * DAY, 3 * DAY),
    session('7', '9', 'Chrome on Windows', '182.180.64.9', 9 * HOUR, 2 * HOUR),
    session('8', '9', 'Samsung Internet on Android', '182.180.64.10', 3 * DAY, DAY),
    session('9', '12', 'Chrome on Windows', '10.20.30.73', 55 * DAY, 55 * DAY - HOUR, 54 * DAY),
    session('10', '13', 'Edge on Windows', '10.20.30.81', 121 * DAY, 120 * DAY, 100 * DAY),
    session('11', '11', 'Chrome on Windows', '10.20.30.90', 6 * HOUR, 30 * 60_000),
  ]
}

function seedAudit(): StoredAudit[] {
  const entry = (
    id: string,
    entityType: 'role' | 'user',
    entityId: string,
    entityName: string,
    actionName: string,
    daysAgo: number,
    change: { field?: string; from?: string; to?: string } = {},
    by: { id: string; name: string } = { id: '1', name: 'Administrator' },
  ): StoredAudit => ({
    id,
    entityType,
    entityId,
    entityName,
    fieldName: change.field ?? null,
    oldValue: change.from ?? null,
    newValue: change.to ?? null,
    actionName,
    performedAt: ago(daysAgo * DAY),
    performedByUserId: by.id,
    performedByName: by.name,
  })
  const shelley = { id: '2', name: 'Shelley Kannes' }
  return [
    entry('1', 'role', '9', 'Payroll Officer', 'Created', 300),
    entry(
      '2',
      'role',
      '9',
      'Payroll Officer',
      'Permissions changed',
      5,
      {
        field: 'permissions',
        from: '74 permissions',
        to: '76 permissions',
      },
      shelley,
    ),
    entry('3', 'role', '10', 'Recruiter', 'Created', 200),
    entry(
      '4',
      'role',
      '10',
      'Recruiter',
      'Permissions changed',
      3,
      {
        field: 'scope',
        from: 'Company',
        to: 'Selected units: Lahore Head Office, Karachi Sales Office',
      },
      shelley,
    ),
    entry('5', 'role', '6', 'HR Manager', 'Permissions changed', 12, {
      field: 'permissions',
      to: 'Added System Users: Set passwords',
    }),
    entry('6', 'role', '12', 'IT Support', 'Retired', 90),
    entry('7', 'role', '11', 'Finance Viewer', 'Created', 20, {}, shelley),
    entry('8', 'user', '13', 'Faisal Khan', 'Disabled', 100, {
      field: 'isActive',
      from: 'Active',
      to: 'Disabled',
    }),
    entry('9', 'user', '6', 'Omer Farooq', 'Override added', 25, {
      field: 'payroll.payrolls.close',
      to: 'Denied',
    }),
    entry(
      '10',
      'user',
      '9',
      'Sara Khan',
      'Override added',
      14,
      {
        field: 'payroll.reports.view',
        to: 'Granted (Department)',
      },
      shelley,
    ),
    entry('11', 'user', '5', 'Laiba Shah', 'Created', 90, {}, shelley),
    entry(
      '12',
      'user',
      '5',
      'Laiba Shah',
      'Roles changed',
      90,
      {
        field: 'roles',
        from: 'Employee',
        to: 'Recruiter, Employee',
      },
      shelley,
    ),
    entry('13', 'user', '2', 'Shelley Kannes', 'Override added', 8, {
      field: 'payroll.vouchers.view',
      to: 'Granted (Company)',
    }),
    entry('14', 'user', '2', 'Shelley Kannes', 'Password set', 40),
    entry('15', 'user', '1', 'Administrator', 'Sessions ended', 2, { to: '1 session' }, shelley),
  ]
}

export const accessRoles = createMockCollection<StoredRole>({
  storageKey: 'mock.access.roles',
  seed: seedRoles,
})
export const accessUsers = createMockCollection<StoredUser>({
  storageKey: 'mock.access.users',
  seed: seedUsers,
})
export const accessOverrides = createMockCollection<StoredOverride>({
  storageKey: 'mock.access.overrides',
  seed: seedOverrides,
})
export const accessSessions = createMockCollection<StoredSession>({
  storageKey: 'mock.access.sessions',
  seed: seedSessions,
})
export const accessAudit = createMockCollection<StoredAudit>({
  storageKey: 'mock.access.audit',
  seed: seedAudit,
})

/** The next numeric id of a table. */
export const nextId = (rows: readonly { id: string }[]) =>
  String(rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1)

export function resetAccessTables(): void {
  accessRoles.reset()
  accessUsers.reset()
  accessOverrides.reset()
  accessSessions.reset()
  accessAudit.reset()
}
