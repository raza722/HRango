import { screen, waitFor, within } from '@testing-library/react'
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  parseISO,
  setDate,
  startOfMonth,
  subMonths,
} from 'date-fns'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { PRESENT_STATUSES } from '@/features/attendance'
import { wireStatus } from '@/mocks/attendance/backend'
import { computeDay, takeSnapshot } from '@/mocks/attendance/engine'
import { DEMO_USER } from '@/mocks/auth/handlers'
import { DIRECTORY } from '@/mocks/employees/seed'
import { leaveRequestRows } from '@/mocks/leaves/requests'
import { server } from '@/mocks/node'
import { openings } from '@/mocks/recruitment/db'
import { employees } from '@/mocks/talent-management/db'
import { apiPath } from '@/mocks/utils'
import { useAuthStore } from '@/stores/auth-store'
import { renderApp, setViewportWidth } from '@/test/test-utils'

const FIRST_LOAD = { timeout: 15_000 }
const EMPLOYED = new Set(['active', 'probation', 'notice'])

/** Renders as a user who holds only these permission codes (as the API's `/auth/me` sends them). */
function renderAs(path: string, codes: string[]) {
  const result = renderApp(path)
  useAuthStore.getState().setSession({
    token: useAuthStore.getState().token ?? '',
    user: { ...DEMO_USER, permissions: codes.map((code) => ({ code, scope: 'company' })) },
  })
  return result
}

/** A key figure's tile, by its label. */
function tile(label: string, list = 'Key figures') {
  const figures = screen.getByRole('list', { name: list })
  const item = within(figures)
    .getAllByRole('listitem')
    .find((li) => within(li).queryByText(label, { exact: true }))
  if (!item) throw new Error(`No tile ${label}`)
  return item
}

/** Today's counts straight from the attendance engine, as Attendance shows them. */
function attendanceToday() {
  const snap = takeSnapshot()
  const counts = { present: 0, absent: 0, onLeave: 0 }
  for (const person of DIRECTORY) {
    const status = computeDay(snap, person.id, snap.today).day.status
    if (status === null) continue
    const wire = wireStatus(status)
    if (PRESENT_STATUSES.has(wire)) counts.present += 1
    else if (wire === 'absent') counts.absent += 1
    else if (wire === 'leave') counts.onLeave += 1
  }
  return counts
}

/** The days worked, absent and on leave from → to, as the time sheet counts them. */
function attendanceBetween(from: string, to: string) {
  const snap = takeSnapshot()
  const counts = { present: 0, absent: 0, onLeave: 0 }
  for (const date of eachDayOfInterval({ start: parseISO(from), end: parseISO(to) })) {
    const value = format(date, 'yyyy-MM-dd')
    for (const person of DIRECTORY) {
      const status = computeDay(snap, person.id, value).day.status
      if (status === null) continue
      const wire = wireStatus(status)
      if (PRESENT_STATUSES.has(wire)) counts.present += 1
      else if (wire === 'absent') counts.absent += 1
      else if (wire === 'leave') counts.onLeave += 1
    }
  }
  return counts
}

/** Talent Management's people who joined in a month (`yyyy-MM`). */
const hiresIn = (month: string) =>
  employees.all().filter((person) => person.joiningDate?.startsWith(month)).length

describe('Dashboard', { timeout: 60_000 }, () => {
  it('shows key figures that agree with Talent Management, Attendance and Recruitment', async () => {
    // From and To both today: the attendance tiles are today's people.
    const todayValue = format(new Date(), 'yyyy-MM-dd')
    renderApp(`/?from=${todayValue}&to=${todayValue}`)

    expect(
      await screen.findByRole('heading', { name: 'Dashboard', level: 1 }, FIRST_LOAD),
    ).toBeVisible()
    const headcount = employees.all().filter((person) => EMPLOYED.has(person.status)).length
    const women = employees
      .all()
      .filter((person) => EMPLOYED.has(person.status) && person.gender === 'female').length
    await waitFor(() => {
      expect(within(tile('Headcount')).getByText(String(headcount))).toBeVisible()
    }, FIRST_LOAD)
    expect(headcount).toBe(34)
    expect(
      within(tile('Headcount')).getByText(`${((women / headcount) * 100).toFixed(1)}% women`),
    ).toBeVisible()

    const today = attendanceToday()
    const expected = today.present + today.absent + today.onLeave
    expect(within(tile('Present today')).getByText(String(today.present))).toBeVisible()
    expect(
      within(tile('Present today')).getByText(
        expected > 0
          ? `of ${String(expected)} expected · ${((today.present / expected) * 100).toFixed(1)}%`
          : 'Nobody expected yet',
      ),
    ).toBeVisible()
    expect(within(tile('On leave today')).getByText(String(today.onLeave))).toBeVisible()
    const rate = expected > 0 ? (today.absent / expected) * 100 : 0
    expect(within(tile('Absenteeism')).getByText(`${rate.toFixed(1)}%`)).toBeVisible()

    const thisMonth = format(new Date(), 'yyyy-MM')
    expect(
      screen.getByRole('link', { name: `New hires: ${String(hiresIn(thisMonth))}` }),
    ).toBeVisible()

    const open = openings.all().filter((opening) => opening.status === 'open').length
    await waitFor(() => {
      expect(within(tile('Open positions')).getByText(String(open))).toBeVisible()
    })

    // The workforce cards read the same records: one bar per department, largest first.
    const departments = screen.getByRole('list', { name: 'Headcount by department' })
    const names = new Set(employees.all().map((person) => person.departmentName))
    expect(within(departments).getAllByRole('listitem')).toHaveLength(names.size)
  })

  it('opens each figure’s list', async () => {
    const { user, router } = renderApp('/')
    const day = format(new Date(), 'yyyy-MM-dd')

    const headcount = await screen.findByRole('link', { name: /^Headcount: / }, FIRST_LOAD)
    expect(headcount).toHaveAttribute('href', '/talent-management/employees')
    // By default the dates are this month up to today (one day on the 1st).
    const monthStart = `${day.slice(0, 7)}-01`
    const present = await screen.findByRole('link', {
      name: monthStart === day ? /^Present today: / : /^Present: /,
    })
    expect(present.getAttribute('href')).toContain('/attendance/time-sheet?')
    expect(present.getAttribute('href')).toContain(`from=${monthStart}`)
    expect(present.getAttribute('href')).toContain(`to=${day}`)
    expect(screen.getByRole('link', { name: /^Absenteeism: / }).getAttribute('href')).toContain(
      'dayStatus=absent',
    )
    expect(screen.getByRole('link', { name: /^Leavers: / }).getAttribute('href')).toBe(
      '/talent-management/employees?includeInactive=true',
    )

    await user.click(await screen.findByRole('link', { name: /^Open positions: / }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/recruitment/openings')
    })
    expect(router.state.location.search).toMatchObject({ status: 'open' })
  })

  it('shows a failed read in its own widget, with Try again', async () => {
    server.use(
      http.get(
        apiPath('/payroll/dashboard'),
        () => HttpResponse.json({ message: 'Payroll is not answering.' }, { status: 500 }),
        { once: true },
      ),
    )
    const { user } = renderApp('/')

    const payroll = await screen.findByRole('region', { name: 'Payroll' }, FIRST_LOAD)
    const alert = await within(payroll).findByRole('alert')
    expect(alert).toHaveTextContent('Payroll could not be loaded.')
    // The other widgets are unaffected.
    expect(screen.getByRole('region', { name: 'Recruitment' })).toBeVisible()

    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await within(payroll).findByText('Net payable')).toBeVisible()
    expect(within(payroll).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a failed dashboard read as errors, never as empty charts', async () => {
    server.use(
      http.get(
        apiPath('/dashboard/hr'),
        () => HttpResponse.json({ message: 'The dashboard is not answering.' }, { status: 500 }),
        { once: true },
      ),
    )
    const { user } = renderApp('/')

    const figures = await screen.findByRole('list', { name: 'Key figures' }, FIRST_LOAD)
    const alert = await within(figures).findByRole('alert')
    expect(alert).toHaveTextContent('The key figures could not be loaded.')
    const byMonth = screen.getByRole('region', { name: 'Attendance by month' })
    expect(within(byMonth).getByRole('alert')).toHaveTextContent('could not be loaded')
    expect(within(byMonth).queryByRole('group')).not.toBeInTheDocument()

    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('link', { name: /^Headcount: / })).toBeVisible()
    expect(within(byMonth).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('leaves out what the user may not see', async () => {
    renderAs('/', ['dashboard.hr.view', 'payroll.dashboard.view'])

    await screen.findByRole('list', { name: 'Key figures' }, FIRST_LOAD)
    await waitFor(() => {
      expect(within(tile('Headcount')).getByText('34')).toBeVisible()
    })
    // The figure shows, but without the employee list it opens nothing.
    expect(screen.queryByRole('link', { name: /^Headcount: / })).not.toBeInTheDocument()
    expect(screen.queryByText('Open positions')).not.toBeInTheDocument()
    expect(screen.queryByText('Approvals waiting for you')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Quick actions' })).not.toBeInTheDocument()
    // Only the module cards the user may read: Payroll, nothing else.
    expect(screen.getByRole('region', { name: 'Payroll' })).toBeVisible()
    for (const name of ['Recruitment', 'Leaves', 'Benefits', 'Separation', 'Warning policies']) {
      expect(screen.queryByRole('region', { name })).not.toBeInTheDocument()
    }
  })

  it('offers only the quick actions the user may take', async () => {
    renderAs('/', ['dashboard.hr.view', 'requests.leave.create', 'recruitment.openings.create'])

    const actions = await screen.findByRole('navigation', { name: 'Quick actions' }, FIRST_LOAD)
    expect(within(actions).getByRole('link', { name: 'Apply leave' })).toHaveAttribute(
      'href',
      '/leaves/my-leaves',
    )
    expect(within(actions).getByRole('link', { name: 'New job opening' })).toHaveAttribute(
      'href',
      '/recruitment/openings?dialog=create',
    )
    expect(within(actions).queryByRole('link', { name: 'Add employee' })).not.toBeInTheDocument()
    expect(within(actions).queryByRole('link', { name: 'Run payroll' })).not.toBeInTheDocument()
  })

  it('shows the employee their own day, with no company figures', async () => {
    // Every employee may open their own time sheet.
    renderAs('/', ['dashboard.employee.view', 'attendance.time_sheet.view'])

    expect(await screen.findByRole('list', { name: 'My key figures' }, FIRST_LOAD)).toBeVisible()
    expect(screen.getByText('My day')).toBeVisible()
    const mine = leaveRequestRows().filter((row) => row.employeeId === DEMO_USER.employeeId)
    const pending = mine.filter((row) => row.status === 'pending').length
    await waitFor(() => {
      expect(
        within(tile('Pending leave requests', 'My key figures')).getByText(String(pending)),
      ).toBeVisible()
    })
    const applications = screen.getByRole('list', { name: 'My leave applications' })
    expect(within(applications).getAllByRole('listitem')).toHaveLength(mine.length)
    expect(screen.getByRole('region', { name: 'My attendance today' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Notice board' })).toBeVisible()
    // The month tiles open the month's time sheet; Days absent only the absent days.
    const absent = screen.getByRole('link', { name: /^Days absent: / })
    expect(absent.getAttribute('href')).toContain(`from=${format(new Date(), 'yyyy-MM')}-01`)
    expect(absent.getAttribute('href')).toContain('dayStatus=absent')

    expect(screen.queryByText('Headcount')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Workforce' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Who’s in today' })).not.toBeInTheDocument()
  })

  it('gives the CEO the company figures without personal items', async () => {
    renderAs('/', ['dashboard.ceo.view', 'requests.approvals.view'])

    expect(await screen.findByText('Company overview', {}, FIRST_LOAD)).toBeVisible()
    await waitFor(() => {
      expect(within(tile('Headcount')).getByText('34')).toBeVisible()
    })
    expect(screen.getByRole('region', { name: 'Workforce' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Leave applications' })).toBeVisible()
    // Approvals waiting for the caller, notices and events are personal: not here.
    expect(screen.queryByText('Approvals waiting for you')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Waiting for your decision' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Notice board' })).not.toBeInTheDocument()
  })

  it('moves the figures with From and To', async () => {
    const then = subMonths(new Date(), 2)
    const earlier = format(then, 'yyyy-MM')
    const lastDay = format(endOfMonth(then), 'yyyy-MM-dd')
    const { user, router } = renderApp(`/?from=${earlier}-01&to=${lastDay}`)

    await screen.findByRole('link', { name: /^Headcount: / }, FIRST_LOAD)
    const dates = screen.getByRole('group', { name: 'Dates the figures cover' })
    expect(
      within(dates).getByRole('button', {
        name: `From: ${format(startOfMonth(then), 'd MMMM yyyy')}`,
      }),
    ).toBeVisible()
    expect(
      within(dates).getByRole('button', { name: `To: ${format(endOfMonth(then), 'd MMMM yyyy')}` }),
    ).toBeVisible()

    // The figures the API gives per month: the month of To (a whole month needs no note).
    const hires = hiresIn(earlier)
    expect(hires).toBeGreaterThan(0)
    await waitFor(() => {
      expect(screen.getByRole('link', { name: `New hires: ${String(hires)}` })).toBeVisible()
    })
    expect(within(tile('New hires')).getByText(format(then, 'MMMM yyyy'))).toBeVisible()
    expect(screen.queryByText(/are given per month/)).not.toBeInTheDocument()

    // The attendance tiles: the time sheet's totals for the dates, opening the same dates.
    const counts = attendanceBetween(`${earlier}-01`, lastDay)
    const present = await screen.findByRole('link', {
      name: `Present: ${counts.present.toLocaleString('en-US')}`,
    })
    expect(present.getAttribute('href')).toContain(`from=${earlier}-01`)
    expect(present.getAttribute('href')).toContain(`to=${lastDay}`)
    const leave = screen.getByRole('link', { name: /^On leave: / })
    expect(leave.getAttribute('href')).toContain('dayStatus=leave')
    expect(leave.getAttribute('href')).toContain(`to=${lastDay}`)
    expect(screen.getByRole('link', { name: /^Absenteeism: / }).getAttribute('href')).toContain(
      'dayStatus=absent',
    )
    // Who's in shows To; the Leaves card the dates.
    expect(
      screen.getByRole('region', {
        name: `Who was in on ${format(endOfMonth(then), 'd MMM yyyy')}`,
      }),
    ).toBeVisible()
    expect(
      within(screen.getByRole('region', { name: 'Leaves' })).getByText(
        `${format(startOfMonth(then), 'd MMM')} – ${format(endOfMonth(then), 'd MMM yyyy')}`,
      ),
    ).toBeVisible()

    // Picking To = the 15th: the URL keeps both dates and a note names the monthly figures' month.
    await user.click(within(dates).getByRole('button', { name: /^To: / }))
    await user.click(
      await screen.findByRole('button', {
        name: new RegExp(format(setDate(then, 15), 'MMMM do, yyyy')),
      }),
    )
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ from: `${earlier}-01`, to: `${earlier}-15` })
    })
    expect(
      screen.getByText(new RegExp(`they show ${format(then, 'MMMM yyyy')}, the month of To`)),
    ).toBeVisible()
  })

  it('opens an older month link as that whole month', async () => {
    const then = subMonths(new Date(), 1)
    const lastDay = format(endOfMonth(then), 'yyyy-MM-dd')
    renderApp(`/?month=${format(then, 'yyyy-MM')}`)

    const present = await screen.findByRole('link', { name: /^Present: / }, FIRST_LOAD)
    expect(present.getAttribute('href')).toContain(`from=${format(then, 'yyyy-MM')}-01`)
    expect(present.getAttribute('href')).toContain(`to=${lastDay}`)
  })

  it('works at phone width', async () => {
    setViewportWidth(375)
    renderApp('/')

    expect(await screen.findByRole('list', { name: 'Key figures' }, FIRST_LOAD)).toBeVisible()
    const whosIn = await screen.findByRole('region', { name: 'Who’s in today' })
    // The table becomes a list of cards, so nothing scrolls sideways.
    expect(await within(whosIn).findByRole('list', { name: 'Who’s in today' })).toBeVisible()
    expect(within(whosIn).queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Dates the figures cover' })).toBeVisible()
  })
})
