import { configure, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@/mocks/node'
import { openings } from '@/mocks/recruitment/db'
import { apiPath } from '@/mocks/utils'
import { renderApp, setViewportWidth } from '@/test/test-utils'

import { buttonIn, choose, dialog, rowAction } from './test-helpers'

configure({ asyncUtilTimeout: 4000 })

describe('Recruitment → Job Openings', { timeout: 60_000 }, () => {
  it('lists the openings with their status, filters by status chip and search', async () => {
    const { user, router } = renderApp('/recruitment/openings')
    const table = await screen.findByRole('table', { name: 'Job openings' }, { timeout: 15_000 })
    expect(
      await within(table).findByRole('button', { name: 'Senior Software Engineer' }),
    ).toBeVisible()
    for (const header of ['Code', 'Opening', 'Status', 'Hired / Vacancies', 'Applications']) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeVisible()
    }
    expect(within(table).getByText('RC-0005')).toBeVisible()
    expect(screen.getByText('Showing 1 to 6 of 6 openings')).toBeVisible()

    const chips = screen.getByRole('group', { name: 'Opening status' })
    await user.click(within(chips).getByRole('button', { name: 'On Hold' }))
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ status: 'on_hold' })
    })
    expect(await within(table).findByRole('button', { name: 'Marketing Executive' })).toBeVisible()
    await waitFor(() => {
      expect(within(table).queryByRole('button', { name: 'QA Engineer' })).not.toBeInTheDocument()
    })
    expect(within(chips).getByRole('button', { name: 'On Hold' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(within(chips).getByRole('button', { name: 'All' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search openings' }), 'qa{Enter}')
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ q: 'qa' })
    })
    expect(await within(table).findByRole('button', { name: 'QA Engineer' })).toBeVisible()
    expect(await screen.findByText('Showing 1 to 1 of 1 openings')).toBeVisible()
  })

  it('creates an opening (with checks), opens it as a draft and publishes it', async () => {
    const { user, router } = renderApp('/recruitment/openings')
    await user.click(
      await screen.findByRole('button', { name: '+ New Opening' }, { timeout: 15_000 }),
    )
    const form = await dialog('New Opening')
    await user.clear(within(form).getByRole('textbox', { name: /^Vacancies/ }))
    await user.click(buttonIn(form, 'Save'))
    expect(await within(form).findByText('Enter the job title of the opening')).toBeVisible()
    expect(within(form).getByText('Enter how many people to hire')).toBeVisible()

    await user.type(within(form).getByRole('textbox', { name: /^Job Title/ }), 'Data Analyst')
    await user.type(within(form).getByRole('textbox', { name: /^Vacancies/ }), '2')
    await user.type(within(form).getByRole('textbox', { name: 'Experience from (years)' }), '5')
    await user.type(within(form).getByRole('textbox', { name: 'Experience to (years)' }), '2')
    await choose(user, 'Department', 'Software')
    await choose(user, 'Branch', 'Lahore Head Office')
    await user.click(buttonIn(form, 'Save'))
    expect(await within(form).findByText('Must be at least the minimum')).toBeVisible()
    await user.clear(within(form).getByRole('textbox', { name: 'Experience to (years)' }))
    await user.type(within(form).getByRole('textbox', { name: 'Experience to (years)' }), '7')
    await user.click(buttonIn(form, 'Save'))

    // Saved as a draft, and the new opening opens.
    const detail = await dialog('Data Analyst')
    expect(await screen.findByText('Opening created')).toBeVisible()
    expect(within(detail).getByText('Draft')).toBeVisible()
    expect(within(detail).getByText('RC-0007')).toBeVisible()
    expect(router.state.location.search).toEqual({ view: '7' })
    const saved = openings.find('7')
    expect(saved).toMatchObject({
      title: 'Data Analyst',
      vacancies: 2,
      status: 'draft',
      departmentId: 'dep_software',
      branchId: 'br_lhr_ho',
      experienceFromYears: 5,
      experienceToYears: 7,
    })

    await user.click(buttonIn(detail, 'Publish'))
    expect(await screen.findByText('Data Analyst published')).toBeVisible()
    await waitFor(() => {
      expect(within(detail).getByText('Open')).toBeVisible()
    })
    expect(openings.find('7')?.status).toBe('open')
    // An open opening offers Hold and Close, no longer Publish.
    expect(buttonIn(detail, 'Hold')).toBeVisible()
    expect(within(detail).queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument()
  })

  it('holds, closes (after a confirm) and reopens from the row menu', async () => {
    const { user } = renderApp('/recruitment/openings')
    await screen.findByRole('table', { name: 'Job openings' }, { timeout: 15_000 })
    await rowAction(user, 'Actions for RC-0002, QA Engineer', 'Hold')
    expect(await screen.findByText('QA Engineer put on hold')).toBeVisible()
    expect(openings.find('2')?.status).toBe('on_hold')

    await rowAction(user, 'Actions for RC-0002, QA Engineer', 'Close opening')
    const confirm = await screen.findByRole('alertdialog', { name: 'Close opening' })
    await user.click(within(confirm).getByRole('button', { name: 'Close opening' }))
    expect(await screen.findByText('QA Engineer closed')).toBeVisible()
    expect(openings.find('2')?.status).toBe('closed')

    await rowAction(user, 'Actions for RC-0002, QA Engineer', 'Reopen')
    expect(await screen.findByText('QA Engineer reopened')).toBeVisible()
    expect(openings.find('2')?.status).toBe('open')
  })

  it('shows a stale edit as an error and keeps the dialog open', async () => {
    const { user } = renderApp('/recruitment/openings?edit=%221%22')
    await screen.findByDisplayValue('Senior Software Engineer', {}, { timeout: 15_000 })
    const form = await dialog('Edit Opening')
    // Someone else saves in between.
    const current = openings.find('1')
    if (current) openings.update('1', { ...current, rowVersion: 'changed-elsewhere' })
    await user.click(buttonIn(form, 'Save'))
    expect(
      await within(form).findByText('Someone else changed this opening. Reload it and try again'),
    ).toBeVisible()
  })

  it('shows the API error with Try again when the list fails', async () => {
    server.use(
      http.get(apiPath('/recruitment/openings'), () =>
        HttpResponse.json({ message: 'The server is down for maintenance.' }, { status: 500 }),
      ),
    )
    renderApp('/recruitment/openings')
    const alert = await screen.findByRole('alert', {}, { timeout: 15_000 })
    expect(within(alert).getByText('The server is down for maintenance.')).toBeVisible()
    expect(within(alert).getByRole('button', { name: /Try again/ })).toBeVisible()
  })

  it('stacks the list into cards at phone width', async () => {
    setViewportWidth(375)
    renderApp('/recruitment/openings')
    const list = await screen.findByRole('list', { name: 'Job openings' }, { timeout: 15_000 })
    expect(within(list).getAllByRole('listitem')).toHaveLength(6)
    expect(screen.queryByRole('table', { name: 'Job openings' })).not.toBeInTheDocument()
    expect(
      within(list).getByRole('button', { name: 'Actions for RC-0001, Senior Software Engineer' }),
    ).toBeVisible()
  })
})
