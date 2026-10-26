import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, differenceInCalendarMonths, format } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@/mocks/node'
import { standardRequests } from '@/mocks/requests/standard'
import { apiPath } from '@/mocks/utils'
import { renderApp } from '@/test/test-utils'

/**
 * `POST /files` for these tests: the shared files mock cannot read jsdom's
 * multipart bodies, so the upload is answered here, named from the body.
 */
function acceptUploads() {
  server.use(
    http.post(apiPath('/files'), async ({ request }) => {
      const body = await request.text()
      const name = /filename="([^"]+)"/.exec(body)?.[1] ?? 'upload.pdf'
      const id = `file_${name.replace(/\W/g, '_')}`
      return HttpResponse.json(
        {
          data: {
            id,
            name,
            extension: 'pdf',
            mimeType: 'application/pdf',
            sizeBytes: 8,
            module: 'requests',
            url: apiPath(`/files/${id}/download?token=mock`),
            createdAt: new Date().toISOString(),
          },
        },
        { status: 201 },
      )
    }),
  )
}

/** Opens a date field's calendar (on today's month) and picks the day. */
async function pickDate(user: UserEvent, label: RegExp, date: Date) {
  await user.click(screen.getByRole('button', { name: label }))
  const months = differenceInCalendarMonths(date, new Date())
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

describe('Official Visits (the shared standard request pages)', () => {
  it('lists my visits and everyone’s, and files one with its attachment', async () => {
    acceptUploads()
    const { user } = renderApp('/requests/official-visits')

    expect(await screen.findByRole('heading', { name: 'Official Visit Requests' })).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'OV-0003' })).toBeVisible()
    expect(screen.queryByRole('cell', { name: 'OV-0001' })).not.toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Job fair at the university.' })).toBeVisible()

    await user.click(screen.getByRole('tab', { name: 'All Requests' }))
    expect(await screen.findByRole('cell', { name: 'OV-0001' })).toBeVisible()

    await user.click(screen.getByRole('tab', { name: 'My Requests' }))
    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create Official Visit Request' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose the date')).toBeVisible()
    expect(within(dialog).getByText('Give the reason')).toBeVisible()

    // A visit needs no shift: any day will do.
    const date = addDays(new Date(), 12)
    await pickDate(user, /^Date/, date)
    fireEvent.change(within(dialog).getByLabelText(/^Start Time/), { target: { value: '10:00' } })
    fireEvent.change(within(dialog).getByLabelText(/^End Time/), { target: { value: '12:30' } })
    await user.type(
      within(dialog).getByRole('textbox', { name: /^Purpose of Visit/ }),
      'Vendor audit.',
    )
    await user.type(within(dialog).getByRole('textbox', { name: /^Description/ }), 'Site walk.')
    const picker = dialog.querySelector<HTMLInputElement>('input[type="file"]')
    if (!picker) throw new Error('No file input')
    await user.upload(picker, new File(['%PDF-1.4'], 'visit.pdf', { type: 'application/pdf' }))
    expect(await within(dialog).findByRole('link', { name: 'visit.pdf' })).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect((await screen.findAllByText('Request submitted')).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(
        standardRequests
          .all()
          .find(
            (record) =>
              record.kind === 'official-visits' &&
              record.employeeId === 'em_shelley' &&
              record.payload.date === format(date, 'yyyy-MM-dd'),
          ),
      ).toMatchObject({
        status: 'pending',
        payload: {
          startTime: '10:00',
          endTime: '12:30',
          reason: 'Vendor audit.',
          description: 'Site walk.',
        },
      })
    })
    const made = standardRequests
      .all()
      .find(
        (record) => record.kind === 'official-visits' && record.payload.reason === 'Vendor audit.',
      )
    expect(made?.files?.[0]?.fileId).toMatch(/^file_/)
  }, 30_000)

  it('approves a visit without remarks and shows its time window', async () => {
    const { user } = renderApp('/requests/official-visits?tab=approvals')

    expect(await screen.findByRole('heading', { name: 'Official Visit Approvals' })).toBeVisible()
    expect(await screen.findByRole('button', { name: /^Pending \(\d+\)$/ })).toBeVisible()
    await openAction(user, 'OV-0001', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'Official Visit Approve/Reject' })
    expect(
      await within(dialog).findByText('Client site visit for the audit kick-off.'),
    ).toBeVisible()
    expect(within(dialog).getByText('3h')).toBeVisible()

    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
    )
    expect((await screen.findAllByText('Request approved')).length).toBeGreaterThan(0)
    await waitFor(() => {
      const record = standardRequests.find('ov_0001')
      expect(
        record?.flow.some((step) => step.status === 'approved' && step.actedById === 'em_shelley'),
      ).toBe(true)
    })
  }, 30_000)
})
