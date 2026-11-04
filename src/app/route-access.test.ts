import { describe, expect, it } from 'vitest'

import { filterNavItems, NAV_ITEMS } from '@/app/navigation'
import { canOpen } from '@/app/route-access'
import { can } from '@/lib/permissions'
import type { AuthUser, Permission } from '@/types/auth'

const person = (permissions: Permission[]): AuthUser => ({
  id: '1',
  name: 'Zain Abbas',
  email: 'zain@topedge.tech',
  role: 'Employee',
  avatarUrl: null,
  permissions,
})
const own = (...codes: string[]) => codes.map((code) => ({ code, scope: 'own' }))

describe('canOpen', () => {
  const employee = person(own('payroll.payslips.view', 'assets.allocations.view'))

  it('opens the pages of the screens a person holds, and no others in the module', () => {
    expect(canOpen(employee, '/payroll/pay-slips/my')).toBe(true)
    expect(canOpen(employee, '/assets/allocations')).toBe(true)
    expect(canOpen(employee, '/payroll/settings/tax')).toBe(false)
    expect(canOpen(employee, '/payroll/salary-sheet')).toBe(false)
    expect(canOpen(employee, '/assets/company-assets')).toBe(false)
  })

  it('keeps pages listing everyone from a person who only reaches their own records', () => {
    expect(canOpen(employee, '/payroll/pay-slips/all')).toBe(false)
    const hr = person([{ code: 'payroll.payslips.view', scope: 'company' }])
    expect(canOpen(hr, '/payroll/pay-slips/all')).toBe(true)
  })

  it('leaves pages without a rule open, and everything open on the mock API', () => {
    expect(canOpen(employee, '/')).toBe(true)
    expect(canOpen({ ...employee, permissions: undefined }, '/payroll/settings/tax')).toBe(true)
  })
})

describe('the sidebar', () => {
  const selfService = own(
    'employees.directory.view',
    'attendance.time_sheet.view',
    'scheduling.schedules.view',
    'warning.warnings.view',
    'leaves.applications.view',
    'payroll.payslips.view',
    'payroll.final_settlement.view',
    'assets.allocations.view',
    'assets.clearance.view',
    'offboarding.end_of_employment.view',
  )
  const labels = (user: AuthUser) => filterNavItems(NAV_ITEMS, user).map((item) => item.label)

  it('gives an employee a personal menu, not the HR modules', () => {
    const employee = { ...person(selfService), employeeId: '14' }
    expect(labels(employee)).toEqual([
      'Dashboard',
      'My Profile',
      'Attendance',
      'Leaves',
      'My Pay Slips',
      'My Assets',
    ])
    const attendance = filterNavItems(NAV_ITEMS, employee).find((i) => i.label === 'Attendance')
    expect(attendance?.children?.map((child) => child.label)).toEqual([
      'Time Sheet',
      'My Schedule',
      'My Warnings',
    ])
  })

  it('keeps the modules for those who manage people, without the personal copies', () => {
    const manager = person(selfService.map((p) => ({ ...p, scope: 'team' })))
    const visible = labels({ ...manager, employeeId: '12' })
    expect(visible).toEqual(
      expect.arrayContaining([
        'Talent Management',
        'Payroll',
        'Assets',
        'End of Employment',
        'Scheduling',
      ]),
    )
    expect(visible).not.toContain('My Pay Slips')
    expect(visible).not.toContain('My Assets')
  })

  it('leaves My Profile out for an account with no employee record', () => {
    expect(labels(person(selfService))).not.toContain('My Profile')
  })
})

describe('HR pages typed into the address bar', () => {
  it('stay closed to a person who only reaches their own records', () => {
    const employee = person(
      own(
        'offboarding.end_of_employment.view',
        'payroll.final_settlement.view',
        'assets.clearance.view',
        'performance.kpis.view',
        'scheduling.schedules.view',
        'warning.warnings.view',
      ),
    )
    for (const path of [
      '/separation-management',
      '/end-of-employment/all',
      '/payroll/final-settlement',
      '/assets/clearance-form',
      '/performance/kpis',
      '/scheduling',
      '/warning',
    ]) {
      expect(canOpen(employee, path), path).toBe(false)
    }
    expect(canOpen(employee, '/attendance/scheduling')).toBe(true)
  })
})

describe('the employee directory', () => {
  it('is for those who manage people; a person still opens their own profile', () => {
    const employee = person(own('employees.directory.view'))
    expect(canOpen(employee, '/talent-management/employees')).toBe(false)
    expect(canOpen(employee, '/talent-management/employees/14')).toBe(true)
    const hr = person([{ code: 'employees.directory.view', scope: 'company' }])
    expect(canOpen(hr, '/talent-management/employees')).toBe(true)
  })
})

describe('can with a reach', () => {
  it('reads the scope of the one view code', () => {
    const code = 'performance.goals.view'
    const at = (scope: string) => person([{ code, scope }])
    expect(can(at('own'), `${code}@team`)).toBe(false)
    expect(can(at('team'), `${code}@team`)).toBe(true)
    expect(can(at('team'), `${code}@all`)).toBe(false)
    expect(can(at('company'), `${code}@all`)).toBe(true)
    expect(can(at('own'), code)).toBe(true)
  })
})
