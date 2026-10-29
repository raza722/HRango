import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { extensions, reminders, tasks } from '@/mocks/project-management/db'
import { renderApp } from '@/test/test-utils'

const PAGE = '/project-management/workspaces/ws_qa'
const FIRST_LOAD = { timeout: 15_000 }
const day = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd')

configure({ asyncUtilTimeout: 4000 })

/** The Overdue tab's sections. */
const section = (name: RegExp) => screen.findByRole('region', { name })
const rowOf = (table: HTMLElement, task: string) => {
  const row = within(table)
    .getByRole('button', { name: new RegExp(`^${task}`) })
    .closest('tr')
  if (!row) throw new Error(`No row for ${task}`)
  return row
}

async function openOverdue(user: UserEvent) {
  const views = await screen.findByRole('navigation', { name: 'Views' }, FIRST_LOAD)
  const tab = await within(views).findByRole('button', { name: /^Overdue \(2\)$/ }, FIRST_LOAD)
  await user.click(tab)
  expect(tab).toHaveAttribute('aria-current', 'page')
}

describe('Overdue tab', { timeout: 60_000 }, () => {
  it('lists the overdue tasks and those closed late, with both dates', async () => {
    const { user, router } = renderApp(PAGE)
    // The List view flags them: the overdue due date is said, the late one carries a chip.
    expect(
      await screen.findAllByRole('button', { name: /^Due Date: .*, overdue$/ }, FIRST_LOAD),
    ).toHaveLength(2)
    expect((await screen.findAllByText('Closed late')).length).toBeGreaterThan(0)

    await openOverdue(user)
    expect(router.state.location.search).toMatchObject({ overdue: true })
    const open = await section(/^Overdue \(2\)/)
    const openTable = within(open).getByRole('table', { name: 'Overdue tasks' })
    expect(rowOf(openTable, 'Accessibility audit')).toHaveTextContent('3 days')
    expect(rowOf(openTable, 'Write the onboarding copy')).toHaveTextContent('1 day')

    const closed = await section(/^Closed late \(1\)/)
    const closedRow = rowOf(
      within(closed).getByRole('table', { name: 'Tasks closed late' }),
      'Icon set for the side menu',
    )
    expect(closedRow).toHaveTextContent(/Closed .*, 2 days late/)

    // A task's name opens it in the List view.
    await user.click(within(openTable).getByRole('button', { name: /^Accessibility audit/ }))
    await waitFor(() => {
      expect(router.state.location.hash).toBe('tk_audit')
    })
    expect(router.state.location.search).not.toHaveProperty('overdue')
  })

  it('lets an assignee ask for more time, once', async () => {
    const { user } = renderApp(PAGE)
    await openOverdue(user)
    const open = await section(/^Overdue/)
    await user.click(
      await within(open).findByRole('button', {
        name: 'Request an extension of Accessibility audit of the old portal',
      }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Request Extension' })
    await user.click(within(dialog).getByRole('button', { name: 'Send Request' }))
    expect(within(dialog).getByText('Choose the new due date')).toBeVisible()
    expect(within(dialog).getByText('Give the reason')).toBeVisible()

    fireEvent.change(within(dialog).getByLabelText('New Due Date'), {
      target: { value: day(4) },
    })
    await user.type(
      within(dialog).getByLabelText('Reason'),
      'Waiting on the screen reader licence.',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Send Request' }))

    expect(await screen.findByText('Extension requested')).toBeInTheDocument()
    await waitFor(() => {
      expect(extensions.all().find((entry) => entry.taskId === 'tk_audit')?.status).toBe('pending')
    })
    const row = rowOf(within(open).getByRole('table'), 'Accessibility audit')
    expect(await within(row).findByText(/^Asked for /)).toBeVisible()
    // Her own request: she cannot answer it, nor ask again while it waits.
    expect(within(row).queryByRole('button', { name: /^Approve/ })).not.toBeInTheDocument()
    expect(
      within(row).queryByRole('button', { name: /^Request an extension/ }),
    ).not.toBeInTheDocument()
  })

  it('approves a waiting request: the due date moves and the task is no longer overdue', async () => {
    const { user } = renderApp(PAGE)
    await openOverdue(user)
    const open = await section(/^Overdue/)
    await user.click(
      await within(open).findByRole('button', {
        name: 'Approve the extension of Write the onboarding copy',
      }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Approve Extension' })
    expect(within(dialog).getByText(/The product names are still being decided/)).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))

    await waitFor(() => {
      expect(tasks.find('tk_copy')).toMatchObject({ dueDate: day(2), originalDueDate: day(-1) })
    })
    expect(extensions.find('ext_copy')?.status).toBe('approved')
    expect(await section(/^Overdue \(1\)/)).toBeVisible()
  })

  it('needs a reason to reject', async () => {
    const { user } = renderApp(PAGE)
    await openOverdue(user)
    const open = await section(/^Overdue/)
    await user.click(
      await within(open).findByRole('button', {
        name: 'Reject the extension of Write the onboarding copy',
      }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Reject Extension' })
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
    expect(within(dialog).getByText('Give the reason for rejecting')).toBeVisible()
    await user.type(
      within(dialog).getByLabelText('Reason for Rejecting'),
      'The launch date is fixed.',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }))

    await waitFor(() => {
      expect(extensions.find('ext_copy')).toMatchObject({
        status: 'rejected',
        remarks: 'The launch date is fixed.',
      })
    })
    expect(tasks.find('tk_copy')?.dueDate).toBe(day(-1))
  })

  it('offers Request Extension in the row menu to the task’s assignees only', async () => {
    const { user } = renderApp(PAGE)
    await user.click(
      await screen.findByRole(
        'button',
        { name: 'Actions for Accessibility audit of the old portal' },
        FIRST_LOAD,
      ),
    )
    expect(
      within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Request Extension' }),
    ).toBeVisible()
    await user.keyboard('{Escape}')

    // Areeba Hameed's task: not Shelley's to extend.
    await user.click(screen.getByRole('button', { name: 'Actions for Write the onboarding copy' }))
    expect(
      within(await screen.findByRole('menu')).queryByRole('menuitem', {
        name: 'Request Extension',
      }),
    ).not.toBeInTheDocument()
  })
})

describe('Reminders page', { timeout: 60_000 }, () => {
  it('lists the coming reminders, the sent ones on request, and deletes one', async () => {
    const { user } = renderApp('/project-management/reminders')

    expect(await screen.findByRole('heading', { name: 'Reminders' }, FIRST_LOAD)).toBeVisible()
    const audit = await screen.findByRole('link', { name: 'Accessibility audit of the old portal' })
    expect(audit).toHaveAttribute('href', '/project-management/workspaces/ws_qa#tk_audit')
    expect(screen.getByText('Upcoming')).toBeVisible()
    expect(
      screen.queryByRole('link', { name: 'User Qualitative Research' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Show sent and past reminders' }))
    expect(await screen.findByRole('link', { name: 'User Qualitative Research' })).toBeVisible()
    expect(screen.getByText('Sent')).toBeVisible()

    await user.click(
      screen.getByRole('button', {
        name: 'Delete the reminder about Accessibility audit of the old portal',
      }),
    )
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    )
    await waitFor(() => {
      expect(reminders.find('rm_audit')).toBeUndefined()
    })
    expect(
      screen.queryByRole('link', { name: 'Accessibility audit of the old portal' }),
    ).not.toBeInTheDocument()
  })

  it('moves a reminder with the Remind Me calendar', async () => {
    const { user } = renderApp('/project-management/reminders')
    await user.click(
      await screen.findByRole(
        'button',
        { name: 'Change the time of the reminder about Accessibility audit of the old portal' },
        FIRST_LOAD,
      ),
    )
    const popup = await screen.findByRole('dialog', {
      name: 'Remind me about Accessibility audit of the old portal',
    })
    await user.click(within(popup).getByRole('button', { name: /^Next Week(?!end)/ }))
    await user.click(within(popup).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Reminder moved')).toBeInTheDocument()
    const before = new Date()
    await waitFor(() => {
      const at = new Date(`${reminders.find('rm_audit')?.remindAt ?? ''}Z`)
      expect(at.getTime() - before.getTime()).toBeGreaterThan(2 * 24 * 60 * 60_000)
    })
  })
})
