import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, differenceInCalendarMonths, format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { endOfEmployments } from '@/mocks/offboarding/db'
import { standardRequests } from '@/mocks/requests/standard'
import { requestStandardCancel } from '@/mocks/requests/standard/engine'
import { renderApp } from '@/test/test-utils'

async function choose(user: UserEvent, label: RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

/** Opens a date field's calendar and picks the day; it opens on `opensOn`'s month (its earliest day). */
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

describe('Resignation (the shared standard request pages)', () => {
  it('lists my resignation and everyone’s, and submits one for an employee', async () => {
    const { user } = renderApp('/requests/resignation')

    expect(await screen.findByRole('heading', { name: 'Resignation Requests' })).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'RSG-0006' })).toBeVisible()
    expect(screen.queryByRole('cell', { name: 'RSG-0001' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'All Resignations' }))
    expect(await screen.findByRole('cell', { name: 'RSG-0001' })).toBeVisible()
    expect(screen.getByRole('list', { name: 'Requests by status' })).toBeVisible()

    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create Resignation Request' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose the type')).toBeVisible()
    expect(within(dialog).getByText('Give the reason')).toBeVisible()

    await choose(user, /^Employee/, /Hamza Sheikh/)
    await choose(user, /^Type/, 'Voluntary')
    const from = addDays(new Date(), 2)
    await pickDate(user, /^Resignation Date/, from)
    await pickDate(user, /^Last Working Date/, addDays(from, 30), from)
    expect(within(dialog).getByRole('textbox', { name: 'Notice Period' })).toHaveValue('30 days')
    await user.type(within(dialog).getByRole('textbox', { name: /^Reason/ }), 'Moving abroad.')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect((await screen.findAllByText('Request submitted')).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(
        standardRequests
          .all()
          .find((record) => record.kind === 'resignation' && record.employeeId === 'em_hamza'),
      ).toMatchObject({
        status: 'pending',
        payload: { type: 'voluntary', reason: 'Moving abroad.' },
      })
    })
  }, 30_000)

  it('refuses a second resignation while one is waiting', async () => {
    const { user } = renderApp('/requests/resignation')

    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create Resignation Request' })
    await choose(user, /^Type/, 'Retirement')
    const from = addDays(new Date(), 1)
    await pickDate(user, /^Resignation Date/, from)
    await pickDate(user, /^Last Working Date/, addDays(from, 14), from)
    await user.type(within(dialog).getByRole('textbox', { name: /^Reason/ }), 'Retiring.')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(
      await within(dialog).findByText(/already has resignation RSG-0006 waiting for approval/),
    ).toBeVisible()
  }, 30_000)

  it('approves a resignation into End of Employment, and an approved cancellation undoes it', async () => {
    const { user } = renderApp('/requests/resignation?tab=approvals')

    expect(await screen.findByRole('heading', { name: 'Resignation Approvals' })).toBeVisible()
    await openAction(user, 'RSG-0001', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'Resignation Approve/Reject' })
    expect((await within(dialog).findAllByText('Sadia Rehman')).length).toBeGreaterThan(0)
    expect(within(dialog).getByText('30 days')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await confirmYes(user)
    expect((await screen.findAllByText('Request approved')).length).toBeGreaterThan(0)

    const record = standardRequests.find('rsg_0001')
    expect(record?.status).toBe('completed')
    const opened = endOfEmployments
      .all()
      .find((item) => item.employeeId === 'em_sadia' && item.status === 'pending')
    expect(opened).toMatchObject({
      reason: 'resignation',
      noticePeriod: true,
      lastWorkingDate: record?.payload.lastWorkingDate,
    })

    // Sadia asks to cancel it; the cancellation comes to HR under Cancellations.
    if (record) {
      standardRequests.update(
        record.id,
        requestStandardCancel(
          { settingsType: 'resignation' },
          record,
          'I would like to stay.',
          new Date().toISOString(),
        ),
      )
    }
    await user.click(screen.getByRole('tab', { name: 'Cancellations' }))
    await openAction(user, 'RSG-0001', 'Approve/Reject Cancellation')
    const cancel = await screen.findByRole('dialog', {
      name: 'Resignation Cancellation Approve/Reject',
    })
    expect(await within(cancel).findByRole('heading', { name: 'Cancel Request' })).toBeVisible()
    expect(within(cancel).getAllByText('I would like to stay.').length).toBeGreaterThan(0)
    await user.click(within(cancel).getByRole('button', { name: 'Approve' }))
    await confirmYes(user)

    await waitFor(() => {
      expect(standardRequests.find('rsg_0001')?.status).toBe('cancelled')
    })
    expect(endOfEmployments.find(opened?.id ?? '')).toBeUndefined()
  }, 30_000)

  it('approves the seeded cancellation from Cancellations', async () => {
    const { user } = renderApp('/requests/resignation?tab=approvals&view=cancellations')

    await openAction(user, 'RSG-0005', 'Approve/Reject Cancellation')
    const dialog = await screen.findByRole('dialog', {
      name: 'Resignation Cancellation Approve/Reject',
    })
    expect((await within(dialog).findAllByText(/The move is off/)).length).toBeGreaterThan(0)
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await confirmYes(user)
    await waitFor(() => {
      expect(standardRequests.find('rsg_0005')?.status).toBe('cancelled')
    })
  })
})
