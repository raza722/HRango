import { configure, screen, waitFor, within } from '@testing-library/react'
import { addDays, format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { applications, evaluations, interviews } from '@/mocks/recruitment/db'
import { renderApp } from '@/test/test-utils'

import { buttonIn, choose, dialog } from './test-helpers'

configure({ asyncUtilTimeout: 4000 })

describe('Recruitment → Interviews', { timeout: 60_000 }, () => {
  it('lists the interviews grouped by day, with All / Mine and status chips', async () => {
    const { user, router } = renderApp('/recruitment/interviews')
    const tomorrow = await screen.findByRole('region', { name: /^Tomorrow/ }, { timeout: 15_000 })
    expect(within(tomorrow).getByText('Mehwish Iqbal')).toBeVisible()
    expect(within(tomorrow).getByText('Scheduled')).toBeVisible()
    // It opens on what is coming (today on), not on last month's history.
    const today = format(new Date(), 'yyyy-MM-dd')
    const coming = interviews
      .all()
      .filter((row) => format(new Date(row.scheduledAt), 'yyyy-MM-dd') >= today).length
    expect(coming).toBeLessThan(9)
    expect(
      screen.getByText(`Showing 1 to ${String(coming)} of ${String(coming)} interviews`),
    ).toBeVisible()

    await user.click(
      within(screen.getByRole('group', { name: 'Which dates' })).getByRole('button', {
        name: 'All dates',
      }),
    )
    expect(await screen.findByText('Showing 1 to 9 of 9 interviews')).toBeVisible()

    await user.click(
      within(screen.getByRole('group', { name: 'Whose interviews' })).getByRole('button', {
        name: 'Mine',
      }),
    )
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ past: true, mine: true })
    })
    // Shelley Kannes (the signed-in user) is on four panels.
    expect(await screen.findByText('Showing 1 to 4 of 4 interviews')).toBeVisible()

    const chips = screen.getByRole('group', { name: 'Interview status' })
    await user.click(within(chips).getByRole('button', { name: 'Completed' }))
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ past: true, mine: true, status: 'completed' })
    })
    expect(await screen.findByText('Showing 1 to 2 of 2 interviews')).toBeVisible()
  })

  it('schedules an interview, completes it and saves an evaluation', async () => {
    const { user } = renderApp('/recruitment/interviews')
    await user.click(
      await screen.findByRole('button', { name: '+ Schedule Interview' }, { timeout: 15_000 }),
    )
    const form = await dialog('Schedule Interview')
    await user.click(buttonIn(form, 'Schedule'))
    expect(await within(form).findByText('Choose the application')).toBeVisible()
    expect(within(form).getByText('Choose the date')).toBeVisible()
    expect(within(form).getByText('Choose at least one interviewer')).toBeVisible()

    await choose(user, /^Application/, /Bilal Hussain/)
    // Tomorrow at 10:00 (today's 10:00 may have passed, and a past time is refused).
    const day = addDays(new Date(), 1)
    await user.click(within(form).getByRole('button', { name: /^Date/ }))
    if (day.getMonth() !== new Date().getMonth()) {
      await user.click(await screen.findByRole('button', { name: /next month/i }))
    }
    await user.click(
      await screen.findByRole('button', { name: new RegExp(format(day, 'MMMM do, yyyy')) }),
    )
    await user.click(within(form).getByRole('combobox', { name: /^Interviewers/ }))
    await user.click(await screen.findByRole('option', { name: /Shelley Kannes/ }))
    await user.keyboard('{Escape}')
    await user.type(within(form).getByRole('textbox', { name: 'Title' }), 'Backend interview')
    await user.click(buttonIn(form, 'Schedule'))

    const detail = await dialog(/Bilal Hussain · round 1/)
    expect(await screen.findByText('Interview scheduled')).toBeVisible()
    const saved = interviews.all().find((row) => row.applicationId === '503')
    expect(saved).toMatchObject({ title: 'Backend interview', interviewerIds: ['em_shelley'] })
    // Scheduling moved the application on to Interview.
    expect(applications.find('503')?.stage).toBe('interview')

    await user.click(within(detail).getByRole('button', { name: 'Complete' }))
    const complete = await dialog('Complete Interview')
    await user.click(buttonIn(complete, 'Complete'))
    expect(await within(complete).findByText('Choose the result')).toBeVisible()
    await choose(user, /^Result/, 'Passed')
    await user.click(buttonIn(complete, 'Complete'))
    expect(await screen.findByText('Interview completed')).toBeVisible()
    expect(interviews.find(saved!.id)).toMatchObject({ status: 'completed', result: 'passed' })

    await user.click(await within(detail).findByRole('button', { name: 'Evaluate' }))
    const evaluate = await dialog('Evaluate Interview')
    await user.click(buttonIn(evaluate, 'Save Evaluation'))
    expect(await within(evaluate).findByText('Choose a rating')).toBeVisible()
    await user.click(within(evaluate).getByRole('radio', { name: '4 out of 5' }))
    await choose(user, /^Recommendation/, 'Strong Hire')
    await user.type(within(evaluate).getByRole('textbox', { name: 'Strengths' }), 'Solid SQL')
    await user.click(buttonIn(evaluate, 'Save Evaluation'))
    expect(await screen.findByText('Evaluation saved')).toBeVisible()
    expect(evaluations.all().find((row) => row.interviewId === saved!.id)).toMatchObject({
      employeeId: 'em_shelley',
      rating: 4,
      recommendation: 'strong_hire',
      strengths: 'Solid SQL',
    })
    const list = await within(detail).findByRole('list', { name: 'Evaluations' })
    expect(within(list).getByText('Solid SQL')).toBeVisible()
  })

  it('cancels a scheduled interview with a reason', async () => {
    const { user } = renderApp('/recruitment/interviews?view=%22802%22')
    const detail = await dialog(/Ahmed Raza · round 2/)
    await user.click(
      await within(detail).findByRole('button', { name: 'Cancel Interview' }, { timeout: 15_000 }),
    )
    const form = await dialog('Cancel Interview')
    await user.click(buttonIn(form, 'Cancel Interview'))
    expect(await within(form).findByText('Say why it is cancelled')).toBeVisible()
    await user.type(within(form).getByRole('textbox', { name: /^Reason/ }), 'Candidate travelling')
    await user.click(buttonIn(form, 'Cancel Interview'))
    expect(await screen.findByText('Interview cancelled')).toBeVisible()
    expect(interviews.find('802')).toMatchObject({
      status: 'cancelled',
      remarks: 'Candidate travelling',
    })
  })
})
