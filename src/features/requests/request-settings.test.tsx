import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, differenceInCalendarMonths, format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { buildFlow, planFlow } from '@/mocks/requests/flow'
import { delegatorsOf } from '@/mocks/requests/people'
import { requestAuthorities, restrictionFor } from '@/mocks/requests/settings-db'
import { renderApp } from '@/test/test-utils'

async function choose(user: UserEvent, label: string | RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  // The search list (the node editor's own drop-downs have options of the same names).
  const list = await screen.findByRole('listbox')
  await user.click(await within(list).findByRole('option', { name: option }))
}

const iso = (date: Date) => format(date, 'yyyy-MM-dd')

describe('Request Restriction', { timeout: 60_000 }, () => {
  it('creates a restriction and deletes the ticked ones', async () => {
    const { user } = renderApp('/requests/settings')

    expect(
      await screen.findByRole('heading', { name: 'Request Restriction', level: 1 }),
    ).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'December 15, 2023' })).toBeVisible()
    expect(screen.getAllByRole('cell', { name: 'Top Edge Technologies' })[0]).toBeVisible()
    // The sub menu and the sidebar's Requests tree both link to it.
    expect(screen.getAllByRole('link', { name: 'Request Restriction' })[0]).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Request Restriction Create' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose the start date')).toBeVisible()
    expect(within(dialog).getByText('Choose the request type')).toBeVisible()

    // The start must be in the future: today cannot be picked (the API refuses it too).
    // The calendar opens on tomorrow, the first day it offers.
    const tomorrow = addDays(new Date(), 1)
    await user.click(within(dialog).getByRole('button', { name: /^Start Date/ }))
    if (tomorrow.getDate() > 1) {
      expect(
        screen.getByRole('button', { name: new RegExp(format(new Date(), 'MMMM do, yyyy')) }),
      ).toBeDisabled()
    }
    const day = addDays(new Date(), 7)
    const months = differenceInCalendarMonths(day, tomorrow)
    for (let step = 0; step < months; step += 1) {
      await user.click(screen.getByRole('button', { name: /next month/i }))
    }
    await user.click(screen.getByRole('button', { name: new RegExp(format(day, 'MMMM do, yyyy')) }))
    // The end cannot be before the start (its calendar opens on the start's month).
    await user.click(within(dialog).getByRole('button', { name: /^End Date/ }))
    if (day.getDate() > 1) {
      expect(
        screen.getByRole('button', {
          name: new RegExp(format(addDays(day, -1), 'MMMM do, yyyy')),
        }),
      ).toBeDisabled()
    }
    await user.click(screen.getByRole('button', { name: new RegExp(format(day, 'MMMM do, yyyy')) }))
    await choose(user, /^Request Types/, 'Punch Request')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Request restriction created')).toBeInTheDocument()
    expect(restrictionFor('punch', iso(day))).toMatch(/^Punch requests are closed from /)
    expect(await screen.findAllByRole('cell', { name: format(day, 'MMMM d, yyyy') })).toHaveLength(
      2,
    )

    // Ticking rows brings up the red Delete; each is deleted with its row version.
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Select all restrictions on this page' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const confirm = await screen.findByRole('alertdialog')
    expect(
      within(confirm).getByText('Are you sure you want to delete the 3 ticked restrictions?'),
    ).toBeVisible()
    await user.click(within(confirm).getByRole('button', { name: 'Yes' }))
    expect(await screen.findByText('3 restrictions deleted')).toBeInTheDocument()
    expect(await screen.findByText('No Record Found')).toBeVisible()
    expect(restrictionFor('punch', iso(day))).toBeNull()
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
})

describe('Delegation', () => {
  it('disables, re-activates in bulk and creates delegations', async () => {
    const { user } = renderApp('/requests/settings/delegation')

    expect(await screen.findByRole('heading', { name: 'Delegations', level: 1 })).toBeVisible()
    expect(delegatorsOf('em_shelley', 'punch')).toEqual(['em_bilal'])

    await user.click(
      await screen.findByRole('button', { name: "Actions for Bilal Ahmed's Punch delegation" }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Disable' }))
    await user.click(await screen.findByRole('button', { name: 'Yes' }))
    expect(await screen.findByText('1 delegation made inactive')).toBeInTheDocument()
    // Bilal's punch approvals are no longer passed on; his shift approvals still are.
    expect(delegatorsOf('em_shelley', 'punch')).toEqual([])
    expect(delegatorsOf('em_shelley', 'shift_swap')).toEqual(['em_bilal'])

    // Ticking rows swaps Create / Filters for the bulk Active / Inactive; only the
    // in-active ones change.
    await user.click(screen.getByRole('checkbox', { name: 'Select all delegations on this page' }))
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Active' }))
    await user.click(await screen.findByRole('button', { name: 'Yes' }))
    expect(await screen.findByText('1 delegation made active')).toBeInTheDocument()
    expect(delegatorsOf('em_shelley', 'punch')).toEqual(['em_bilal'])

    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Request Delegations Create' })
    await choose(user, /^Delegator/, /^Bilal Ahmed/)
    await choose(user, /^Types/, 'Punch Request')
    // Nobody delegates to themselves: the delegator is not offered as delegatee.
    await user.click(within(dialog).getByRole('combobox', { name: /^Delegatee/ }))
    const omar = await within(await screen.findByRole('listbox')).findByRole('option', {
      name: /^Omar Siddiqui/,
    })
    expect(screen.queryByRole('option', { name: /^Bilal Ahmed/ })).not.toBeInTheDocument()
    await user.click(omar)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(
      await within(dialog).findByText(
        'This person already has an active delegation for this request type.',
      ),
    ).toBeVisible()

    await choose(user, /^Types/, 'Expense Request')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Delegation created')).toBeInTheDocument()
    expect(delegatorsOf('em_omar', 'expense')).toEqual(['em_bilal'])
  })
})

describe('Request Flows', () => {
  it('refuses a looping flow and saves a new version with an on-looker', async () => {
    const { user } = renderApp('/requests/settings/flows')

    expect(await screen.findByRole('heading', { name: 'Request Flows', level: 1 })).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'Final Authority' })).toBeVisible()

    await user.click(
      await screen.findByRole('button', { name: 'Actions for General Flow (Company)' }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog', { name: 'Request Flow Edit' })
    const nextOfTwo = await within(dialog).findByRole('spinbutton', { name: 'Next, row 2' })
    await user.type(nextOfTwo, '1')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(
      await within(dialog).findByText('The flow goes round in a loop through row 1.'),
    ).toBeVisible()

    await user.clear(nextOfTwo)
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

  it('adds a flow for one employee', async () => {
    const { user } = renderApp('/requests/settings/flows')

    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Request Flow Create' })
    await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Haroon punch')
    await choose(user, /^Applies To/, 'Employee')
    await choose(user, /^Employee\s*\*?$/, /^Haroon Jalani/)
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Node, row 1' }), ['HOD'])
    await user.click(within(dialog).getByRole('button', { name: 'Add Node' }))
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Node, row 2' }), [
      'Final Authority',
    ])
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Request flow saved')).toBeInTheDocument()
    expect(await screen.findByRole('cell', { name: 'Employee: Haroon Jalani' })).toBeVisible()
    expect(
      buildFlow('em_haroon', 'punch').map((step) => [step.authority, step.approverId]),
    ).toEqual([
      ['HOD', 'em_bilal'],
      ['HR Manager', 'em_shelley'],
    ])
    // Everyone else keeps the company's flow.
    expect(buildFlow('em_omar', 'punch').map((step) => step.authority)).toEqual([
      'Line Manager',
      'HR Manager',
    ])
  })

  it('keeps who holds each authority', async () => {
    const { user } = renderApp('/requests/settings/flows?tab=authorities')

    expect(await screen.findByRole('heading', { name: 'Authorities', level: 1 })).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'Finance Manager' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Authority Create' })
    await choose(user, /^Authority/, 'Finance Manager')
    await choose(user, /^Employee/, /^Bilal Ahmed/)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText(/Someone already holds this authority/)).toBeVisible()

    await choose(user, /^Authority/, 'Team Lead')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Authority created')).toBeInTheDocument()
    expect(requestAuthorities.all().some((row) => row.authority === 'team_lead')).toBe(true)

    await user.click(
      await screen.findByRole('button', { name: 'Actions for Finance Manager held by Hina Raza' }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await user.click(await screen.findByRole('button', { name: 'Yes' }))
    expect(await screen.findByText('Authority deleted')).toBeInTheDocument()
    expect(requestAuthorities.all().some((row) => row.authority === 'finance_manager')).toBe(false)
  })
})
