import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, differenceInCalendarMonths, format } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@/mocks/node'
import { standardRequests } from '@/mocks/requests/standard'
import { LOAN_EMPLOYMENT_TYPES } from '@/mocks/requests/standard/kinds/loan-advances-settings'
import { apiPath } from '@/mocks/utils'
import { renderApp } from '@/test/test-utils'

async function choose(user: UserEvent, label: RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

/** Opens a date field's calendar and picks the day, moving months from `opensOn` if needed. */
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

const mine = () =>
  standardRequests
    .all()
    .filter((record) => record.kind === 'loan-advances' && record.employeeId === 'em_shelley')

/** The first load of a whole-app render can be slow when every test file runs at once. */
const FIRST = { timeout: 5_000 }
/** Long flows (a form, a popup inside it, the server's answer). */
const LONG = 40_000

describe('Loan & Advances (the request engine’s loan type and the Loans module)', () => {
  it('lists my loans and everyone’s', async () => {
    const { user } = renderApp('/requests/loan-advances')

    expect(await screen.findByRole('heading', { name: 'Loan & Advances' }, FIRST)).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'RQ-LA-0006' }, FIRST)).toBeVisible()
    expect(screen.getByRole('button', { name: 'All (3)' })).toBeVisible()
    expect(screen.queryByRole('cell', { name: 'RQ-LA-0001' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'All Loan & Advances' }))
    expect(await screen.findByRole('cell', { name: 'RQ-LA-0001' }, FIRST)).toBeVisible()
    expect(screen.getAllByText('PKR 180K').length).toBeGreaterThan(0)
  })

  it(
    'submits one with a guarantor; the type’s rules refuse a second Car Loan',
    async () => {
      const { user } = renderApp('/requests/loan-advances')

      expect(await screen.findByRole('cell', { name: 'RQ-LA-0006' }, FIRST)).toBeVisible()
      await user.click(await screen.findByRole('button', { name: 'Create' }))
      const dialog = await screen.findByRole('dialog', { name: 'Loan & Advance Request Create' })
      // My Loan & Advances: no Employee field (the frames draw it on All only).
      expect(within(dialog).queryByRole('combobox', { name: /^Employee/ })).not.toBeInTheDocument()
      await user.click(within(dialog).getByRole('button', { name: 'Save' }))
      expect(await within(dialog).findByText('Choose the loan & advances type')).toBeVisible()
      expect(within(dialog).getByText('Give a reason')).toBeVisible()

      await choose(user, /^Loan & Advances Type/, /^Car Loan/)
      await choose(user, /^Loan & Advances Category/, 'Personal')
      await user.type(
        within(dialog).getByRole('textbox', { name: /^Required Loan & Advances Amount/ }),
        '90000',
      )
      await pickDate(user, /^Required Date/, addDays(new Date(), 40))
      await user.type(
        within(dialog).getByRole('textbox', { name: /^Reason/ }),
        'A bike to commute.',
      )
      await user.click(within(dialog).getByRole('button', { name: 'Save' }))
      expect(await within(dialog).findByText('Car Loan needs a guarantor')).toBeVisible()

      await user.click(within(dialog).getByRole('button', { name: 'Add guarantor' }))
      const guarantor = await screen.findByRole('dialog', { name: 'Guarantor Create' })
      await user.type(within(guarantor).getByRole('textbox', { name: /^Name/ }), 'Imran Kannes')
      await user.type(within(guarantor).getByRole('textbox', { name: /^CNIC/ }), '1234-56789-0')
      await user.click(within(guarantor).getByRole('button', { name: 'Save' }))
      expect(await within(guarantor).findByText('Write the CNIC as 12345-1234567-1')).toBeVisible()
      const cnic = within(guarantor).getByRole('textbox', { name: /^CNIC/ })
      await user.clear(cnic)
      await user.type(cnic, '35202-1112223-4')
      await pickDate(user, /^Known Since/, new Date())
      await choose(user, /^Relationship/, 'Family')
      await user.click(within(guarantor).getByRole('button', { name: 'Save' }))
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Guarantor Create' })).not.toBeInTheDocument()
      })
      expect(within(dialog).getByRole('cell', { name: 'Imran Kannes' })).toBeVisible()

      // A second Car Loan while RQ-LA-0006 waits: the server refuses it on the type.
      await user.click(within(dialog).getByRole('button', { name: 'Save' }))
      expect(await within(dialog).findByText('RQ-LA-0006 is still waiting')).toBeVisible()

      await choose(user, /^Loan & Advances Type/, /^Bike Loan/)
      await user.click(within(dialog).getByRole('button', { name: 'Save' }))
      expect((await screen.findAllByText('Request submitted')).length).toBeGreaterThan(0)
      await waitFor(() => {
        expect(mine()).toHaveLength(4)
      })
      const created = mine().find((record) => record.payload.loanTypeId === 'lt_bike')
      expect(created?.payload).toMatchObject({
        amountRequested: 90_000,
        loanCategoryId: 'lc_personal',
        reason: 'A bike to commute.',
        guarantors: [{ name: 'Imran Kannes', cnic: '35202-1112223-4', relationship: 'Family' }],
      })
    },
    LONG,
  )

  it(
    'approves with the approver’s fields, and the installments reach Repayment',
    async () => {
      const { user } = renderApp('/requests/loan-advances?tab=approvals')

      expect(
        await screen.findByRole('heading', { name: 'Loan & Advances Approval' }, FIRST),
      ).toBeVisible()
      expect(await screen.findByRole('cell', { name: 'RQ-LA-0001' }, FIRST)).toBeVisible()
      expect(screen.queryByRole('tab', { name: 'Consents' })).not.toBeInTheDocument()
      await openAction(user, 'RQ-LA-0001', 'Approve/Reject')
      const dialog = await screen.findByRole('dialog', { name: 'Loan & Advances Approve/Reject' })
      expect(await within(dialog).findByText('Total Approved Requests Amount')).toBeVisible()
      expect(within(dialog).getByText('Nadia Rehman')).toBeVisible()

      // More than asked: the server refuses it on the field.
      const amount = within(dialog).getByRole('textbox', { name: /^Approved Amount/ })
      expect(amount).toHaveValue('180,000')
      await user.clear(amount)
      await user.type(amount, '200000')
      await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
      await confirmYes(user)
      expect(
        (
          await within(dialog).findAllByText(
            'The approved amount must be more than zero and no more than the amount asked.',
          )
        ).length,
      ).toBeGreaterThan(0)

      await user.clear(amount)
      await user.type(amount, '150000')
      await choose(user, /^Payment Method/, 'Cash')
      await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
      await confirmYes(user)
      expect((await screen.findAllByText('Request approved')).length).toBeGreaterThan(0)

      const record = standardRequests.find('la_0001')
      expect(record?.status).toBe('completed')
      expect(record?.payload).toMatchObject({
        approvedAmount: 150_000,
        paymentMethod: 'cash',
        installments: 12,
        gapBetweenInstallmentsMonths: 1,
      })

      // Settings → Repayment: twelve installments of PKR 12,500 from the repayment month.
      await user.click(screen.getByRole('tab', { name: 'Settings' }))
      await user.click(await screen.findByRole('tab', { name: 'Repayment' }))
      await user.click(await screen.findByRole('button', { name: 'Filter' }))
      const filters = await screen.findByRole('dialog', { name: 'Filters' })
      await user.click(within(filters).getByRole('combobox', { name: 'Employees' }))
      await user.click(await screen.findByRole('option', { name: /Sadia Rehman/ }))
      await user.click(within(filters).getByRole('button', { name: 'Search' }))
      expect(await screen.findByText('All (12)')).toBeVisible()
      expect(screen.getAllByRole('cell', { name: 'PKR 12.5K' }).length).toBe(10)
      expect(screen.getByRole('cell', { name: 'No. 1' })).toBeVisible()
    },
    LONG,
  )

  it('approves a delegated request in bulk, which fills in the amount asked', async () => {
    const { user } = renderApp('/requests/loan-advances?tab=approvals&view=delegates')

    expect(await screen.findByRole('cell', { name: 'RQ-LA-0002' }, FIRST)).toBeVisible()
    await user.click(screen.getByRole('checkbox', { name: 'Select RQ-LA-0002' }))
    await user.click(screen.getByRole('button', { name: 'Approved' }))
    await confirmYes(user)
    expect(await screen.findByText('1 request approved')).toBeInTheDocument()
    const record = standardRequests.find('la_0002')
    expect(record?.flow[0]).toMatchObject({ status: 'approved', actedById: 'em_shelley' })
    expect(record?.status).toBe('pending')
    // Bulk approve has no form: the API prefills the amount asked, a payment method and a date.
    const asked = (record?.payload as { amountRequested?: number } | undefined)?.amountRequested
    expect(record?.payload).toMatchObject({ approvedAmount: asked, paymentMethod: 'cash' })
  })

  it(
    'creates a type in Settings, and the Create form offers it',
    async () => {
      // The settings mock has no employment types; serve the ones the loan types use.
      server.use(
        http.get(apiPath('/organisation/lookups/employment-types'), () =>
          HttpResponse.json({ data: LOAN_EMPLOYMENT_TYPES }),
        ),
      )
      const { user } = renderApp('/requests/loan-advances?tab=settings')

      expect(await screen.findByRole('cell', { name: 'Car Loan' }, FIRST)).toBeVisible()
      expect(screen.getByRole('columnheader', { name: 'Employee Experience' })).toBeVisible()
      await user.click(screen.getByRole('button', { name: 'Create' }))
      const dialog = await screen.findByRole('dialog', { name: 'Loan & Advance Type Create' })
      await user.click(within(dialog).getByRole('button', { name: 'Save' }))
      expect(await within(dialog).findByText('Enter the name')).toBeVisible()
      expect(within(dialog).getByText('Choose at least one contract type')).toBeVisible()
      expect(within(dialog).getByText('Choose the deduction pay item')).toBeVisible()

      await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Education Loan')
      await user.click(within(dialog).getByRole('checkbox', { name: 'Guarantor Required' }))
      await user.type(within(dialog).getByRole('textbox', { name: /^Employee Experience/ }), '12')
      await user.type(within(dialog).getByRole('textbox', { name: /^Gap Between Requests/ }), '12')
      await user.type(within(dialog).getByRole('textbox', { name: /^No of Installments/ }), '10')
      await user.type(
        within(dialog).getByRole('textbox', { name: /^Gap Between Installments/ }),
        '1',
      )
      await choose(user, /^Employment Contract Type/, 'Permanent')
      await user.keyboard('{Escape}')
      await choose(user, /^Deduction Payitem/, 'Loan Deduction')
      await user.click(within(dialog).getByRole('button', { name: 'Save' }))

      expect((await screen.findAllByText('Type created')).length).toBeGreaterThan(0)
      expect(await screen.findByRole('cell', { name: 'Education Loan' })).toBeVisible()

      await user.click(screen.getByRole('tab', { name: 'Requests' }))
      await user.click(await screen.findByRole('button', { name: 'Create' }))
      await screen.findByRole('dialog', { name: 'Loan & Advance Request Create' })
      await user.click(screen.getByRole('combobox', { name: /^Loan & Advances Type/ }))
      expect(await screen.findByRole('option', { name: /^Education Loan/ })).toBeVisible()
    },
    LONG,
  )

  it('will not delete a category that requests use', async () => {
    const { user } = renderApp('/requests/loan-advances?tab=settings&section=categories')

    expect(await screen.findByRole('cell', { name: 'Personal' }, FIRST)).toBeVisible()
    await openAction(user, 'Personal', 'Delete')
    await confirmYes(user)
    expect(
      (await screen.findAllByText('RQ-LA-0001 uses Personal; make it inactive instead.')).length,
    ).toBeGreaterThan(0)
    expect(screen.getByRole('cell', { name: 'Personal' })).toBeVisible()
  })
})
