import { screen, waitFor, within } from '@testing-library/react'
import { format, isWeekend, subDays } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { defaultSettings, holidays, settingsStore } from '@/mocks/attendance/settings-db'
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
    expect(within(legend).getAllByRole('button')).toHaveLength(12)
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('rowheader', { name: 'Shelley Kannes' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Export' })).toBeVisible()
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
    // No picture with the punch (uploads need a browser's FormData; jsdom's does not reach MSW).
    const settings = defaultSettings()
    settingsStore.insert({
      id: 'settings',
      ...settings,
      basic: { ...settings.basic, pictureOnDashboardPunch: false },
    })
    const { user } = renderApp('/attendance/time-sheet')

    expect(
      await screen.findByRole('heading', { name: 'My Time Sheet', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Days Overview This Month/ })).toBeVisible()
    await screen.findAllByRole('button', { name: /^View, / })
    expect(screen.queryByRole('button', { name: /^Edit, / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Process' })).not.toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: 'Clock In' }))
    expect((await screen.findAllByText(/^Clocked in at /)).length).toBeGreaterThan(0)
    expect(await screen.findByRole('button', { name: 'Clock Out' })).toBeVisible()
  })

  it('shows the comments and the History of a day HR changed', async () => {
    const date = recentWorkday(2)
    const { user } = renderApp(`/attendance/time-sheet?from=${date}&to=${date}`)

    const row = await screen.findByRole('rowheader', { name: new RegExp(formatSheetDate(date)) })
    expect(within(row).getByText('Manually updated')).toBeVisible()
    await user.click(screen.getByRole('button', { name: `View, ${formatSheetDate(date)}` }))
    const view = await screen.findByRole('dialog', { name: /^Time sheet of Shelley Kannes/ })
    expect(await within(view).findByText(/the guard log/)).toBeVisible()

    await user.click(within(view).getByRole('button', { name: 'Logs' }))
    const logs = await screen.findByRole('dialog', { name: 'Attendance Log' })
    expect(within(logs).getAllByRole('row').length).toBeGreaterThan(1)
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Attendance Log' })).not.toBeInTheDocument()
    })

    await user.click(within(view).getByRole('button', { name: 'History' }))
    const history = await screen.findByRole('dialog', { name: 'History' })
    expect(await within(history).findByText('Updated Check In Time')).toBeVisible()
    expect(within(history).getByText('Laiba Shah')).toBeVisible()
  })

  it('lists everyone on All, and marks a day absent with a comment from Edit', async () => {
    const date = recentWorkday(5, true)
    const label = formatSheetDate(date)
    const { user } = renderApp(
      `/attendance/time-sheet?scope=all&employeeId=em_omar&from=${date}&to=${date}`,
    )

    expect(await screen.findByRole('columnheader', { name: 'Employee' })).toBeVisible()
    // On All the row actions name whose day it is.
    await user.click(await screen.findByRole('button', { name: `Edit, Omar Siddiqui, ${label}` }))
    const edit = await screen.findByRole('dialog', {
      name: /^Edit the time sheet of Omar Siddiqui/,
    })
    await user.click(await within(edit).findByRole('checkbox', { name: 'Mark Absent' }))
    expect(within(edit).getByText(/An absent day has no check in/)).toBeVisible()
    await user.type(
      within(edit).getByRole('textbox', { name: /Comments/ }),
      'Checked with the team lead',
    )
    await user.click(within(edit).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Time sheet updated')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    const row = await screen.findByRole('row', { name: new RegExp(label) })
    expect(await within(row).findAllByText('Absent')).not.toHaveLength(0)
    await user.click(within(row).getByRole('button', { name: `View, Omar Siddiqui, ${label}` }))
    const view = await screen.findByRole('dialog', { name: /^Time sheet of Omar Siddiqui/ })
    expect(await within(view).findByText('Checked with the team lead')).toBeVisible()
    await user.click(within(view).getByRole('button', { name: 'History' }))
    const history = await screen.findByRole('dialog', { name: 'History' })
    expect(await within(history).findByText('Update Mark')).toBeVisible()
  })

  it('processes the range on All', async () => {
    const { user } = renderApp('/attendance/time-sheet?scope=all')

    await screen.findAllByRole('button', { name: /^Edit, / })
    // Process asks first, saying what it does.
    await user.click(screen.getByRole('button', { name: 'Process' }))
    const ask = await screen.findByRole('alertdialog', { name: 'Process the time sheet?' })
    expect(
      within(ask).getByText(/works out attendance again for everyone in this view/),
    ).toBeVisible()
    expect(within(ask).getByText(/Days changed by hand keep their changes/)).toBeVisible()
    await user.click(within(ask).getByRole('button', { name: 'Process' }))
    expect(await screen.findByText(/^Processed \d+ days? for \d+ employees?$/)).toBeInTheDocument()
  })
})
