import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { differenceInCalendarMonths, format, isWeekend, subDays } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { buildFlow, evaluateCondition, planFlow } from '@/mocks/requests/flow'
import { delegatorsOf } from '@/mocks/requests/people'
import { requestRestrictions, restrictionFor } from '@/mocks/requests/settings-db'
import { renderApp } from '@/test/test-utils'

async function choose(user: UserEvent, label: string | RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

/** Opens a date field's calendar and picks the day, moving months if needed. */
async function pickDate(user: UserEvent, label: string | RegExp, date: Date) {
  await user.click(screen.getByRole('button', { name: label }))
  const months = differenceInCalendarMonths(date, new Date())
  for (let step = 0; step < Math.abs(months); step += 1) {
    await user.click(
      screen.getByRole('button', { name: months > 0 ? /next month/i : /previous month/i }),
    )
  }
  await user.click(screen.getByRole('button', { name: new RegExp(format(date, 'MMMM do, yyyy')) }))
}

/** Today or the last weekday before it (a Morning Work shift day). */
function lastWeekday(): Date {
  let day = new Date()
  while (isWeekend(day)) day = subDays(day, 1)
  return day
}

const iso = (date: Date) => format(date, 'yyyy-MM-dd')

describe('Request Restriction', () => {
  it('creates a restriction and deletes the ticked ones', async () => {
    const { user } = renderApp('/requests/settings')

    expect(
      await screen.findByRole('heading', { name: 'Request Restriction', level: 1 }),
    ).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'December 15, 2023' })).toBeVisible()
    // The sub menu and the sidebar's Requests tree both link to it.
    expect(screen.getAllByRole('link', { name: 'Request Restriction' })[0]).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Request Restriction Create' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose the start date')).toBeVisible()
    expect(within(dialog).getByText('Choose the request type')).toBeVisible()

    const day = lastWeekday()
    await pickDate(user, /^Start Date/, day)
    await pickDate(user, /^End Date/, day)
    await choose(user, /^Request Types/, 'Punch Request')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Request restriction created')).toBeInTheDocument()
    expect(restrictionFor('punch', iso(day))).toMatch(/^Punch requests are closed from /)
    expect(await screen.findAllByRole('cell', { name: format(day, 'MMMM d, yyyy') })).toHaveLength(
      2,
    )

    // Ticking rows brings up the red Delete.
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Select all restrictions on this page' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(await screen.findByRole('button', { name: 'Yes' }))
    expect(await screen.findByText('3 restrictions deleted')).toBeInTheDocument()
    expect(await screen.findByText('No Record Found')).toBeVisible()
  })

  it('shows a restriction read-only', async () => {
    const { user } = renderApp('/requests/settings/restrictions')

    await user.click(
      await screen.findByRole('button', {
        name: 'Actions for the restriction from December 15, 2023',
      }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'View' }))
    const dialog = await screen.findByRole('dialog', { name: 'Request Restriction View' })
    await waitFor(() => {
      expect(within(dialog).getByRole('combobox', { name: /^Request Types/ })).toHaveTextContent(
        'Leave Request',
      )
    })
    expect(within(dialog).getByRole('combobox', { name: /^Request Types/ })).toBeDisabled()
    expect(within(dialog).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeVisible()
  })

  it('stops a punch request on a closed date', async () => {
    const day = iso(lastWeekday())
    requestRestrictions.insert({
      id: 'rr_test',
      companyId: 'co_topedge',
      requestType: 'punch',
      startDate: day,
      endDate: day,
      description: '',
      createdAt: new Date().toISOString(),
    })
    const { user } = renderApp('/requests/punch')

    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Punch Request Create' })
    await pickDate(user, /^Date/, lastWeekday())
    await choose(user, /^Punch Type/, 'Check Out')
    fireEvent.change(within(dialog).getByLabelText(/^Punch Time/), { target: { value: '17:40' } })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    const closed = `Punch requests are closed from ${format(lastWeekday(), 'MMMM d, yyyy')}`
    expect((await screen.findAllByText(new RegExp(closed))).length).toBeGreaterThan(0)
    expect(screen.getByRole('dialog', { name: 'Punch Request Create' })).toBeVisible()
  })
})

describe('Delegation', () => {
  it('disables, re-activates in bulk and creates delegations', async () => {
    const { user } = renderApp('/requests/settings/delegation')

    expect(await screen.findByRole('heading', { name: 'Delegations', level: 1 })).toBeVisible()
    expect(delegatorsOf('em_shelley', 'punch')).toEqual(['em_bilal'])

    await user.click(
      await screen.findByRole('button', {
        name: "Actions for Bilal Ahmed's Punch Request delegation",
      }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Disable' }))
    await user.click(await screen.findByRole('button', { name: 'Yes' }))
    expect(await screen.findByText('1 delegation made in active')).toBeInTheDocument()
    // Bilal's punch approvals are no longer passed on; his shift approvals still are.
    expect(delegatorsOf('em_shelley', 'punch')).toEqual([])
    expect(delegatorsOf('em_shelley', 'shift')).toEqual(['em_bilal'])

    // Ticking rows swaps Create / Filters for the bulk Active / In Active.
    await user.click(screen.getByRole('checkbox', { name: 'Select all delegations on this page' }))
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Active' }))
    await user.click(await screen.findByRole('button', { name: 'Yes' }))
    expect(await screen.findByText('2 delegations made active')).toBeInTheDocument()
    expect(delegatorsOf('em_shelley', 'punch')).toEqual(['em_bilal'])

    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Request Delegations Create' })
    await choose(user, /^Delegator/, /^Ayesha Malik/)
    await choose(user, /^Types/, 'Leave Request')
    await choose(user, /^Delegatee/, /^Omar Siddiqui/)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(
      await within(dialog).findByText(
        'Ayesha Malik already delegates Leave Requests to Hina Raza.',
      ),
    ).toBeVisible()

    await choose(user, /^Types/, 'Expense Request')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Delegation created')).toBeInTheDocument()
    expect(delegatorsOf('em_omar', 'expense')).toEqual(['em_ayesha'])
  })
})

describe('Request Flows', () => {
  it('sets a chain of authorities for a person', async () => {
    const { user } = renderApp('/requests/settings/flows')

    expect(await screen.findByRole('heading', { name: 'Request Flows', level: 1 })).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'Final Authority' })).toBeVisible()
    const card = screen.getByRole('region', { name: 'Request Flow' })
    const save = within(card).getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()

    await user.click(within(card).getByRole('combobox', { name: 'Authority' }))
    await user.click(await screen.findByRole('option', { name: 'HOD' }))
    await user.click(screen.getByRole('option', { name: 'Final Authority' }))
    await user.keyboard('{Escape}')
    expect(within(card).getByRole('button', { name: 'Remove HOD' })).toBeVisible()

    await user.type(within(card).getByRole('searchbox', { name: 'Search employee' }), 'Haroon')
    await user.click(await within(card).findByRole('checkbox', { name: 'Select Haroon Jalani' }))
    expect(save).toBeEnabled()
    await user.click(save)
    expect(await screen.findByText('Authority set for 1 employee')).toBeInTheDocument()
    expect(await within(card).findByRole('cell', { name: 'HOD → Final Authority' })).toBeVisible()

    expect(buildFlow('em_haroon').map((step) => [step.authority, step.approverId])).toEqual([
      ['HOD', 'em_bilal'],
      ['HR Manager', 'em_shelley'],
    ])
    // Other types keep the General Flow.
    expect(buildFlow('em_haroon', 'shift').map((step) => step.authority)).toEqual([
      'Line Manager',
      'HR Manager',
    ])
  })

  it('refuses a looping flow and saves an on-looker node', async () => {
    const { user } = renderApp('/requests/settings/flows')

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog', { name: 'Request Flow Edit' })
    const nextOfTwo = within(dialog).getByRole('spinbutton', { name: 'Next, row 2' })
    await user.type(nextOfTwo, '1')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(
      await within(dialog).findByText('Row 1 leads back to itself; the flow would never end.'),
    ).toBeVisible()

    await user.clear(nextOfTwo)
    await user.type(nextOfTwo, '3')
    await user.click(within(dialog).getByRole('button', { name: 'Add Node' }))
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Node, row 3' }), [
      'Employee',
    ])
    await choose(user, 'Employee, row 3', /^Kaleem Murtaza/)
    await user.click(within(dialog).getByRole('checkbox', { name: 'On Looker, row 3' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Request flow saved')).toBeInTheDocument()
    expect(await screen.findByRole('cell', { name: 'Kaleem Murtaza' })).toBeVisible()
    const plan = planFlow('em_omar', 'punch')
    expect(plan.steps.map((step) => step.approverId)).toEqual(['em_ayesha', 'em_shelley'])
    expect(plan.lookerIds).toEqual(['em_kaleem'])
  })

  it('reads simple conditions', () => {
    expect(evaluateCondition('punchType == missing-punch', { punchType: 'check-in' })).toBe(false)
    expect(evaluateCondition('days > 3', { days: 5 })).toBe(true)
    // A fact the request does not have passes.
    expect(evaluateCondition('amount > 100', {})).toBe(true)
  })
})
