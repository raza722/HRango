import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { currentStep } from '@/mocks/requests/flow'
import { standardRequests } from '@/mocks/requests/standard'
import { renderApp } from '@/test/test-utils'

async function menuOf(user: UserEvent, code: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${code}` }))
  return (await screen.findAllByRole('menuitem')).map((item) => item.textContent)
}

async function openAction(user: UserEvent, code: string, action: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${code}` }))
  await user.click(await screen.findByRole('menuitem', { name: action }))
}

const payloadOf = (id: string) =>
  standardRequests.find(id)?.payload as { appliedMinutes: number; reason: string } | undefined

/** The text of a Blob in jsdom (which has no `Blob.text`). */
const textOf = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.readAsText(blob)
  })

/** jsdom has no object URLs: records the Blob a download makes. */
function catchDownloads() {
  const saved: { blob: Blob; name: string }[] = []
  let last: Blob | undefined
  Object.assign(URL, {
    createObjectURL: (blob: Blob) => {
      last = blob
      return 'blob:overtime'
    },
    revokeObjectURL: () => undefined,
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (last) saved.push({ blob: last, name: this.download })
  })
  return saved
}

describe('Attendance Overtime: changing a request after filing', () => {
  afterEach(() => {
    Reflect.deleteProperty(URL, 'createObjectURL')
    Reflect.deleteProperty(URL, 'revokeObjectURL')
  })

  it('edits a pending request and deletes one; approved requests offer neither', async () => {
    const { user } = renderApp('/attendance/overtime')
    expect(await screen.findByRole('heading', { name: 'My Overtime' })).toBeVisible()

    const approved = await menuOf(user, 'OT-0001')
    expect(approved).not.toContain('Edit')
    expect(approved).not.toContain('Delete')
    await user.keyboard('{Escape}')

    await openAction(user, 'OT-0002', 'Edit')
    const dialog = await screen.findByRole('dialog', { name: 'Edit Overtime Request' })
    const hours = within(dialog).getByRole('textbox', { name: /^Overtime Hours/ })
    expect(hours).toHaveValue('3')
    await user.clear(hours)
    await user.type(hours, '5')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(
      await within(dialog).findByText('At most 3h 00m, the time between the two clocks'),
    ).toBeVisible()
    await user.clear(hours)
    await user.type(hours, '2.5')
    const reason = within(dialog).getByRole('textbox', { name: /^Reason for Overtime/ })
    await user.clear(reason)
    await user.type(reason, 'Release checks')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Overtime request updated')).toBeInTheDocument()
    await waitFor(() => {
      expect(payloadOf('ot_0002')).toMatchObject({ appliedMinutes: 150, reason: 'Release checks' })
    })

    await openAction(user, 'OT-0002', 'Delete')
    const remove = await screen.findByRole('dialog', { name: 'Delete Overtime Request' })
    await user.click(await within(remove).findByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Overtime request deleted')).toBeInTheDocument()
    await waitFor(() => {
      expect(standardRequests.find('ot_0002')).toBeUndefined()
    })
    expect(screen.queryByRole('cell', { name: 'Release checks' })).not.toBeInTheDocument()
  })

  it('refuses an edit once an approver has acted', async () => {
    const record = standardRequests.find('ot_0002')
    if (!record) throw new Error('No OT-0002')
    // The first step was decided (as if by a line manager): the request is no longer untouched.
    standardRequests.update('ot_0002', {
      ...record,
      flow: record.flow.map((step, index) =>
        index === 0 ? { ...step, status: 'approved', actedById: 'em_bilal' } : step,
      ),
    })
    const { user } = renderApp('/attendance/overtime')
    await openAction(user, 'OT-0002', 'Edit')
    const dialog = await screen.findByRole('dialog', { name: 'Edit Overtime Request' })
    expect(
      await within(dialog).findByText(
        'An approver has already acted on this request, so it can no longer be edited.',
      ),
    ).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('adds images to a filed request from View, and takes one off while it is pending', async () => {
    const { user } = renderApp('/attendance/overtime')
    await openAction(user, 'OT-0002', 'View')
    const dialog = await screen.findByRole('dialog', { name: 'Overtime Request' })
    expect(await within(dialog).findByText('No images yet.')).toBeVisible()

    await user.upload(
      within(dialog).getByLabelText('Add Images'),
      new File(['png'], 'gate-log.png', { type: 'image/png' }),
    )
    expect(await within(dialog).findByRole('link', { name: 'gate-log.png' })).toBeVisible()
    expect(standardRequests.find('ot_0002')?.files).toHaveLength(1)

    await user.click(within(dialog).getByRole('button', { name: 'Remove gate-log.png' }))
    expect(await within(dialog).findByText('No images yet.')).toBeVisible()
    expect(standardRequests.find('ot_0002')?.files).toHaveLength(0)
  })

  it('lets an approved request take more images but not lose them', async () => {
    const { user } = renderApp('/attendance/overtime')
    await openAction(user, 'OT-0001', 'View')
    const dialog = await screen.findByRole('dialog', { name: 'Overtime Request' })
    expect(await within(dialog).findByLabelText('Add Images')).toBeInTheDocument()
    await user.upload(
      within(dialog).getByLabelText('Add Images'),
      new File(['png'], 'sign-off.png', { type: 'image/png' }),
    )
    expect(await within(dialog).findByRole('link', { name: 'sign-off.png' })).toBeVisible()
    expect(
      within(dialog).queryByRole('button', { name: 'Remove sign-off.png' }),
    ).not.toBeInTheDocument()
  })

  it('exports My Overtime with its filters as CSV', async () => {
    const saved = catchDownloads()
    const { user } = renderApp('/attendance/overtime?status=pending')
    expect(await screen.findByRole('cell', { name: 'Pending' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Export' }))

    await waitFor(() => {
      expect(saved).toHaveLength(1)
    })
    const [file] = saved
    if (!file) throw new Error('Nothing was saved')
    expect(file.name).toMatch(/^overtime-my-\d{4}-\d{2}-\d{2}\.csv$/)
    const lines = (await textOf(file.blob)).trim().split('\n')
    expect(lines[0]).toContain('Code,Employee Code,Employee')
    expect(lines[0]).toContain('Applied Minutes,Approved Minutes')
    // Pending only, and only yours: OT-0002.
    expect(lines.slice(1).map((line) => line.split(',')[0])).toEqual(['OT-0002'])
  })
})

describe('Attendance Overtime: Applications', () => {
  it('forwards a request waiting for you to another employee', async () => {
    const { user } = renderApp('/attendance/overtime?tab=applications')
    expect(await screen.findByRole('heading', { name: 'Overtime Applications' })).toBeVisible()
    await openAction(user, 'OT-0005', 'Forward')
    const dialog = await screen.findByRole('dialog', { name: 'Forward Overtime' })
    await user.click(await within(dialog).findByRole('button', { name: 'Forward' }))
    expect(await within(dialog).findByText('Choose whom to forward it to')).toBeVisible()

    await user.click(within(dialog).getByRole('combobox', { name: /^Forward To/ }))
    await user.click(await screen.findByRole('option', { name: /^Bilal Ahmed/ }))
    await user.type(within(dialog).getByRole('textbox', { name: /^Remarks/ }), 'Your team.')
    await user.click(within(dialog).getByRole('button', { name: 'Forward' }))

    expect(await screen.findByText(/^Forwarded to /)).toBeInTheDocument()
    await waitFor(() => {
      const record = standardRequests.find('ot_0005')
      expect(record && currentStep(record)?.approverId).toBe('em_bilal')
    })
  })

  it('asks for your consent in the Consents box; disagreeing needs remarks', async () => {
    const record = standardRequests.find('ot_0004')
    if (!record) throw new Error('No OT-0004')
    standardRequests.update('ot_0004', {
      ...record,
      consents: [{ personId: 'em_shelley', status: 'pending', remarks: null }],
    })
    const { user } = renderApp('/attendance/overtime?tab=applications&box=consents')
    const menu = await menuOf(user, 'OT-0004')
    expect(menu).toContain('Consent')
    expect(menu).not.toContain('Approve/Reject')
    expect(menu).not.toContain('Forward')
    await user.click(screen.getByRole('menuitem', { name: 'Consent' }))

    const dialog = await screen.findByRole('dialog', { name: 'Overtime Consent' })
    const disagree = await within(dialog).findByRole('button', { name: 'Disagree' })
    await waitFor(() => {
      expect(disagree).toBeEnabled()
    })
    await user.click(disagree)
    expect(await within(dialog).findByText('Give the reason for disagreeing')).toBeVisible()
    await user.type(within(dialog).getByRole('textbox', { name: /^Remarks/ }), 'Not planned.')
    await user.click(disagree)

    expect(await screen.findByText(/Your disagreement with .+ is recorded/)).toBeInTheDocument()
    await waitFor(() => {
      expect(standardRequests.find('ot_0004')?.consents[0]).toMatchObject({
        status: 'declined',
        remarks: 'Not planned.',
      })
    })
    // The flow goes on: the request still waits for its approvers.
    expect(standardRequests.find('ot_0004')?.status).toBe('pending')
  })

  it('rejects the ticked requests at once, with one reason', async () => {
    const { user } = renderApp('/attendance/overtime?tab=applications')
    await user.click(await screen.findByRole('checkbox', { name: 'Select OT-0005' }))
    expect(screen.getByRole('button', { name: 'Reject Selected (1)' })).toBeVisible()
    await user.click(screen.getByRole('checkbox', { name: 'Select OT-0006' }))
    await user.click(screen.getByRole('button', { name: 'Reject Selected (2)' }))

    const dialog = await screen.findByRole('dialog', { name: 'Reject Overtime' })
    expect(within(dialog).getByText(/^OT-0005, /)).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Reject 2' }))
    expect(await within(dialog).findByText('Give the reason for rejecting')).toBeVisible()
    await user.type(
      within(dialog).getByRole('textbox', { name: /^Reason for Rejection/ }),
      'Not budgeted this month.',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Reject 2' }))

    expect(await screen.findByText('Rejected 2 requests')).toBeInTheDocument()
    await waitFor(() => {
      expect(standardRequests.find('ot_0005')?.status).toBe('rejected')
    })
    expect(standardRequests.find('ot_0006')?.status).toBe('rejected')
  })
})
