import { configure, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { applicants } from '@/mocks/recruitment/db'
import { renderApp, setViewportWidth } from '@/test/test-utils'

import { buttonIn, choose, dialog, rowAction } from './test-helpers'

configure({ asyncUtilTimeout: 4000 })

describe('Recruitment → Candidates', { timeout: 60_000 }, () => {
  it('lists the candidates and filters them by source and search', async () => {
    const { user, router } = renderApp('/recruitment/candidates')
    const table = await screen.findByRole('table', { name: 'Candidates' }, { timeout: 15_000 })
    expect(await within(table).findByRole('button', { name: 'Open Usama Khalid' })).toBeVisible()
    for (const header of ['Candidate', 'Phone', 'Current Role', 'City', 'Source', 'Applications']) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeVisible()
    }
    expect(screen.getByText('Showing 1 to 10 of 14 candidates')).toBeVisible()

    await choose(user, 'Source', 'Referral')
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ source: 'referral' })
    })
    expect(await within(table).findByRole('button', { name: 'Open Fatima Noor' })).toBeVisible()
    expect(await screen.findByText('Showing 1 to 2 of 2 candidates')).toBeVisible()

    await user.click(screen.getByRole('button', { name: /Clear filters/ }))
    await user.type(screen.getByRole('searchbox', { name: 'Search candidates' }), 'designer{Enter}')
    expect(await within(table).findByRole('button', { name: 'Open Usama Khalid' })).toBeVisible()
    expect(await screen.findByText('Showing 1 to 1 of 1 candidate')).toBeVisible()
  })

  it('adds a candidate with a CV: checks the fields and a taken email', async () => {
    const { user } = renderApp('/recruitment/candidates')
    await user.click(
      await screen.findByRole('button', { name: '+ Add Candidate' }, { timeout: 15_000 }),
    )
    const form = await dialog('Add Candidate')
    await user.click(buttonIn(form, 'Save'))
    expect(await within(form).findByText('Enter the first name')).toBeVisible()
    expect(within(form).getByText('Enter the email address')).toBeVisible()

    await user.type(within(form).getByRole('textbox', { name: /^First Name/ }), 'Rida')
    await user.type(within(form).getByRole('textbox', { name: /^Last Name/ }), 'Kamal')
    // Someone already has this email.
    await user.type(within(form).getByRole('textbox', { name: /^Email/ }), 'ahmed.raza@example.pk')
    await choose(user, 'Source', 'Referral')
    await user.click(buttonIn(form, 'Save'))
    expect(await within(form).findByText('Choose who referred them')).toBeVisible()
    await choose(user, /^Referred By/, /Haroon Jalani/)

    const file = new File(['%PDF-1.4 cv'], 'Rida Kamal CV.pdf', { type: 'application/pdf' })
    const input = form.querySelector<HTMLInputElement>('input[type="file"]')
    if (!input) throw new Error('No file input')
    await user.upload(input, file)
    expect(await within(form).findByRole('link', { name: 'Rida Kamal CV.pdf' })).toBeVisible()

    await user.click(buttonIn(form, 'Save'))
    expect(
      await within(form).findByText('A candidate with this email already exists.'),
    ).toBeVisible()

    const email = within(form).getByRole('textbox', { name: /^Email/ })
    await user.clear(email)
    await user.type(email, 'rida.kamal@example.pk')
    await user.click(buttonIn(form, 'Save'))

    const detail = await dialog('Rida Kamal')
    expect(await screen.findByText('Candidate added')).toBeVisible()
    expect(within(detail).getByRole('link', { name: 'Rida Kamal CV.pdf' })).toBeVisible()
    expect(within(detail).getByText('Referral (by Haroon Jalani)')).toBeVisible()
    const saved = applicants.all().find((row) => row.email === 'rida.kamal@example.pk')
    expect(saved).toMatchObject({
      firstName: 'Rida',
      source: 'referral',
      referredByEmployeeId: 'em_haroon',
    })
    expect(saved?.cvFileId).toMatch(/^file_/)
  })

  it('opens a candidate with their applications', async () => {
    const { user } = renderApp('/recruitment/candidates?view=%22101%22')
    const detail = await dialog('Ahmed Raza')
    const list = await within(detail).findByRole(
      'table',
      { name: "The candidate's applications" },
      { timeout: 15_000 },
    )
    expect(within(list).getByRole('link', { name: 'Senior Software Engineer' })).toBeVisible()
    expect(within(list).getByRole('link', { name: 'UI/UX Designer' })).toBeVisible()
    // Candidates with applications cannot be deleted.
    expect(within(detail).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(buttonIn(detail, 'New Application')).toBeVisible()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Ahmed Raza' })).not.toBeInTheDocument()
    })
  })

  it('deletes a candidate without applications from the row menu', async () => {
    applicants.insert({
      ...applicants.find('103')!,
      id: '199',
      firstName: 'Temp',
      lastName: 'Person',
      email: 'temp.person@example.pk',
      createdAt: new Date().toISOString(),
    })
    const { user } = renderApp('/recruitment/candidates')
    await screen.findByRole('table', { name: 'Candidates' }, { timeout: 15_000 })
    await rowAction(user, 'Actions for Temp Person', 'Delete')
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete candidate' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Candidate deleted')).toBeVisible()
    expect(applicants.find('199')).toBeUndefined()
  })

  it('stacks the candidates into cards at phone width', async () => {
    setViewportWidth(375)
    renderApp('/recruitment/candidates')
    const list = await screen.findByRole('list', { name: 'Candidates' }, { timeout: 15_000 })
    expect(within(list).getAllByRole('listitem')).toHaveLength(10)
    expect(screen.queryByRole('table', { name: 'Candidates' })).not.toBeInTheDocument()
  })
})
