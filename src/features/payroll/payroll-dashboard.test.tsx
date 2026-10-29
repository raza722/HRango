import { configure, screen, waitFor, within } from '@testing-library/react'
import { format, parseISO } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@/mocks/node'
import { payslips } from '@/mocks/payroll/db'
import { apiPath } from '@/mocks/utils'
import { renderApp } from '@/test/test-utils'

import { formatRs } from './utils/format'

const FIRST_LOAD = { timeout: 15_000 }

configure({ asyncUtilTimeout: 4000 })

const year = new Date().getFullYear()
const COMPARISON = `Payroll comparison yearly: net pay per month, ${String(year)} and ${String(year - 1)}`

/** The card a heading names. */
const card = (name: string) => {
  const section = screen.getByRole('heading', { name }).closest('section')
  if (!section) throw new Error(`No ${name} card`)
  return section
}

/** This year's regular payslips (the mock fills them on its first read). */
const thisYearSlips = () =>
  payslips
    .all()
    .filter((slip) => slip.payslipMonth.startsWith(String(year)) && !slip.isFinalSettlement)

describe('Payroll → Dashboard', { timeout: 60_000 }, () => {
  it('draws the frame’s five cards and compares the two years, with a table view', async () => {
    const { user } = renderApp('/payroll/dashboard')
    expect(
      await screen.findByRole('heading', { name: 'Payroll Comparison Yearly' }, FIRST_LOAD),
    ).toBeVisible()
    for (const name of [
      'Expenses Month Wise',
      'Expense Report',
      'Month Wise Loan & Advance',
      'Employee Month Wise Earning',
    ]) {
      expect(screen.getByRole('heading', { name })).toBeVisible()
    }
    // The overview tiles of the earlier build are not in the frame.
    expect(screen.queryByRole('heading', { name: 'Payroll Overview' })).toBeNull()

    const comparison = card('Payroll Comparison Yearly')
    expect(
      await within(comparison).findByRole('img', { name: new RegExp(`^${COMPARISON}`) }),
    ).toBeInTheDocument()
    expect(
      within(within(comparison).getByRole('list', { name: 'Legend' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([String(year), String(year - 1)])

    await user.click(
      within(comparison).getByRole('button', { name: `Show ${COMPARISON} as a table` }),
    )
    const table = await within(comparison).findByRole('table', { name: COMPARISON })
    // The latest month with payslips shows its net pay this year, and nothing last year.
    const latest = thisYearSlips()
      .map((slip) => slip.payslipMonth)
      .sort()
      .at(-1)
    if (!latest) throw new Error('No payslips this year')
    const net = thisYearSlips()
      .filter((slip) => slip.payslipMonth === latest)
      .reduce((total, slip) => total + (slip.netPayable ?? 0), 0)
    const row = within(table)
      .getByRole('rowheader', { name: format(parseISO(latest), 'MMM') })
      .closest('tr')
    expect(row).toHaveTextContent(`${formatRs(net)}Rs 0`)
  })

  it('reports a month’s pay items and says when a month has none', async () => {
    const { user } = renderApp('/payroll/dashboard')
    const report = await waitFor(() => {
      const section = card('Expense Report')
      expect(within(section).getByRole('list', { name: 'Pay item totals' })).toBeVisible()
      return section
    }, FIRST_LOAD)
    // As the dashboard endpoint adds them up: every payslip of the year's latest month.
    const all = payslips.all().filter((slip) => slip.payslipMonth.startsWith(String(year)))
    const latest = all
      .map((slip) => slip.payslipMonth)
      .sort()
      .at(-1)
    const totals = new Map<string, { name: string; amount: number }>()
    for (const slip of all.filter((item) => item.payslipMonth === latest)) {
      for (const line of slip.lines) {
        const current = totals.get(line.payItemId)
        totals.set(line.payItemId, {
          name: line.payItemName,
          amount: (current?.amount ?? 0) + line.amount,
        })
      }
    }
    const items = within(report).getAllByRole('listitem')
    expect(items).toHaveLength(totals.size)
    for (const { name, amount } of totals.values()) {
      expect(items.find((item) => item.textContent.startsWith(name))).toHaveTextContent(
        formatRs(amount),
      )
    }

    // Two years back nothing was paid.
    await user.click(within(report).getByRole('button', { name: 'Expense report month' }))
    await user.click(await screen.findByRole('button', { name: 'Previous year' }))
    await user.click(screen.getByRole('button', { name: 'Previous year' }))
    await user.click(screen.getByRole('button', { name: `January, ${String(year - 2)}` }))
    expect(
      await within(report).findByText(`Nothing paid in January, ${String(year - 2)}`),
    ).toBeVisible()
    expect(within(report).getByText('No Record Found!')).toBeVisible()
  })

  it('shows the loan and advance instalments per month', async () => {
    const { user } = renderApp('/payroll/dashboard')
    const title = `Month wise loan and advance ${String(year)}: instalments due and repaid`
    expect(await screen.findByRole('img', { name: title }, FIRST_LOAD)).toBeInTheDocument()
    const loans = card('Month Wise Loan & Advance')
    await user.click(within(loans).getByRole('button', { name: `Show ${title} as a table` }))
    const table = await within(loans).findByRole('table', { name: title })
    // A row a month, with the due and the repaid amounts.
    expect(within(table).getAllByRole('rowheader')).toHaveLength(12)
    expect(within(table).getByRole('columnheader', { name: 'Due' })).toBeVisible()
    expect(within(table).getByRole('columnheader', { name: 'Repaid' })).toBeVisible()
  })

  it('says so when the loans cannot be read', async () => {
    server.use(
      http.get(apiPath('/loans/installments'), () =>
        HttpResponse.json({ message: 'Server error' }, { status: 500 }),
      ),
    )
    renderApp('/payroll/dashboard')
    expect(
      await screen.findByText('Could not load the loans and advances.', undefined, FIRST_LOAD),
    ).toBeVisible()
  })

  it('opens on the person of the latest payslip and draws their earnings', async () => {
    renderApp('/payroll/dashboard')
    const chart = await screen.findByRole('img', { name: /: earnings per month\./ }, FIRST_LOAD)
    const name = chart.getAttribute('aria-label')?.split(':')[0] ?? ''
    const earning = card('Employee Month Wise Earning')
    expect(within(earning).getByRole('combobox', { name: 'Employee' })).toHaveTextContent(name)
    expect(payslips.all().some((slip) => slip.employeeName === name)).toBe(true)
  })
})
