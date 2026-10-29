import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, differenceInCalendarMonths, format, nextMonday } from 'date-fns'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@/mocks/node'
import { standardRequests } from '@/mocks/requests/standard'
import { scheduleEntries } from '@/mocks/scheduling/handlers'
import { apiPath } from '@/mocks/utils'
import { renderApp } from '@/test/test-utils'

/** Opens a date field's calendar (on `opensOn`'s month) and picks the day. */
async function pickDate(user: UserEvent, label: RegExp, date: Date, opensOn = new Date()) {
  await user.click(screen.getByRole('button', { name: label }))
  const months = differenceInCalendarMonths(date, opensOn)
  for (let step = 0; step < Math.abs(months); step += 1) {
    await user.click(
      screen.getByRole('button', { name: months > 0 ? /next month/i : /previous month/i }),
    )
  }
  await user.click(screen.getByRole('button', { name: new RegExp(format(date, 'MMMM do, yyyy')) }))
}

async function openAction(user: UserEvent, code: string, action: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${code}` }))
  await user.click(await screen.findByRole('menuitem', { name: action }))
}

const confirmYes = async (user: UserEvent) => {
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
  )
}

const entryOf = (employeeId: string, date: string) =>
  scheduleEntries.all().find((entry) => entry.employeeId === employeeId && entry.date === date)

describe('Work From Home (the shared standard request pages, on /requests/work-from-home)', () => {
  // Long: two date picks, the strip and a save; the default 15 s is tight on a busy machine.
  it('lists the requests with "Completed", and saves the shifts ticked in the week strip', async () => {
    const { user } = renderApp('/requests/work-from-home')

    expect(await screen.findByRole('heading', { name: 'WFH Requests' })).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'WFH-0007' })).toBeVisible()
    expect(screen.getByRole('button', { name: /^Completed \(1\)/ })).toBeVisible()
    expect(screen.queryByRole('cell', { name: 'WFH-0001' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'WFH Request Create' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose the start date')).toBeVisible()
    expect(within(dialog).getByText('Give the reason')).toBeVisible()
    await user.type(within(dialog).getByRole('textbox', { name: /^Reason/ }), 'Office repairs.')

    // A Monday to Friday two weeks ahead, clear of the seeded requests.
    const start = nextMonday(addDays(new Date(), 13))
    await pickDate(user, /^Start Date/, start)
    await pickDate(user, /^End Date/, addDays(start, 4), start)
    const strip = await within(dialog).findByRole('region', { name: 'Shifts to work from home' })
    const shifts = await within(strip).findAllByRole('button', { name: /AM - / })
    expect(shifts).toHaveLength(5)

    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Please select at least one shift.')).toBeVisible()

    const [monday, , wednesday] = shifts
    if (!monday || !wednesday) throw new Error('No shifts drawn')
    await user.click(monday)
    await user.click(wednesday)
    expect(monday).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByText('Selected Days').nextElementSibling).toHaveTextContent('2')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect((await screen.findAllByText('Request submitted')).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(
        standardRequests
          .all()
          .filter(
            (record) => record.kind === 'work-from-home' && record.employeeId === 'em_shelley',
          ),
      ).toHaveLength(3)
    })
    const saved = standardRequests
      .all()
      .find((record) => record.kind === 'work-from-home' && record.code === 'WFH-0010')
    expect(saved?.payload).toMatchObject({
      dates: [format(start, 'yyyy-MM-dd'), format(addDays(start, 2), 'yyyy-MM-dd')],
      count: 2,
    })
  }, 30_000)

  it('approving marks the shifts work from home on the schedule', async () => {
    const { user } = renderApp('/requests/work-from-home?tab=approvals')

    expect(await screen.findByRole('heading', { name: 'WFH Approvals' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'Approver' })).toBeVisible()
    const dates = (standardRequests.find('wfh_0001')?.payload.dates ?? []) as string[]
    expect(dates.length).toBeGreaterThan(0)
    for (const date of dates) expect(entryOf('em_sadia', date)?.workFromHome).toBe(false)

    await openAction(user, 'WFH-0001', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'WFH Approve/Reject' })
    expect((await within(dialog).findAllByText('Sadia Rehman')).length).toBeGreaterThan(0)
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    expect(
      await within(await screen.findByRole('alertdialog')).findByText(
        'Are you sure you want to Approve this?',
      ),
    ).toBeVisible()
    await confirmYes(user)
    expect((await screen.findAllByText('Request approved')).length).toBeGreaterThan(0)

    expect(standardRequests.find('wfh_0001')?.status).toBe('completed')
    for (const date of dates) expect(entryOf('em_sadia', date)?.workFromHome).toBe(true)
  })

  it('an approved cancellation puts the shifts back', async () => {
    const { user } = renderApp('/requests/work-from-home?tab=approvals&view=cancellations')

    const dates = (standardRequests.find('wfh_0005')?.payload.dates ?? []) as string[]
    for (const date of dates) expect(entryOf('em_laiba', date)?.workFromHome).toBe(true)

    await openAction(user, 'WFH-0005', 'Approve/Reject Cancellation')
    const dialog = await screen.findByRole('dialog', { name: 'WFH Cancellation Approve/Reject' })
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await confirmYes(user)
    await waitFor(() => {
      expect(standardRequests.find('wfh_0005')?.status).toBe('cancelled')
    })
    for (const date of dates) expect(entryOf('em_laiba', date)?.workFromHome).toBe(false)
  })

  it('lists the requests of the people who report to you under Subordinates', async () => {
    const views: (string | null)[] = []
    server.use(
      http.get(apiPath('/requests/work-from-home'), ({ request }) => {
        views.push(new URL(request.url).searchParams.get('view'))
      }),
    )
    const { user, router } = renderApp('/requests/work-from-home')
    const whose = await screen.findByRole('tablist', { name: 'Whose requests' })
    expect(
      within(whose)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['My Requests', 'All Requests', 'Subordinates'])
    expect(await screen.findByRole('cell', { name: 'WFH-0007' })).toBeVisible()

    await user.click(within(whose).getByRole('tab', { name: 'Subordinates' }))
    expect(await screen.findByRole('cell', { name: 'WFH-0001' })).toBeVisible()
    // The mock's Subordinates is everyone but you: your own WFH-0007 is not listed.
    expect(screen.queryByRole('cell', { name: 'WFH-0007' })).not.toBeInTheDocument()
    expect(within(whose).getByRole('tab', { name: 'Subordinates' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(router.state.location.search).toMatchObject({ scope: 'subordinates' })
    expect(views).toContain('subordinates')
  })

  it('keeps Subordinates to the types that draw it', async () => {
    renderApp('/requests/relaxation?scope=subordinates')
    const whose = await screen.findByRole('tablist', { name: 'Whose requests' })
    expect(within(whose).queryByRole('tab', { name: 'Subordinates' })).not.toBeInTheDocument()
    expect(within(whose).getByRole('tab', { name: 'My Requests' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
})
