import { configure, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { applications, history } from '@/mocks/recruitment/db'
import { employees } from '@/mocks/talent-management/db'
import { renderApp, setViewportWidth } from '@/test/test-utils'

import { buttonIn, choose, dialog, rowAction } from './test-helpers'

configure({ asyncUtilTimeout: 4000 })

/** A board column by its stage name. */
const column = (stage: string) =>
  screen
    .getByRole('region', { name: 'Pipeline board' })
    .querySelector<HTMLElement>(`section[aria-labelledby="board-${stage}"]`)!

describe('Recruitment → Applications', { timeout: 60_000 }, () => {
  it('shows the pipeline board, one column per stage with its count', async () => {
    renderApp('/recruitment/applications')
    const board = await screen.findByRole('region', { name: 'Pipeline board' }, { timeout: 15_000 })
    for (const stage of [
      'Applied',
      'Screening',
      'Shortlisted',
      'Interview',
      'Offer',
      'Hired',
      'Rejected',
      'Withdrawn',
    ]) {
      expect(within(board).getByRole('heading', { name: new RegExp(`^${stage}`) })).toBeVisible()
    }
    const applied = await within(column('applied')).findByRole('list', {
      name: 'Applied applications',
    })
    expect(within(applied).getByRole('button', { name: 'Bilal Hussain' })).toBeVisible()
    await waitFor(() => {
      expect(within(column('applied')).getByRole('heading')).toHaveTextContent(
        'Applied4 applications',
      )
    })
    const hired = await within(column('hired')).findByRole('list', { name: 'Hired applications' })
    expect(within(hired).getByRole('button', { name: 'Omer Farooq' })).toBeVisible()
  })

  it('moves a card through the stages from its menu; a rejected one no longer moves', async () => {
    const { user } = renderApp('/recruitment/applications')
    await screen.findByRole('region', { name: 'Pipeline board' }, { timeout: 15_000 })
    await rowAction(
      user,
      'Actions for Bilal Hussain, Senior Software Engineer',
      'Move to Screening',
    )
    expect(await screen.findByText('Bilal Hussain moved to Screening')).toBeVisible()
    expect(applications.find('503')?.stage).toBe('screening')
    const screening = await within(column('screening')).findByRole('list', {
      name: 'Screening applications',
    })
    expect(await within(screening).findByRole('button', { name: 'Bilal Hussain' })).toBeVisible()

    await rowAction(
      user,
      'Actions for Bilal Hussain, Senior Software Engineer',
      'Move to Shortlisted',
    )
    expect(await screen.findByText('Bilal Hussain moved to Shortlisted')).toBeVisible()
    expect(applications.find('503')?.stage).toBe('shortlisted')
    expect(
      history
        .all()
        .filter((row) => row.applicationId === '503')
        .map((row) => row.toStage),
    ).toEqual(expect.arrayContaining(['applied', 'screening', 'shortlisted']))

    // Sana Javed was rejected: her card offers no moves.
    await user.click(
      screen.getByRole('button', { name: 'Actions for Sana Javed, Senior Software Engineer' }),
    )
    const menu = await screen.findByRole('menu')
    expect(within(menu).queryByRole('menuitem', { name: /Move to/ })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: 'Reject' })).not.toBeInTheDocument()
  })

  it('rejects an application with a reason from the settings list', async () => {
    const { user } = renderApp('/recruitment/applications')
    await screen.findByRole('region', { name: 'Pipeline board' }, { timeout: 15_000 })
    await rowAction(user, 'Actions for Hassan Ali, Senior Software Engineer', 'Reject')
    const form = await dialog('Reject Application')
    await user.click(buttonIn(form, 'Reject'))
    expect(await within(form).findByText('Choose the reason')).toBeVisible()
    // Inactive reasons are not offered.
    await user.click(within(form).getByRole('combobox', { name: 'Reason' }))
    expect(screen.queryByRole('option', { name: 'Could not be reached' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('option', { name: 'Skills do not match the role' }))
    await user.type(within(form).getByRole('textbox', { name: 'Remarks' }), 'Mostly frontend work')
    await user.click(buttonIn(form, 'Reject'))
    expect(await screen.findByText('Hassan Ali rejected')).toBeVisible()
    expect(applications.find('505')).toMatchObject({
      stage: 'rejected',
      rejectedStage: 'screening',
      rejectionReasonId: '2',
    })
    const rejected = column('rejected')
    expect(await within(rejected).findByRole('button', { name: 'Hassan Ali' })).toBeVisible()
  })

  it('hires from an accepted offer and links to the new employee profile', async () => {
    const before = employees.all().length
    const { user, router } = renderApp('/recruitment/applications?view=%22514%22')
    const detail = await dialog(/Usama Khalid · UI\/UX Designer/)
    await user.click(
      await within(detail).findByRole('button', { name: 'Hire' }, { timeout: 15_000 }),
    )
    const form = await dialog('Hire')
    expect(within(form).getByText(/Accepted offer: Rs 235,000/)).toBeVisible()
    await user.type(within(form).getByRole('textbox', { name: 'CNIC' }), '12345')
    await user.click(buttonIn(form, 'Hire'))
    expect(await within(form).findByText('Enter the CNIC as 35202-1234567-1')).toBeVisible()
    await user.clear(within(form).getByRole('textbox', { name: 'CNIC' }))
    await user.type(within(form).getByRole('textbox', { name: 'CNIC' }), '35202-7654321-9')
    await user.click(buttonIn(form, 'Hire'))

    expect(await screen.findByText(/Usama Khalid hired as EMP-\d{4}/)).toBeVisible()
    const hired = applications.find('514')
    expect(hired?.stage).toBe('hired')
    expect(employees.all()).toHaveLength(before + 1)
    const person = employees.find(hired?.employeeId ?? '')
    expect(person).toMatchObject({
      firstName: 'Usama',
      lastName: 'Khalid',
      branchId: 'br_lhr_jt',
      status: 'probation',
      cnic: '35202-7654321-9',
      lineManagerId: 'em_bilal',
    })

    const after = await dialog(/Usama Khalid · UI\/UX Designer/)
    const link = await within(after).findByRole('link', { name: 'View employee profile' })
    expect(within(after).getByText('Hired')).toBeVisible()
    // Hired: nothing moves it any more.
    expect(within(after).queryByRole('button', { name: 'Move Stage' })).not.toBeInTheDocument()
    await user.click(link)
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/talent-management/employees/${person!.id}`)
    })
  })

  it('adds a new candidate to an opening, then opens the application timeline', async () => {
    const { user, router } = renderApp('/recruitment/applications?mode=list')
    await screen.findByRole('table', { name: 'Applications' }, { timeout: 15_000 })
    await user.click(screen.getByRole('button', { name: '+ New Application' }))
    const form = await dialog('New Application')
    await user.click(within(form).getByRole('button', { name: 'New candidate' }))
    await user.click(buttonIn(form, 'Add Application'))
    expect(await within(form).findByText('Choose the job opening')).toBeVisible()
    expect(within(form).getByText('Enter the first name')).toBeVisible()
    // Only open openings take applications.
    await user.click(within(form).getByRole('combobox', { name: 'Job Opening' }))
    expect(screen.queryByRole('option', { name: /Marketing Executive/ })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('option', { name: /QA Engineer/ }))
    await user.type(within(form).getByRole('textbox', { name: /^First Name/ }), 'Noor')
    await user.type(within(form).getByRole('textbox', { name: /^Last Name/ }), 'Fatima')
    await user.type(within(form).getByRole('textbox', { name: /^Email/ }), 'noor.fatima@example.pk')
    await user.click(buttonIn(form, 'Add Application'))

    const detail = await dialog(/Noor Fatima · QA Engineer/)
    expect(await screen.findByText('Application added')).toBeVisible()
    await user.click(within(detail).getByRole('tab', { name: 'Timeline' }))
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ tab: 'timeline', mode: 'list' })
    })
    expect(within(detail).getByRole('list', { name: 'Stage history' })).toHaveTextContent('Applied')
  })

  it('filters the list by stage and keeps it in the URL', async () => {
    const { user, router } = renderApp('/recruitment/applications?mode=list')
    const table = await screen.findByRole('table', { name: 'Applications' }, { timeout: 15_000 })
    await choose(user, 'Stage', 'Interview')
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ mode: 'list', stage: 'interview' })
    })
    expect(await screen.findByText('Showing 1 to 3 of 3 applications')).toBeVisible()
    expect(
      within(table).getByRole('button', { name: /Open Ahmed Raza's application/ }),
    ).toBeVisible()
  })

  it('scrolls the board inside its box at phone width', async () => {
    setViewportWidth(375)
    renderApp('/recruitment/applications')
    const board = await screen.findByRole('region', { name: 'Pipeline board' }, { timeout: 15_000 })
    expect(board).toHaveClass('overflow-x-auto')
    expect(await within(board).findByRole('list', { name: 'Applied applications' })).toBeVisible()
  })
})
