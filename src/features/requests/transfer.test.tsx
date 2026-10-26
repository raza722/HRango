import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, differenceInCalendarMonths, format } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { server } from '@/mocks/node'
import { employeeTransfers, mockDepartments, transferRequests } from '@/mocks/requests/db'
import { apiPath } from '@/mocks/utils'
import { renderApp } from '@/test/test-utils'

async function choose(user: UserEvent, label: RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

/** Opens a date field's calendar and picks the day, moving months if needed. */
async function pickDate(user: UserEvent, label: RegExp, date: Date) {
  await user.click(screen.getByRole('button', { name: label }))
  const months = differenceInCalendarMonths(date, new Date())
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

// The organisation mock does not list departments yet; the API does
// (`GET /organisation/lookups/departments`), so the test serves them.
beforeEach(() => {
  server.use(
    http.get(apiPath('/organisation/lookups/departments'), () =>
      HttpResponse.json({
        data: mockDepartments().map((item) => ({ ...item, code: null, parentId: null })),
      }),
    ),
  )
})

describe('Transfer requests', () => {
  it('checks the form, writes the application with Regenerate and submits the request', async () => {
    const { user } = renderApp('/requests/transfer')

    expect(await screen.findByRole('heading', { name: 'Transfer Request', level: 2 })).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'RQ-TRF-0003' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'All (3)' })).toBeVisible()
    // The sub menu and the sidebar's Requests tree both mark Transfer as the current page.
    expect(
      screen
        .getAllByRole('link', { name: 'Transfer' })
        .every((link) => link.getAttribute('aria-current') === 'page'),
    ).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Transfer Request Create' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose the employee')).toBeVisible()
    expect(within(dialog).getByText('Choose the branch')).toBeVisible()
    expect(within(dialog).getByText('Choose the final authority')).toBeVisible()
    expect(within(dialog).getByText('Choose the effective date')).toBeVisible()

    // Regenerate needs the move first.
    await user.click(within(dialog).getByRole('button', { name: 'Regenerate' }))
    expect(await within(dialog).findByText(/Choose the employee, location, branch/)).toBeVisible()

    await choose(user, /^Employee Name/, /^Maryam Javed/)
    await choose(user, /^Location/, 'Karachi')
    await choose(user, /^Branch/, 'Karachi Sales Office')
    await choose(user, /^Department/, 'Sales')
    await choose(user, /^Line Manager/, /^Sara Khan/)
    await choose(user, /^Final Authority/, /^Shelley Kannes/)
    const effective = addDays(new Date(), 10)
    await pickDate(user, /^Effective Date/, effective)
    await user.type(within(dialog).getByRole('textbox', { name: /Description/ }), 'Closer to home')

    await user.click(within(dialog).getByRole('button', { name: 'Regenerate' }))
    const application = within(dialog).getByRole('textbox', { name: 'Application' })
    expect(application).toHaveTextContent(
      `Subject: Transfer Request for ${format(effective, 'EEE, MMM d, yyyy')}`,
    )
    expect(application).toHaveTextContent('Dear Shelley Kannes,')
    expect(application).toHaveTextContent(
      'to the Sales department at Karachi Sales Office, Karachi',
    )
    expect(application).toHaveTextContent('Sincerely,Maryam Javed')

    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect((await screen.findAllByText('Request submitted')).length).toBeGreaterThan(0)
    expect(await screen.findByRole('cell', { name: 'RQ-TRF-0004' })).toBeVisible()
    const saved = transferRequests.all().find((record) => record.code === 'RQ-TRF-0004')
    expect(saved?.payload).toMatchObject({
      branchId: 'br_khi',
      department: 'Sales',
      lineManagerId: 'em_sara',
      effectiveDate: format(effective, 'yyyy-MM-dd'),
      description: 'Closer to home',
    })
    expect(saved?.payload.application).toContain('Dear Shelley Kannes,')
  })

  it('approves a transfer from Approvals and records the move', async () => {
    const { user } = renderApp('/requests/transfer?tab=approvals')

    expect(
      await screen.findByRole('heading', { name: 'Transfer Approvals', level: 2 }),
    ).toBeVisible()
    await openAction(user, 'RQ-TRF-0002', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'Transfer Approval Approve' })
    expect(await within(dialog).findByText('Saad Hadier')).toBeVisible()
    expect(within(dialog).getByText('Karachi Sales Office')).toBeVisible()
    expect(within(dialog).getByRole('textbox', { name: 'Application' })).toHaveTextContent(
      'Dear Shelley Kannes,',
    )

    await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
    expect(await within(dialog).findByText('Give a reason for rejecting')).toBeVisible()

    await user.type(within(dialog).getByRole('textbox', { name: 'Remarks' }), 'Approved for Q4')
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
    )

    expect((await screen.findAllByText('Request approved')).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(transferRequests.find('trq_2')?.status).toBe('completed')
    })
    expect(employeeTransfers.all().find((entry) => entry.requestId === 'trq_2')).toMatchObject({
      employeeId: 'em_saad',
      to: { branchId: 'br_khi', department: 'Sales' },
    })
  })

  it('lists Bilal Ahmed’s requests under Delegates and approves the ticked ones', async () => {
    const { user } = renderApp('/requests/transfer?tab=approvals')

    await user.click(await screen.findByRole('tab', { name: 'Delegates' }))
    expect(await screen.findByRole('cell', { name: 'RQ-TRF-0001' })).toBeVisible()

    await user.click(screen.getByRole('checkbox', { name: 'Select RQ-TRF-0001' }))
    await user.click(screen.getByRole('button', { name: 'Approved' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
    )

    expect(await screen.findByText('1 request approved')).toBeInTheDocument()
    const record = transferRequests.find('trq_1')
    expect(record?.flow[0]).toMatchObject({ status: 'approved', actedById: 'em_shelley' })
    expect(record?.status).toBe('pending')
  })

  it('shows the history of an approved transfer', async () => {
    const { user } = renderApp('/requests/transfer')

    await openAction(user, 'RQ-TRF-0003', 'History')
    const dialog = await screen.findByRole('dialog', { name: 'Transfer Request History' })
    expect(await within(dialog).findByText('Approved by Final Authority')).toBeVisible()
    expect(within(dialog).getByText('Approved for the new office.')).toBeVisible()
    expect(within(dialog).getByText('Requested')).toBeVisible()
  })
})
