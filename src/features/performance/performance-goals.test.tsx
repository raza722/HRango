import { configure, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, differenceInCalendarMonths, format } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@/mocks/node'
import { goals } from '@/mocks/performance/db'
import { apiPath } from '@/mocks/utils'
import { renderApp, setViewportWidth } from '@/test/test-utils'

configure({ asyncUtilTimeout: 4000 })

const YEAR = new Date().getFullYear()

/** Opens a date field's calendar and picks the day, moving months if needed. */
async function pickDate(user: UserEvent, scope: HTMLElement, label: string, date: Date) {
  await user.click(within(scope).getByRole('button', { name: label }))
  const months = differenceInCalendarMonths(date, new Date())
  for (let step = 0; step < Math.abs(months); step += 1) {
    await user.click(
      screen.getByRole('button', { name: months > 0 ? /next month/i : /previous month/i }),
    )
  }
  await user.click(screen.getByRole('button', { name: new RegExp(format(date, 'MMMM do, yyyy')) }))
}

/** Opens a search select by its label and picks an option. */
async function choose(user: UserEvent, scope: HTMLElement, label: string, option: RegExp) {
  await user.click(within(scope).getByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

const tile = (label: string) => {
  const tiles = screen.getByRole('list', { name: 'Goals in numbers' })
  return within(tiles).getByText(label).closest('li')
}

describe('Performance → Overview and Goals', { timeout: 60_000 }, () => {
  it('shows the overview: goal tiles, the current appraisal and the charts with table views', async () => {
    const { user, router } = renderApp('/performance')

    expect(
      await screen.findByRole('heading', { name: 'Performance Overview' }, { timeout: 15_000 }),
    ).toBeVisible()
    expect(router.state.location.pathname).toBe('/performance/overview')
    await waitFor(() => {
      expect(tile('Total Goals')).toHaveTextContent('Total Goals8')
    })
    expect(tile('Open Goals')).toHaveTextContent('Open Goals4')
    expect(tile('Completed')).toHaveTextContent('Completed3')
    expect(tile('Overdue')).toHaveTextContent('Overdue1')
    expect(
      screen.getByRole('progressbar', { name: 'Weighted progress of the goals' }),
    ).toBeVisible()

    // The running cycle, with Shelley's self review waiting.
    const current = screen.getByRole('region', { name: 'Current Appraisal' })
    expect(within(current).getByText(`Annual Review ${String(YEAR)}`)).toBeVisible()
    const steps = within(current).getByRole('list', { name: 'Appraisal stages' })
    expect(within(steps).getByRole('listitem', { current: 'step' })).toHaveTextContent(
      'Self ReviewCurrent',
    )
    expect(within(current).getByRole('link', { name: 'Write your self review' })).toBeVisible()

    // Goals by status: a chart, and the same numbers as a table.
    const byStatus = screen.getByRole('region', { name: 'Goals by Status' })
    expect(within(byStatus).getByRole('img', { name: /In Progress 3/ })).toBeVisible()
    await user.click(
      within(byStatus).getByRole('button', { name: 'Show Goals by status as a table' }),
    )
    const statusTable = within(byStatus).getByRole('table', { name: 'Goals by status' })
    expect(within(statusTable).getByRole('row', { name: 'Completed 3' })).toBeVisible()

    // Last year's final rating: 40% goals (5.0) + 60% manager (4.4) = 4.64.
    const ratings = screen.getByRole('region', { name: 'Ratings by Cycle' })
    await user.click(
      within(ratings).getByRole('button', { name: 'Show Final rating by cycle as a table' }),
    )
    expect(
      within(within(ratings).getByRole('table')).getByRole('row', {
        name: `Annual Review ${String(YEAR - 1)} 4.64`,
      }),
    ).toBeVisible()
    expect(within(ratings).getByText(/4\.64 · Exceeds Expectations · Increment/)).toBeVisible()

    // Upcoming goals: the overdue one first, with its bar and number.
    const upcoming = screen.getByRole('list', { name: 'Upcoming goals' })
    const first = within(upcoming).getAllByRole('listitem')[0]
    expect(first).toHaveTextContent('Deliver 24 training hours per employee')
    expect(first).toHaveTextContent('Overdue')
    expect(first).toHaveTextContent('42%')
  })

  it('lists My goals, then Team goals with a status filter, keeping both in the URL', async () => {
    const { user, router } = renderApp('/performance/goals')

    const table = await screen.findByRole('table', { name: 'My Goals' }, { timeout: 15_000 })
    expect(await within(table).findByText('Cut time to hire to 30 days')).toBeVisible()
    for (const header of ['Goal', 'Review Cycle', 'Due Date', 'Weight', 'Progress', 'Status']) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeVisible()
    }
    expect(screen.getByText('Showing 1–8 of 8')).toBeVisible()
    const overdue = within(table).getByText('Deliver 24 training hours per employee').closest('tr')
    expect(overdue).toHaveTextContent('Overdue')
    expect(
      within(overdue!).getByRole('progressbar', {
        name: 'Progress of Deliver 24 training hours per employee',
      }),
    ).toHaveAttribute('aria-valuenow', '42')
    const locked = within(table).getByText('Digitise the employee files').closest('tr')
    expect(locked).toHaveTextContent('Locked')

    await user.click(screen.getByRole('tab', { name: 'Team' }))
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ tab: 'team' })
    })
    const team = await screen.findByRole('table', { name: 'Team Goals' })
    expect(await within(team).findByText('Close HR tickets within 3 days')).toBeVisible()
    expect(within(team).getByRole('columnheader', { name: 'Employee' })).toBeVisible()
    expect(screen.getByText('Showing 1–10 of 11')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const filters = await screen.findByRole('dialog', { name: 'Filters' })
    await choose(user, filters, 'Status', /^Completed$/)
    await user.click(within(filters).getByRole('button', { name: 'Apply' }))
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ tab: 'team', status: 'completed' })
    })
    expect(await screen.findByText('Showing 1–2 of 2')).toBeVisible()
    expect(within(team).getByText('Cut branch operating costs by 5%')).toBeVisible()
    expect(screen.getByRole('button', { name: /^Filter\s*1\s*in use$/ })).toBeVisible()

    // Search narrows further.
    await user.type(screen.getByRole('textbox', { name: 'Search goals' }), 'HRMS')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText('Showing 1–1 of 1')).toBeVisible()
    expect(router.state.location.search).toEqual({ tab: 'team', status: 'completed', q: 'HRMS' })
  })

  it('adds a goal (with its checks), then checks in on it', async () => {
    const { user } = renderApp('/performance/goals')
    await screen.findByRole('table', { name: 'My Goals' }, { timeout: 15_000 })
    await user.click(await screen.findByRole('button', { name: '+ Add Goal' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add Goal' })

    await user.clear(within(dialog).getByRole('textbox', { name: /^Weight/ }))
    await user.type(within(dialog).getByRole('textbox', { name: /^Weight/ }), '150')
    await user.click(within(dialog).getByRole('button', { name: 'Add Goal' }))
    expect(await within(dialog).findByText('Enter the title')).toBeVisible()
    expect(within(dialog).getByText('Choose the due date')).toBeVisible()
    expect(within(dialog).getByText("The weight can't be above 100")).toBeVisible()

    await user.type(
      within(dialog).getByRole('textbox', { name: /^Title/ }),
      'Launch the mentoring programme',
    )
    await user.clear(within(dialog).getByRole('textbox', { name: /^Weight/ }))
    await user.type(within(dialog).getByRole('textbox', { name: /^Weight/ }), '20')
    await choose(user, dialog, 'Review Cycle', new RegExp(`Annual Review ${String(YEAR)}$`))
    await pickDate(user, dialog, 'Due Date', addDays(new Date(), 20))
    await user.click(within(dialog).getByRole('button', { name: 'Add Goal' }))

    expect(await screen.findByText('Goal added')).toBeVisible()
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Add Goal' })).not.toBeInTheDocument()
    })
    const saved = goals.all().find((goal) => goal.title === 'Launch the mentoring programme')
    expect(saved).toMatchObject({
      employeeId: 'em_shelley',
      appraisalCycleId: 'pc_current',
      weight: 20,
      progress: 0,
      status: 'not_started',
    })
    const table = screen.getByRole('table', { name: 'My Goals' })
    expect(await within(table).findByText('Launch the mentoring programme')).toBeVisible()

    // Check In: the progress is checked, then saved with a note.
    await user.click(
      screen.getByRole('button', { name: 'Actions for Launch the mentoring programme' }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Check In' }))
    const checkIn = await screen.findByRole('dialog', { name: 'Check In' })
    const progress = within(checkIn).getByRole('textbox', { name: /^Progress/ })
    await user.clear(progress)
    await user.type(progress, '150')
    await user.click(within(checkIn).getByRole('button', { name: 'Check In' }))
    expect(await within(checkIn).findByText("The progress can't be above 100")).toBeVisible()
    await user.clear(progress)
    await user.type(progress, '40')
    await user.type(within(checkIn).getByRole('textbox', { name: 'Comments' }), 'Mentors matched')
    await user.click(within(checkIn).getByRole('button', { name: 'Check In' }))
    expect(
      await screen.findByText('Checked in: Launch the mentoring programme is at 40%'),
    ).toBeVisible()
    expect(goals.all().find((goal) => goal.id === saved?.id)).toMatchObject({
      progress: 40,
      status: 'in_progress',
    })
    await waitFor(() => {
      expect(
        within(table).getByRole('progressbar', {
          name: 'Progress of Launch the mentoring programme',
        }),
      ).toHaveAttribute('aria-valuenow', '40')
    })

    // The detail shows the check-in history.
    await user.click(within(table).getByRole('button', { name: 'Launch the mentoring programme' }))
    const detail = await screen.findByRole('dialog', { name: 'Launch the mentoring programme' })
    const history = await within(detail).findByRole('list', { name: 'Check-in history' })
    expect(within(history).getByText('Mentors matched')).toBeVisible()
    expect(within(history).getByText(/Shelley Kannes/)).toBeVisible()
  })

  it('shows a load error with Try again', async () => {
    server.use(
      http.get(
        apiPath('/performance/goals'),
        () => HttpResponse.json({ message: 'Goals are unavailable.' }, { status: 500 }),
        { once: true },
      ),
    )
    const { user } = renderApp('/performance/goals')

    expect(
      await screen.findByText('Goals are unavailable.', undefined, { timeout: 15_000 }),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    const table = await screen.findByRole('table', { name: 'My Goals' })
    expect(await within(table).findByText('Cut time to hire to 30 days')).toBeVisible()
  })

  it('stacks the goals as cards at phone width', async () => {
    setViewportWidth(375)
    renderApp('/performance/goals')

    const list = await screen.findByRole('list', { name: 'My Goals' }, { timeout: 15_000 })
    expect(screen.queryByRole('table', { name: 'My Goals' })).not.toBeInTheDocument()
    const card = (await within(list).findByText('Cut time to hire to 30 days')).closest('li')
    expect(card).toHaveTextContent('Due Date')
    expect(card).toHaveTextContent('70%')
    expect(screen.getByRole('button', { name: '+ Add Goal' })).toBeVisible()
  })
})
