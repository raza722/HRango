import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, differenceInCalendarMonths, format } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { server } from '@/mocks/node'
import { salaryRevisions } from '@/mocks/payroll/db'
import { salaryOn } from '@/mocks/payroll/engine'
import { standardRequests } from '@/mocks/requests/standard'
import {
  PROMOTION_DESIGNATIONS,
  PROMOTION_GRADES,
  PROMOTION_LEVELS,
} from '@/mocks/requests/standard/kinds/promotion'
import { apiPath } from '@/mocks/utils'
import { renderApp } from '@/test/test-utils'

async function choose(user: UserEvent, label: RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

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

const today = () => format(new Date(), 'yyyy-MM-dd')
const amount = (value: number) => value.toLocaleString('en-US')

describe('Promotion (the request engine’s promotion type)', () => {
  // The settings mock has no grades, levels or designations; serve the ones the requests use.
  beforeEach(() => {
    server.use(
      ...(
        [
          ['grades', PROMOTION_GRADES],
          ['job-levels', PROMOTION_LEVELS],
          ['designations', PROMOTION_DESIGNATIONS],
        ] as const
      ).map(([kind, rows]) =>
        http.get(apiPath(`/organisation/lookups/${kind}`), () => HttpResponse.json({ data: rows })),
      ),
    )
  })

  it('lists everyone’s requests and submits one; payroll gives the previous salary', async () => {
    const { user } = renderApp('/requests/promotion')

    expect(await screen.findByRole('heading', { name: 'Promotion Requests' })).toBeVisible()
    expect(
      await screen.findByRole('cell', { name: 'RQ-PRM-0001' }, { timeout: 5000 }),
    ).toBeVisible()
    expect(screen.getByRole('cell', { name: 'RQ-PRM-0006' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Promotion Request Create' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose the employee')).toBeVisible()
    expect(within(dialog).getByText('Give the salary')).toBeVisible()

    await choose(user, /^Employee/, /^Hina Raza/)
    const previous = salaryOn('em_hina', today())
    // The API reads the previous salary from payroll when the request is saved.
    expect(within(dialog).getByRole('status')).toHaveTextContent('—')

    await choose(user, /^Grade/, 'G5')
    await choose(user, /^Level/, 'L3')
    await choose(user, /^Designation/, 'Senior Manager')
    await choose(user, /^Job Title/, 'HR Manager')
    // A promotion cannot lower the salary.
    await user.click(within(dialog).getByLabelText(/^Salary/))
    await user.paste(String(previous - 1000))
    await user.click(within(dialog).getByRole('checkbox', { name: 'Medical' }))
    const effective = addDays(new Date(), 10)
    await pickDate(user, /^Effective Date/, effective)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('A promotion cannot lower the salary.')).toBeVisible()

    await user.clear(within(dialog).getByLabelText(/^Salary/))
    await user.paste(String(previous + 50_000))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect((await screen.findAllByText('Request submitted')).length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(
        standardRequests
          .all()
          .find((record) => record.kind === 'promotion' && record.employeeId === 'em_hina')
          ?.payload,
      ).toMatchObject({
        isDemotion: false,
        gradeId: 'gr_g5',
        designationId: 'ds_senior_manager',
        jobLevelId: 'jl_l3',
        previousSalary: previous,
        newSalary: previous + 50_000,
        benefitPayItemIds: ['pi_medical'],
        effectiveDate: format(effective, 'yyyy-MM-dd'),
      })
    })
  })

  it('approves a promotion (with the required remarks) into a Payroll salary revision', async () => {
    const { user } = renderApp('/requests/promotion?tab=approvals')

    expect(await screen.findByRole('heading', { name: 'Promotion Approvals' })).toBeVisible()
    expect(
      await screen.findByRole('cell', { name: 'RQ-PRM-0001' }, { timeout: 5000 }),
    ).toBeVisible()
    await openAction(user, 'RQ-PRM-0001', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'Promotion Approve/Reject' })
    const record = standardRequests.find('pr_0001')
    const payload = record?.payload as { previousSalary: number; newSalary: number }
    expect(await within(dialog).findByText(amount(payload.previousSalary))).toBeVisible()

    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    expect(await within(dialog).findByText('Give a reason for approval')).toBeVisible()
    await user.type(
      within(dialog).getByRole('textbox', { name: /^Reason for Approval/ }),
      'Two strong reviews.',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
    )
    expect((await screen.findAllByText('Request approved')).length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(standardRequests.find('pr_0001')?.status).toBe('completed')
    })
    const effectiveDate = (record?.payload as { effectiveDate: string }).effectiveDate
    expect(
      salaryRevisions
        .all()
        .find((item) => item.employeeId === 'em_sadia' && item.effectiveDate === effectiveDate),
    ).toMatchObject({ type: 'flat', salary: payload.newSalary })
    expect(salaryOn('em_sadia', effectiveDate)).toBe(payload.newSalary)
  })

  it('shows Bilal Ahmed’s team under Delegates', async () => {
    renderApp('/requests/promotion?tab=approvals&view=delegates')
    expect(
      await screen.findByRole('cell', { name: 'RQ-PRM-0002' }, { timeout: 5000 }),
    ).toBeVisible()
    expect(screen.queryByRole('cell', { name: 'RQ-PRM-0001' })).not.toBeInTheDocument()
  })
})
