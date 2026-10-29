import { configure, screen, waitFor, within } from '@testing-library/react'
import { format } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@/mocks/node'
import { applications, offers, reasons } from '@/mocks/recruitment/db'
import { apiPath } from '@/mocks/utils'
import { renderApp } from '@/test/test-utils'

import { buttonIn, choose, dialog, rowAction } from './test-helpers'

configure({ asyncUtilTimeout: 4000 })

describe('Recruitment → Offers', { timeout: 60_000 }, () => {
  it('lists the offers with their status and filters by status chip', async () => {
    const { user, router } = renderApp('/recruitment/offers')
    const table = await screen.findByRole('table', { name: 'Offers' }, { timeout: 15_000 })
    expect(
      await within(table).findByRole('button', { name: 'Open the offer for Fatima Noor' }),
    ).toBeVisible()
    expect(screen.getByText('Showing 1 to 4 of 4 offers')).toBeVisible()
    await user.click(
      within(screen.getByRole('group', { name: 'Offer status' })).getByRole('button', {
        name: 'Accepted',
      }),
    )
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ status: 'accepted' })
    })
    expect(await screen.findByText('Showing 1 to 2 of 2 offers')).toBeVisible()
  })

  it('creates an offer (with checks), sends it and records the acceptance', async () => {
    const { user } = renderApp('/recruitment/offers')
    await user.click(
      await screen.findByRole('button', { name: '+ New Offer' }, { timeout: 15_000 }),
    )
    const form = await dialog('New Offer')
    await user.click(buttonIn(form, 'Save'))
    expect(await within(form).findByText('Choose the application')).toBeVisible()
    expect(within(form).getByText('Enter the offered salary')).toBeVisible()
    expect(within(form).getByText('Choose the joining date')).toBeVisible()

    await choose(user, /^Application/, /Hassan Ali/)
    await user.type(within(form).getByRole('textbox', { name: /^Offered Salary/ }), '380000')
    await user.click(within(form).getByRole('button', { name: /^Joining Date/ }))
    await user.click(
      await screen.findByRole('button', { name: new RegExp(format(new Date(), 'MMMM do, yyyy')) }),
    )
    await user.click(buttonIn(form, 'Save'))

    const detail = await dialog('Offer for Hassan Ali')
    expect(await screen.findByText('Offer created')).toBeVisible()
    const saved = offers.all().find((row) => row.applicationId === '505')
    expect(saved).toMatchObject({
      status: 'draft',
      offeredSalary: 380_000,
      departmentId: 'dep_software',
      branchId: 'br_lhr_jt',
    })

    await user.click(within(detail).getByRole('button', { name: 'Send' }))
    const send = await dialog('Send Offer')
    await user.click(buttonIn(send, 'Send'))
    expect(await screen.findByText('Offer sent to Hassan Ali')).toBeVisible()
    expect(offers.find(saved!.id)?.status).toBe('sent')
    // Sending moves the application on to Offer.
    expect(applications.find('505')?.stage).toBe('offer')

    await user.click(await within(detail).findByRole('button', { name: 'Record Response' }))
    const respond = await dialog('Record Response')
    expect(within(respond).getByRole('button', { name: 'Accepted' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.type(
      within(respond).getByRole('textbox', { name: 'Remarks' }),
      'Signed copy received',
    )
    await user.click(buttonIn(respond, 'Save Response'))
    expect(await screen.findByText('Offer accepted')).toBeVisible()
    expect(offers.find(saved!.id)).toMatchObject({
      status: 'accepted',
      responseRemarks: 'Signed copy received',
    })
    expect(await within(detail).findByRole('button', { name: 'Go to Hire' })).toBeVisible()
  })

  it('refuses a second open offer for the same application', async () => {
    const { user } = renderApp('/recruitment/offers')
    await user.click(
      await screen.findByRole('button', { name: '+ New Offer' }, { timeout: 15_000 }),
    )
    const form = await dialog('New Offer')
    // Fatima Noor already has a sent offer.
    await choose(user, /^Application/, /Fatima Noor/)
    await user.type(within(form).getByRole('textbox', { name: /^Offered Salary/ }), '450000')
    await user.click(within(form).getByRole('button', { name: /^Joining Date/ }))
    await user.click(
      await screen.findByRole('button', { name: new RegExp(format(new Date(), 'MMMM do, yyyy')) }),
    )
    await user.click(buttonIn(form, 'Save'))
    expect(
      await within(form).findByText(
        'This application already has an open offer. Withdraw it first.',
      ),
    ).toBeVisible()
  })
})

describe('Recruitment → Settings', { timeout: 60_000 }, () => {
  it('adds a rejection reason, refuses a duplicate and switches one off', async () => {
    const { user } = renderApp('/recruitment/settings')
    const table = await screen.findByRole(
      'table',
      { name: 'Rejection reasons' },
      { timeout: 15_000 },
    )
    expect(await within(table).findByText('Not enough experience')).toBeVisible()
    expect(within(table).getAllByText('Inactive')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: '+ New Reason' }))
    const form = await dialog('New Rejection Reason')
    await user.click(buttonIn(form, 'Save'))
    expect(await within(form).findByText('Enter the reason')).toBeVisible()
    await user.type(within(form).getByRole('textbox', { name: /^Reason/ }), 'position filled')
    await user.click(buttonIn(form, 'Save'))
    expect(await within(form).findByText('This reason is already on the list.')).toBeVisible()
    const name = within(form).getByRole('textbox', { name: /^Reason/ })
    await user.clear(name)
    await user.type(name, 'Failed the reference check')
    await user.click(buttonIn(form, 'Save'))
    expect(await screen.findByText('Rejection reason added')).toBeVisible()
    expect(await within(table).findByText('Failed the reference check')).toBeVisible()
    expect(reasons.all().find((row) => row.name === 'Failed the reference check')).toMatchObject({
      isActive: true,
      sortOrder: 7,
    })

    // A reason used by rejections cannot be deleted, only switched off.
    await user.click(screen.getByRole('button', { name: 'Actions for Not enough experience' }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument()
    await user.click(within(menu).getByRole('menuitem', { name: 'Switch Off' }))
    expect(await screen.findByText('Rejection reason updated')).toBeVisible()
    expect(reasons.find('1')?.isActive).toBe(false)

    await rowAction(user, 'Actions for Failed the reference check', 'Delete')
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete rejection reason' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Rejection reason deleted')).toBeVisible()
  })

  it('shows the error with Try again when the reasons cannot be read', async () => {
    server.use(
      http.get(apiPath('/recruitment/settings/rejection-reasons'), () =>
        HttpResponse.json({ message: 'You do not have permission to do that.' }, { status: 403 }),
      ),
    )
    renderApp('/recruitment/settings')
    const alert = await screen.findByRole('alert', {}, { timeout: 15_000 })
    expect(
      within(alert).getByText('You do not have permission to see rejection reasons.'),
    ).toBeVisible()
    expect(within(alert).getByRole('button', { name: /Try again/ })).toBeVisible()
  })
})
