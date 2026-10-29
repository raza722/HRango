import { useState } from 'react'
import { configure, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, differenceInCalendarMonths, format } from 'date-fns'
import { describe, expect, it, vi } from 'vitest'

import { appraisals } from '@/mocks/performance/db'
import { renderApp, renderWithQueryClient, signIn } from '@/test/test-utils'

import { type AppraisalsSearch, appraisalsSearchSchema, AppraisalsView } from './index'

configure({ asyncUtilTimeout: 4000 })

const YEAR = new Date().getFullYear()
const CRITERIA = ['Job Knowledge', 'Quality of Work', 'Communication', 'Teamwork', 'Initiative']

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

/** Picks a level ("4 · Exceeds Expectations") in a criterion's rating group. */
async function rate(user: UserEvent, form: HTMLElement, criterion: string, score: number) {
  const group = within(form).getByRole('group', { name: new RegExp(`^${criterion}`) })
  await user.click(within(group).getByRole('radio', { name: new RegExp(`^${String(score)} · `) }))
}

describe('Performance → Reviews and Appraisals', { timeout: 60_000 }, () => {
  it('saves a self review as a draft, then submits it', async () => {
    const { user, router } = renderApp('/performance/reviews')

    const table = await screen.findByRole('table', { name: 'My Self Reviews' }, { timeout: 15_000 })
    await within(table).findByText(`Annual Review ${String(YEAR - 1)}`)
    const rows = within(table).getAllByRole('row')
    // The one waiting for Shelley comes first.
    expect(rows[1]).toHaveTextContent(`Annual Review ${String(YEAR)}`)
    expect(rows[1]).toHaveTextContent('Self review to write')
    expect(
      within(table)
        .getByText(`Annual Review ${String(YEAR - 1)}`)
        .closest('tr'),
    ).toHaveTextContent('Finalised')

    await user.click(
      within(table).getByRole('button', {
        name: `Start the review of Shelley Kannes for Annual Review ${String(YEAR)}`,
      }),
    )
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ review: 'pa_shelley' })
    })
    const form = await screen.findByRole('form', { name: 'Self review' })
    expect(screen.getByRole('heading', { name: 'Self Review', level: 1 })).toBeVisible()

    // Submitting needs every criterion rated.
    await user.click(within(form).getByRole('button', { name: 'Submit Review' }))
    expect(await within(form).findByText('Rate every criterion before submitting.')).toBeVisible()
    expect(within(form).getAllByText('Choose a rating')).toHaveLength(5)

    // A draft keeps what is there.
    await rate(user, form, 'Job Knowledge', 4)
    await user.click(within(form).getByRole('button', { name: 'Save Draft' }))
    expect(await screen.findByText('Draft saved')).toBeVisible()
    await waitFor(() => {
      expect(appraisals.find('pa_shelley')?.ratings[0]).toMatchObject({
        criterionId: 'cr_an_knowledge',
        selfRating: 4,
      })
    })
    expect(appraisals.find('pa_shelley')?.status).toBe('self_review')

    const again = await screen.findByRole('form', { name: 'Self review' })
    await waitFor(() => {
      expect(
        within(within(again).getByRole('group', { name: /^Job Knowledge/ })).getByRole('radio', {
          name: /^4 · /,
        }),
      ).toBeChecked()
    })
    for (const [index, criterion] of CRITERIA.slice(1).entries()) {
      await rate(user, again, criterion, [5, 4, 4, 3][index] ?? 3)
    }
    await user.type(
      within(again).getByRole('textbox', { name: 'Overall Comments' }),
      'Appraisals launched on time.',
    )
    await user.click(within(again).getByRole('button', { name: 'Submit Review' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Submit' }),
    )
    expect(await screen.findByText('Self review submitted')).toBeVisible()
    await waitFor(() => {
      expect(router.state.location.search).toEqual({})
    })
    expect(appraisals.find('pa_shelley')).toMatchObject({
      status: 'manager_review',
      selfComments: 'Appraisals launched on time.',
    })
    const list = await screen.findByRole('table', { name: 'My Self Reviews' })
    await waitFor(() => {
      expect(
        within(list)
          .getByText(`Annual Review ${String(YEAR)}`)
          .closest('tr'),
      ).toHaveTextContent('Waiting for Daniel Brooks')
    })
  })

  it('writes the manager review of a team member, then finalises the appraisal', async () => {
    const { user, router } = renderApp('/performance/reviews?tab=team')

    const table = await screen.findByRole(
      'table',
      { name: 'Reviews I Write as Manager' },
      { timeout: 15_000 },
    )
    await user.click(
      await within(table).findByRole('button', {
        name: `Start the review of Sadia Rehman for Annual Review ${String(YEAR)}`,
      }),
    )
    const form = await screen.findByRole('form', { name: 'Manager review' })
    expect(screen.getByRole('heading', { name: 'Manager Review', level: 1 })).toBeVisible()
    // Her own rating shows beside each criterion.
    expect(
      within(within(form).getByRole('group', { name: /^Job Knowledge/ })).getByText(
        /4 · Exceeds Expectations — Ran every onboarding session this year\./,
      ),
    ).toBeVisible()

    for (const [index, criterion] of CRITERIA.entries()) {
      await rate(user, form, criterion, [4, 4, 4, 5, 3][index] ?? 3)
    }
    await user.type(
      within(form).getByRole('textbox', { name: 'Manager Comments' }),
      'Onboarding is in very good hands.',
    )
    await user.type(
      within(form).getByRole('textbox', { name: 'Development Needs' }),
      'A payroll course',
    )
    await user.click(within(form).getByRole('button', { name: 'Submit Review' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Submit' }),
    )
    expect(await screen.findByText('Manager review submitted')).toBeVisible()
    expect(appraisals.find('pa_sadia')).toMatchObject({
      status: 'reviewed',
      managerComments: 'Onboarding is in very good hands.',
      developmentNeeds: 'A payroll course',
    })

    // Appraisals: Kaleem's (manager review still open) can't be finalised; Sadia's can.
    await router.navigate({ to: '/performance/appraisals', search: { cycleId: 'pc_current' } })
    const list = await screen.findByRole('table', { name: 'All Appraisals' })
    await user.click(
      await within(list).findByRole('button', {
        name: 'Actions for the appraisal of Kaleem Murtaza',
      }),
    )
    expect(await screen.findByRole('menuitem', { name: 'View' })).toBeVisible()
    expect(screen.queryByRole('menuitem', { name: 'Finalise' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(
      within(list).getByRole('button', { name: 'Actions for the appraisal of Sadia Rehman' }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Finalise' }))
    // Suggested: 40% goals (3.1) + 60% manager (4.0) = 3.64.
    const dialog = await screen.findByRole('dialog', { name: 'Finalise Appraisal' })
    const score = within(dialog).getByRole('textbox', { name: /^Final Score/ })
    expect(score).toHaveValue('3.64')
    await user.clear(score)
    await user.type(score, '7')
    await user.click(within(dialog).getByRole('combobox', { name: /^Outcome/ }))
    await user.click(await screen.findByRole('option', { name: 'Increment' }))
    await user.click(within(dialog).getByRole('button', { name: 'Finalise' }))
    expect(await within(dialog).findByText("The final score can't be above 5")).toBeVisible()
    expect(within(dialog).getByText('Enter the increment (above 0)')).toBeVisible()
    expect(within(dialog).getByText('Choose the effective date')).toBeVisible()

    await user.clear(score)
    await user.type(score, '3.8')
    expect(within(dialog).getByText('Rating: Meets Expectations')).toBeVisible()
    await user.type(within(dialog).getByRole('textbox', { name: /^Increment \(%\)/ }), '10')
    await pickDate(user, dialog, 'Effective Date', addDays(new Date(), 30))
    await user.click(within(dialog).getByRole('button', { name: 'Finalise' }))
    expect(await screen.findByText('Appraisal of Sadia Rehman finalised')).toBeVisible()
    expect(
      await screen.findByRole('heading', { name: 'Appraisal: Sadia Rehman', level: 1 }),
    ).toBeVisible()
    const ratings = await screen.findByRole('table', { name: 'Ratings by criterion' })
    expect(within(ratings).getByText('Job Knowledge').closest('tr')).toHaveTextContent(
      '4 · Exceeds ExpectationsRan every onboarding session this year.4 · Exceeds Expectations',
    )

    expect(appraisals.find('pa_sadia')).toMatchObject({
      status: 'finalised',
      finalScore: 3.8,
      finalRatingLabel: 'Meets Expectations',
      outcome: 'increment',
      increment: { changeType: 'percent', changeValue: 10, status: 'proposed' },
    })
    const scores = await screen.findByRole('list', { name: 'Scores' })
    await waitFor(() => {
      expect(within(scores).getByText('Final Score').closest('li')).toHaveTextContent(
        'Meets Expectations',
      )
    })
    expect(screen.getByText(/Increment — Percentage 10% from/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Finalise' })).not.toBeInTheDocument()
  })

  it('renders AppraisalsView from its props alone (as Payroll Settings embeds it)', async () => {
    signIn()
    const onSearch = vi.fn()
    function Harness() {
      const [search, setSearch] = useState<AppraisalsSearch>(
        appraisalsSearchSchema.parse({ status: 'reviewed' }),
      )
      return (
        <AppraisalsView
          search={search}
          onSearch={(patch) => {
            onSearch(patch)
            setSearch((current) => ({ ...current, ...patch }))
          }}
        />
      )
    }
    const { user } = renderWithQueryClient(<Harness />)

    const table = await screen.findByRole('table', { name: 'All Appraisals' }, { timeout: 15_000 })
    expect(await within(table).findByRole('button', { name: 'Ayesha Malik' })).toBeVisible()
    expect(screen.getByText('Showing 1–1 of 1')).toBeVisible()
    expect(screen.getByRole('button', { name: /^Filter\s*1\s*in use$/ })).toBeVisible()

    await user.click(within(table).getByRole('button', { name: 'Ayesha Malik' }))
    expect(onSearch).toHaveBeenLastCalledWith({ appraisal: 'pa_ayesha', finalise: undefined })
    expect(
      await screen.findByRole('heading', { name: 'Appraisal: Ayesha Malik', level: 1 }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Finalise' })).toBeVisible()
    expect(await screen.findByRole('table', { name: 'Ratings by criterion' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Back to appraisals' }))
    expect(onSearch).toHaveBeenLastCalledWith({ appraisal: undefined, finalise: undefined })
    expect(await screen.findByRole('table', { name: 'All Appraisals' })).toBeVisible()

    await user.click(screen.getByRole('tab', { name: 'Team' }))
    expect(onSearch).toHaveBeenLastCalledWith({ tab: 'team', page: 1 })
    expect(await screen.findByRole('table', { name: 'Team Appraisals' })).toBeVisible()
  })
})
