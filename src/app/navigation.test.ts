import { describe, expect, it } from 'vitest'

import type { AuthUser } from '@/types/auth'

import { filterNavItems, NAV_ITEMS } from './navigation'

const person: AuthUser = {
  id: 'usr_1',
  name: 'Test Person',
  email: 'test@example.com',
  role: 'HR Officer',
  avatarUrl: null,
}

/** A user who holds exactly these codes (as `/auth/me` sends them). */
const holding = (...codes: string[]): AuthUser => ({
  ...person,
  permissions: codes.map((code) => ({ code, scope: 'company' })),
})

const labels = (user: AuthUser | null) => filterNavItems(NAV_ITEMS, user).map((item) => item.label)

describe('filterNavItems', () => {
  it('keeps every entry when the user has no permissions list (mock API)', () => {
    expect(labels(person)).toEqual(NAV_ITEMS.map((item) => item.label))
  })

  it('shows a module only when the user may view one of its screens', () => {
    const visible = labels(holding('leaves.applications.view', 'payroll.settings.tax.view'))
    expect(visible).toContain('Leaves')
    // A settings tab two levels down counts too.
    expect(visible).toContain('Payroll')
    expect(visible).not.toContain('Recruitment')
    expect(visible).not.toContain('Warning')
    // Entries with no API module yet stay.
    expect(visible).toContain('Dashboard')
    expect(visible).toContain('Configuration')
  })

  it('needs a view code: other actions alone do not show the entry', () => {
    expect(labels(holding('warning.settings.policies.create'))).not.toContain('Warning')
  })

  it('filters children and drops a parent whose children are all hidden', () => {
    const items = filterNavItems(NAV_ITEMS, holding('attendance.logs.view'))
    const attendance = items.find((item) => item.label === 'Attendance')
    expect(attendance?.children?.map((child) => child.label)).toEqual(['Attendance Logs'])

    const requests = filterNavItems(NAV_ITEMS, holding('requests.leave.view')).find(
      (item) => item.label === 'Requests',
    )
    expect(requests?.children?.map((child) => child.label)).toEqual(['Leave'])
  })

  it('shows Settings → Control Panel for organisation codes only', () => {
    const settings = (user: AuthUser) =>
      filterNavItems(NAV_ITEMS, user)
        .find((item) => item.label === 'Settings')
        ?.children?.map((child) => child.label)

    expect(settings(holding('organisation.branches.view'))).toEqual([
      'Custom Forms',
      'Control Panel',
    ])
    expect(settings(holding('access.users.view'))).toEqual(['Custom Forms', 'System User'])
  })
})
