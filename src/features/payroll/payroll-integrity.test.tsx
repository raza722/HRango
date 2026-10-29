import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api-error'
import {
  banks,
  currentPayrollSettings,
  payrolls,
  payslips,
  salaryRevisions,
} from '@/mocks/payroll/db'
import { renderApp } from '@/test/test-utils'

import { payrollApi } from './api/payroll.api'
import { formatLong, formatMonth } from './utils/format'

// QA fixes 1–5: one payroll a person a month, no negative pay, no negative salary, the
// settings' ranges and formats, the bank codes' formats. Each is refused by the form (inline,
// before anything is sent) and by the API mock (422 with fieldErrors), so a direct call cannot
// get round it.

const FIRST = { timeout: 15_000 }
const MONTH = formatMonth(format(new Date(), 'yyyy-MM'))
const today = format(new Date(), 'yyyy-MM-dd')

/** What the API answered a call it refused. */
async function refused(call: () => Promise<unknown>): Promise<ApiError> {
  try {
    await call()
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('The API accepted it')
}

const rowOf = async (name: string) => {
  const cell = await screen.findByText(name, undefined, FIRST)
  const row = cell.closest('tr')
  if (!row) throw new Error(`No row for ${name}`)
  return row
}

async function openAction(user: UserEvent, label: string, action: string) {
  await user.click(await screen.findByRole('button', { name: label }, FIRST))
  await user.click(await screen.findByRole('menuitem', { name: action }))
}

describe('Payroll integrity', { timeout: 60_000 }, () => {
  describe('one payroll a person a month', () => {
    it('leaves people on another payroll of the month out of the Employments picker', async () => {
      const { user } = renderApp('/payroll/payrolls/monthly')

      const office = await rowOf('Head Office (Pakistan-PKR)')
      await user.click(
        within(office).getByRole('button', {
          name: 'View Employments, Head Office (Pakistan-PKR)',
        }),
      )
      const employments = await screen.findByRole('dialog', { name: 'Employments' })
      await user.click(await within(employments).findByRole('button', { name: 'Add' }))
      const picker = await screen.findByRole('dialog', { name: 'Select Employees' })
      // Sara Khan is on Abdul (Karachi) this month: not offered; Daniel Brooks (Dubai) is.
      expect(
        await within(picker).findByText(/people are on another payroll for/, undefined, FIRST),
      ).toBeVisible()
      await user.click(within(picker).getByRole('combobox', { name: 'Employees' }))
      expect(await screen.findByRole('option', { name: /Daniel Brooks/ })).toBeVisible()
      expect(screen.queryByRole('option', { name: /Sara Khan/ })).not.toBeInTheDocument()
      expect(
        within(picker).getByText(/already on another payroll for .* are skipped/),
      ).toBeVisible()
    })

    it('refuses the same person on two payrolls of a month in the API, and Errors flags it', async () => {
      const { user } = renderApp('/payroll/payrolls/monthly')
      await rowOf('Head Office (Pakistan-PKR)')
      const office = payrolls.find('pr_6')
      if (!office) throw new Error('No Head Office payroll')

      // A direct call cannot add her.
      const error = await refused(() =>
        payrollApi.setPayrollEmployees('pr_6', [...office.employeeIds, 'em_sara']),
      )
      expect(error.status).toBe(422)
      expect(error.fieldErrors.employeeIds).toMatch(/Sara Khan is already on Abdul/)
      // Adding everyone of Karachi skips those already on Abdul.
      const added = await payrollApi.addPayrollEmployees('pr_6', {
        branchId: 'br_khi',
        departmentId: null,
        employeeStatus: 'active',
      })
      expect(added.added).toBe(0)
      expect(added.skipped).toBeGreaterThan(0)
      expect(payrolls.find('pr_6')?.employeeIds).not.toContain('em_sara')

      // Put there by older data anyway: Errors says so, and a run makes no second payslip.
      payrolls.update('pr_6', { ...office, employeeIds: [...office.employeeIds, 'em_sara'] })
      const row = await rowOf('Head Office (Pakistan-PKR)')
      await user.click(within(row).getByRole('button', { name: 'Run, Head Office (Pakistan-PKR)' }))
      expect(await screen.findByText('Payroll run with 1 error')).toBeInTheDocument()
      expect(payslips.find('ps_pr_6_em_sara')).toBeUndefined()
      await user.click(
        within(row).getByRole('button', { name: 'Error, Head Office (Pakistan-PKR)' }),
      )
      const errors = await screen.findByRole('dialog', { name: 'Payrolls History Error' })
      expect((await within(errors).findAllByText('Sara Khan')).length).toBeGreaterThan(0)
      expect(within(errors).getByText(/Has a payslip on Abdul \(Pakistan-PKR\)/)).toBeVisible()
    })
  })

  it('refuses a negative pay line and a negative net on Edit and in the API', async () => {
    const { user } = renderApp('/payroll/pay-slips/all')

    await openAction(user, `Actions for Dr Hamda Shafeeq, ${MONTH}`, 'Edit')
    const dialog = await screen.findByRole('dialog', { name: /^Edit pay slip of Dr Hamda Shafeeq/ })
    const salary = within(dialog).getByRole('textbox', { name: 'Gross Salary value' })
    await user.clear(salary)
    await user.type(salary, '-5000')
    expect(within(dialog).getByText('Gross Salary cannot be negative.')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(salary).toHaveAttribute('aria-invalid', 'true')

    // Nothing earned but the tax still taken: the net would be below zero.
    await user.clear(salary)
    await user.type(salary, '0')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(
      within(dialog).getByText(/The net payable would be Rs -[\d,]+\. It cannot be/),
    ).toBeVisible()
    expect(screen.queryByText('Pay slip updated')).not.toBeInTheDocument()

    const slip = payslips.find('ps_pr_6_em_hamda')
    const line = slip?.lines.find((item) => item.systemCode === 'salary')
    if (!slip || !line) throw new Error('No Head Office slip for Dr Hamda Shafeeq')
    expect(line.amount).toBeGreaterThan(0)
    const negative = await refused(() =>
      payrollApi.updatePayslip(
        slip.id,
        [{ payItemId: line.payItemId, amount: -5000, employerContribution: null }],
        slip.rowVersion,
      ),
    )
    expect(negative.status).toBe(422)
    expect(negative.fieldErrors['lines.0.amount']).toBe('An amount cannot be negative')
    const net = await refused(() =>
      payrollApi.updatePayslip(
        slip.id,
        [{ payItemId: line.payItemId, amount: 0, employerContribution: null }],
        slip.rowVersion,
      ),
    )
    expect(net.status).toBe(422)
    expect(net.fieldErrors.lines).toMatch(/net payable would be Rs -/)
    expect(payslips.find(slip.id)?.netPayable).toBe(slip.netPayable)
  })

  describe('Salary Revision', () => {
    it('refuses a change that makes the salary negative, showing what it would be', async () => {
      const { user } = renderApp('/payroll/salary-revision')

      await user.click(await screen.findByRole('button', { name: 'Create' }, FIRST))
      const dialog = await screen.findByRole('dialog', { name: 'Salary Revision Create' })
      await user.click(await within(dialog).findByRole('combobox', { name: /^Employee/ }))
      await user.click(await screen.findByRole('option', { name: /Hina Raza/ }))
      await user.click(within(dialog).getByRole('button', { name: /^Effective Date/ }))
      await user.click(
        screen.getByRole('button', { name: new RegExp(format(new Date(), 'MMMM do, yyyy')) }),
      )
      // Wait for the previous salary before typing the change.
      await waitFor(() => {
        expect(within(dialog).getByRole('textbox', { name: /^Previous Salary/ })).not.toHaveValue(
          '',
        )
      })
      await user.type(within(dialog).getByRole('textbox', { name: /^Increase Amount/ }), '-900000')
      await user.click(within(dialog).getByRole('button', { name: 'Save' }))
      expect(
        await within(dialog).findByText(
          /The new salary would be Rs -[\d,]+\. It must be more than zero\./,
        ),
      ).toBeVisible()
      expect(salaryRevisions.all().some((item) => item.employeeId === 'em_hina')).toBe(false)

      const error = await refused(() =>
        payrollApi.createSalaryRevision({
          employeeId: 'em_hina',
          effectiveDate: today,
          changeType: 'flat',
          changeValue: -900_000,
        }),
      )
      expect(error.status).toBe(422)
      expect(error.fieldErrors.changeValue).toMatch(/The new salary would be Rs -/)
    })

    it('keeps a promotion’s salary: not editable or deletable here, and the API refuses', async () => {
      salaryRevisions.insert({
        id: 'sr_promo',
        code: 'SR-00099',
        employeeId: 'em_omer',
        effectiveDate: today,
        type: 'flat',
        percentage: null,
        previousSalary: 110_000,
        salary: 130_000,
        source: 'promotion',
        sourceCode: 'RQ-PRM-0004',
      })
      const { user } = renderApp('/payroll/salary-revision')

      await user.click(
        await screen.findByRole(
          'button',
          { name: `Actions for Omer Farooq, ${formatLong(today)}` },
          FIRST,
        ),
      )
      expect(
        await screen.findByRole('menuitem', {
          name: 'From a promotion: cancel it in Requests to undo',
        }),
      ).toHaveAttribute('aria-disabled', 'true')
      expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument()
      expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()

      const row = await payrollApi.salaryRevision('sr_promo')
      const error = await refused(() => payrollApi.deleteSalaryRevision('sr_promo', row.rowVersion))
      expect(error.status).toBe(409)
      expect(error.message).toMatch(/promotion RQ-PRM-0004/)
      expect(salaryRevisions.find('sr_promo')).toBeDefined()
    })
  })

  it('shows every out-of-range setting at its field at once, and the API refuses them', async () => {
    const { user } = renderApp('/payroll/settings/general')

    expect(
      await screen.findByRole('heading', { name: 'Payroll Configurations' }, FIRST),
    ).toBeVisible()
    const shiftDays = screen.getByRole('spinbutton', { name: /Shift Days for Revision/ })
    expect(shiftDays).toHaveAttribute('min', '1')
    expect(shiftDays).toHaveAttribute('max', '3650')
    fireEvent.change(shiftDays, { target: { value: '-3' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: /Cut-Off Day/ }), {
      target: { value: '45' },
    })
    await user.type(screen.getByRole('textbox', { name: /Fixed Revision Date/ }), '13-40')
    await user.type(screen.getByRole('textbox', { name: /Main Color for Payslip$/ }), 'notacolor')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText('Enter a whole number from 1 to 3650')).toBeVisible()
    expect(screen.getByText('Enter a whole number from 1 to 28')).toBeVisible()
    expect(screen.getByText('Enter a month and day as MM-DD, e.g. 07-01 for 1 July')).toBeVisible()
    expect(screen.getByText('Choose a colour, or type one like #17263A')).toBeVisible()
    // Nothing was changed or clamped.
    expect(currentPayrollSettings()).toMatchObject({
      revisionShiftDays: null,
      cutoffDay: null,
      payslipColor: null,
    })

    const error = await refused(() =>
      payrollApi.saveSettings({
        ...currentPayrollSettings(),
        revisionShiftDays: -3,
        cutoffDay: 45,
        payslipColor: 'notacolor',
      }),
    )
    expect(error.status).toBe(422)
    expect(Object.keys(error.fieldErrors).sort()).toEqual([
      'cutoffDay',
      'payslipColor',
      'revisionShiftDays',
    ])
  })

  it('refuses bank codes in the wrong format, in the form and in the API', async () => {
    const { user } = renderApp('/payroll/settings/disbursement-banks')

    await user.click(await screen.findByRole('button', { name: '+ Create' }, FIRST))
    const dialog = await screen.findByRole('dialog', { name: 'Disbursement Bank Create' })
    const fill = async (label: RegExp, text: string) => {
      await user.type(within(dialog).getByRole('textbox', { name: label }), text)
    }
    await fill(/^Account Holder/, 'Top Edge Technologies')
    await fill(/^Account Number/, 'ABC-xyz')
    await fill(/^Bank Name/, 'Bank Alfalah')
    await fill(/^Branch Code/, '!!')
    await fill(/^Branch Location/, 'Karachi')
    await fill(/^Tax Payer ID/, '??')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(
      await within(dialog).findByText(
        'Use digits (dashes allowed), e.g. 0245-1029384756, or an IBAN',
      ),
    ).toBeVisible()
    expect(within(dialog).getByText('Use 2 to 10 letters or digits, e.g. 0245')).toBeVisible()
    expect(within(dialog).getByText('Use digits and dashes, e.g. 7364519-2')).toBeVisible()
    expect(banks.all().some((item) => item.bankName === 'Bank Alfalah')).toBe(false)

    const error = await refused(() =>
      payrollApi.resource('banks').create({
        accountHolder: 'Top Edge Technologies',
        accountNumber: 'ABC-xyz',
        bankName: 'Bank Alfalah',
        branchName: null,
        branchCode: '!!',
        branchLocation: 'Karachi',
        taxPayerId: '??',
        effectiveDate: null,
        description: null,
        rowVersion: null,
      }),
    )
    expect(error.status).toBe(422)
    expect(banks.all().some((item) => item.bankName === 'Bank Alfalah')).toBe(false)
  })
})
