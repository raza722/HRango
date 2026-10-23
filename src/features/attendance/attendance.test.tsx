import { screen, waitFor, within } from '@testing-library/react'
import { format, isWeekend, subDays } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { holidays } from '@/mocks/attendance/settings-db'
import { seedRestDayBatches } from '@/mocks/scheduling/seed'
import { renderApp } from '@/test/test-utils'

import { formatSheetDate } from './utils/local-time'

/** A seeded holiday, or a rest day the seed gives someone, on this date. */
function isDayOff(day: Date): boolean {
  const date = format(day, 'yyyy-MM-dd')
  return (
    holidays.all().some((holiday) => holiday.startDate <= date && date <= holiday.endDate) ||
    seedRestDayBatches().some((batch) => batch.dates.includes(date))
  )
}

/**
 * The n-th Monday–Friday before today, as the seed picks its sample days.
 * `avoidDaysOff` steps back past holidays and rest days, for tests that need a working day.
 */
function recentWorkday(n: number, avoidDaysOff = false): string {
  let day = new Date()
  let left = n
  while (left > 0) {
    day = subDays(day, 1)
    if (!isWeekend(day)) left -= 1
  }
  while (avoidDaysOff && (isDayOff(day) || isWeekend(day))) {
    day = subDays(day, 1)
  }
  return format(day, 'yyyy-MM-dd')
}

describe('Attendance Overview', () => {
  it('shows the legend, the monthly grid and a day when clicked', async () => {
    const { user } = renderApp('/attendance')

    expect(
      await screen.findByRole('heading', { name: 'Attendance Overview', level: 1 }),
    ).toBeVisible()
    const legend = screen.getByRole('list', { name: /^Legend/ })
    expect(within(legend).getAllByRole('button')).toHaveLength(21)
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('rowheader', { name: 'Shelley Kannes' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Attendance Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    const weekend = within(legend).getByRole('button', { name: 'Weekend' })
    await user.click(weekend)
    expect(weekend).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Highlighting Weekend days/)).toBeVisible()

    const [firstDay] = screen.getAllByRole('button', { name: /^Shelley Kannes, \d+ \w+: / })
    if (!firstDay) throw new Error('No day cells for Shelley Kannes')
    await user.click(firstDay)
    const dialog = await screen.findByRole('dialog', { name: /^Time sheet of Shelley Kannes/ })
    expect(await within(dialog).findByText('Employee Code:')).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'History' })).toBeVisible()
  })

  it('lists only the signed-in person’s reports on Subordinates', async () => {
    const { user, router } = renderApp('/attendance/overview')

    await screen.findByRole('rowheader', { name: 'Shelley Kannes' })
    await user.click(screen.getByRole('tab', { name: 'Subordinates' }))
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ scope: 'subordinates' })
    })
    expect(await screen.findByRole('rowheader', { name: 'Kaleem Murtaza' })).toBeVisible()
    expect(screen.queryByRole('rowheader', { name: 'Shelley Kannes' })).not.toBeInTheDocument()
  })
})

describe('Time Sheet', () => {
  it('shows my days with the month tiles and View only, and clocks in', async () => {
    const { user } = renderApp('/attendance/time-sheet')

    expect(
      await screen.findByRole('heading', { name: 'My Time Sheet', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Days Overview This Month/ })).toBeVisible()
    await screen.findAllByRole('button', { name: /^View, / })
    expect(screen.queryByRole('button', { name: /^Edit, / })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clock In' }))
    expect(await screen.findByText(/^Clocked in at /)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Clock Out' })).toBeVisible()
  })

  it('opens the History of a day HR changed', async () => {
    const date = recentWorkday(2)
    const { user } = renderApp(`/attendance/time-sheet?from=${date}&to=${date}`)

    const row = await screen.findByRole('rowheader', { name: new RegExp(formatSheetDate(date)) })
    expect(within(row).getByText('Manually updated')).toBeVisible()
    await user.click(screen.getByRole('button', { name: `View, ${formatSheetDate(date)}` }))
    const view = await screen.findByRole('dialog', { name: /^Time sheet of Shelley Kannes/ })
    expect(await within(view).findByText(/the guard log/)).toBeVisible()

    await user.click(within(view).getByRole('button', { name: 'History' }))
    const history = await screen.findByRole('dialog', { name: 'History' })
    expect(await within(history).findByText('Updated Check In Time')).toBeVisible()
    expect(within(history).getByText('Laiba Shah')).toBeVisible()
  })

  it('marks a day absent from Edit, then records the absence as leave', async () => {
    const date = recentWorkday(5, true)
    const label = formatSheetDate(date)
    const { user } = renderApp(
      `/attendance/time-sheet?scope=all&employeeId=em_omar&from=${date}&to=${date}`,
    )

    await user.click(await screen.findByRole('button', { name: `Edit, ${label}` }))
    const edit = await screen.findByRole('dialog', {
      name: /^Edit the time sheet of Omar Siddiqui/,
    })
    await user.click(await within(edit).findByRole('checkbox', { name: 'Mark Absent' }))
    expect(within(edit).getByText(/An absent day has no check in/)).toBeVisible()
    await user.click(within(edit).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Time sheet updated')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    await user.click(await screen.findByRole('button', { name: `Absent, ${label}` }))
    const absent = await screen.findByRole('dialog', { name: `Absent, ${label}` })
    await user.click(within(absent).getByRole('button', { name: 'Save' }))
    expect(await within(absent).findByText('Give a reason')).toBeVisible()
    await user.type(
      within(absent).getByRole('textbox', { name: /Reason/ }),
      'Approved casual leave',
    )
    await user.click(within(absent).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Absence updated')).toBeInTheDocument()
    const row = await screen.findByRole('row', { name: new RegExp(label) })
    expect(await within(row).findByText('Leave')).toBeVisible()
  })

  it('posts a comment from Time Sheet Edit', async () => {
    const date = recentWorkday(4, true)
    const label = formatSheetDate(date)
    const { user } = renderApp(
      `/attendance/time-sheet?scope=all&employeeId=em_bilal&from=${date}&to=${date}`,
    )

    await user.click(await screen.findByRole('button', { name: `Edit, ${label}` }))
    const edit = await screen.findByRole('dialog', { name: /^Edit the time sheet of Bilal Ahmed/ })
    await user.click(await within(edit).findByRole('button', { name: /Comments Details/ }))
    await user.click(within(edit).getByRole('button', { name: 'Comment' }))
    expect(await within(edit).findByText('Type a comment first')).toBeVisible()
    await user.type(
      within(edit).getByRole('textbox', { name: 'New comment' }),
      'Checked with the team lead',
    )
    await user.click(within(edit).getByRole('button', { name: 'Comment' }))
    expect(await within(edit).findByText('Checked with the team lead')).toBeVisible()
    expect(within(edit).getByText(/Shelley Kannes - Id-001/)).toBeVisible()
  })
})
