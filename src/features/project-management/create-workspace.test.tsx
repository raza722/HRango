import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { workspaces } from '@/mocks/project-management/db'
import { renderApp } from '@/test/test-utils'

const wizard = () => screen.getByRole('dialog', { name: 'Create Workspace' })

async function openWizard() {
  const utils = renderApp('/project-management/workspaces?create=true')
  const dialog = await screen.findByRole('dialog', { name: 'Create Workspace' })
  await within(dialog).findByRole('textbox', { name: 'Workspace Name' })
  return { ...utils, dialog }
}

async function chooseOwner(user: UserEvent, name: RegExp) {
  await user.click(within(wizard()).getByRole('button', { name: /^Workspace Owner/ }))
  const picker = await screen.findByRole('dialog', { name: 'Add Workspace Owner' })
  await user.click(within(picker).getByRole('radio', { name }))
  await user.click(within(picker).getByRole('button', { name: 'Add Member' }))
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Add Workspace Owner' })).not.toBeInTheDocument()
  })
}

async function chooseVisibility(
  user: UserEvent,
  option: 'Make Private' | 'Public' | 'Only Workspace',
) {
  await user.click(within(wizard()).getByRole('button', { name: /^Share Visibility/ }))
  await user.click(await screen.findByRole('radio', { name: new RegExp(`^${option}`) }))
}

/** Step 1 with a public workspace, then step 2 with Software and a workflow; ends on step 3. */
async function toCustomize(
  user: UserEvent,
  {
    name = 'Design Ops Hub',
    template = /^Work Starter/,
    visibility = 'Public',
  }: { name?: string; template?: RegExp; visibility?: 'Public' | 'Only Workspace' } = {},
) {
  await user.type(within(wizard()).getByRole('textbox', { name: 'Workspace Name' }), name)
  await chooseOwner(user, /^Bilal Ahmed/)
  await chooseVisibility(user, visibility)
  await user.click(within(wizard()).getByRole('button', { name: 'Continue' }))

  await within(wizard()).findByRole('heading', { name: /^Select Your Department/ })
  await user.click(within(wizard()).getByRole('button', { name: /^Select Your Department/ }))
  await user.click(await screen.findByRole('option', { name: 'Software' }))
  await user.click(within(wizard()).getByRole('radio', { name: template }))
  await user.click(within(wizard()).getByRole('button', { name: 'Continue' }))
  await within(wizard()).findByRole('heading', { name: /^Customize Default for/ })
}

const summary = (title: string) => within(wizard()).getByRole('region', { name: title })

// Each test walks the whole wizard against the mock API, so they get more than the default 15s.
describe('Create Workspace wizard', { timeout: 60_000 }, () => {
  it('goes through the three steps and creates the workspace', async () => {
    const { user, dialog, router } = await openWizard()

    expect(within(dialog).getByRole('list', { name: 'Progress' })).toBeVisible()
    const progress = within(dialog).getByRole('list', { name: 'Progress' })
    expect(within(progress).getByText('Add Workspace Details').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    )
    const continueButton = within(dialog).getByRole('button', { name: 'Continue' })
    expect(continueButton).toBeDisabled()

    const name = within(dialog).getByRole('textbox', { name: 'Workspace Name' })
    expect(name).toHaveFocus()
    await user.type(name, 'Design Ops Hub')
    expect(within(dialog).getByText('14/50 characters')).toBeVisible()
    await chooseOwner(user, /^Bilal Ahmed/)
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Description (Optional)' }),
      'Design operations',
    )
    expect(within(dialog).getByText('17/300 characters')).toBeVisible()
    expect(continueButton).toBeDisabled()

    // Make Private needs members before Continue.
    await chooseVisibility(user, 'Make Private')
    expect(screen.getByText('Share only with members')).toBeVisible()
    expect(continueButton).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Add members' }))
    const members = await screen.findByRole('dialog', { name: 'Add Members' })
    await user.click(within(members).getByRole('checkbox', { name: /^Maryam Javed/ }))
    await user.click(within(members).getByRole('checkbox', { name: /^Haroon Jalani/ }))
    await user.click(within(members).getByRole('button', { name: 'Add Member' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Add Members' })).not.toBeInTheDocument()
    })
    await user.keyboard('{Escape}')
    expect(
      within(dialog).getByRole('button', { name: /^Share Visibility Make Private, 2 members/ }),
    ).toBeVisible()
    expect(continueButton).toBeEnabled()
    await user.click(continueButton)

    // Step 2.
    expect(
      await within(dialog).findByRole('heading', { name: /^Select Your Department/ }),
    ).toHaveFocus()
    expect(within(progress).getByText(/Add Workspace Details/)).toHaveTextContent('(completed)')
    const step2Continue = within(dialog).getByRole('button', { name: 'Continue' })
    expect(step2Continue).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: /^Select Your Department/ }))
    const search = await screen.findByRole('searchbox', { name: 'Search department' })
    await user.type(search, 'soft')
    expect(screen.queryByRole('option', { name: 'Marketing' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'Software' }))
    expect(
      within(dialog).getByRole('button', { name: /^Select Your Department/ }),
    ).toHaveTextContent('Software')
    expect(step2Continue).toBeDisabled()
    const card = within(dialog).getByRole('radio', { name: /^Marketing Team/ })
    await user.click(card)
    expect(card).toHaveAttribute('aria-checked', 'true')
    expect(step2Continue).toBeEnabled()

    // Back keeps step 1's answers.
    await user.click(within(dialog).getByRole('button', { name: 'Back' }))
    expect(within(dialog).getByRole('textbox', { name: 'Workspace Name' })).toHaveValue(
      'Design Ops Hub',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }))

    // Step 3: the template's views, statuses and organizer.
    expect(
      await within(dialog).findByRole('heading', { name: 'Customize Default for Marketing Team' }),
    ).toBeVisible()
    expect(within(summary('Default Views')).getByText('List, Board, Team, Calendar')).toBeVisible()
    expect(
      within(summary('Task Statuses')).getByText(
        'Backlog, Planning, In-Progress, Ready for Review, Update Required, On Hold, Completed',
      ),
    ).toBeInTheDocument()
    expect(within(summary('Organizer')).getByText(/^Tags, Time Estimate, Priority/)).toBeVisible()

    await user.click(within(dialog).getByRole('button', { name: 'Create Workspace' }))
    await waitFor(() => {
      expect(workspaces.all().some((entry) => entry.name === 'Design Ops Hub')).toBe(true)
    })
    const created = workspaces.all().find((entry) => entry.name === 'Design Ops Hub')
    expect(created).toMatchObject({
      ownerId: 'em_bilal',
      description: 'Design operations',
      visibility: 'private',
      department: 'Software',
      template: 'marketing-team',
      setup: { views: ['list', 'board', 'team', 'calendar'], statusMode: 'default' },
    })
    expect(created?.memberIds).toEqual(expect.arrayContaining(['em_maryam', 'em_haroon']))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/project-management/workspaces/${created?.id ?? ''}`,
      )
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Create Workspace' })).not.toBeInTheDocument()
    })
  })

  it('makes a workspace that everyone in the company can see', async () => {
    const { user, dialog } = await openWizard()

    await user.click(within(dialog).getByRole('button', { name: /^Share Visibility/ }))
    const option = await screen.findByRole('radio', { name: /^Only Workspace/ })
    expect(option).toHaveAccessibleName(
      /All members of the HRango workspace can see and edit this workspace/,
    )
    await user.click(option)
    // It closes the list, needs no member list and shows as the field's value.
    await waitFor(() => {
      expect(screen.queryByRole('radio', { name: /^Only Workspace/ })).not.toBeInTheDocument()
    })
    expect(within(dialog).getByRole('button', { name: /^Share Visibility/ })).toHaveTextContent(
      'Only Workspace',
    )
    expect(screen.queryByText('Share only with members')).not.toBeInTheDocument()

    await toCustomize(user, { name: 'Company Handbook', visibility: 'Only Workspace' })
    await user.click(within(dialog).getByRole('button', { name: 'Create Workspace' }))
    await waitFor(() => {
      expect(workspaces.all().find((entry) => entry.name === 'Company Handbook')).toMatchObject({
        visibility: 'workspace',
      })
    })
  })

  it('caps the counters and shows a duplicate name on step 1', async () => {
    const { user, dialog } = await openWizard()

    const name = within(dialog).getByRole('textbox', { name: 'Workspace Name' })
    await user.type(name, 'x'.repeat(55))
    expect(name).toHaveValue('x'.repeat(50))
    expect(within(dialog).getByText('50/50 characters')).toBeVisible()
    await user.clear(name)
    expect(within(dialog).getByText('0/50 characters')).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled()

    await toCustomize(user, { name: 'UX/UI Design Team Work Space' })
    await user.click(within(dialog).getByRole('button', { name: 'Create Workspace' }))

    // The server refuses the name: back to step 1 with the message on the field.
    const field = await within(dialog).findByRole('textbox', { name: 'Workspace Name' })
    expect(within(dialog).getByText('A workspace with this name already exists')).toBeVisible()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    await user.type(field, ' 2')
    expect(
      within(dialog).queryByText('A workspace with this name already exists'),
    ).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
    await user.click(await within(dialog).findByRole('button', { name: 'Create Workspace' }))
    await waitFor(() => {
      expect(
        workspaces.all().some((entry) => entry.name === 'UX/UI Design Team Work Space 2'),
      ).toBe(true)
    })
  })

  it('picks and removes the owner and members, and Escape closes popups first', async () => {
    const { user, dialog } = await openWizard()

    await user.click(within(dialog).getByRole('button', { name: /^Workspace Owner/ }))
    const picker = await screen.findByRole('dialog', { name: 'Add Workspace Owner' })
    expect(within(picker).getByText('Showing 34 Employees')).toBeVisible()
    expect(within(picker).getByRole('button', { name: 'Add Member' })).toBeDisabled()
    await user.type(within(picker).getByRole('searchbox', { name: 'Search employee' }), 'marketing')
    expect(within(picker).getByText('Showing 5 Employees')).toBeVisible()
    await user.click(within(picker).getByRole('radio', { name: /^Jack Roy/ }))
    await user.click(within(picker).getByRole('radio', { name: /^Areeba Hameed/ }))
    // One owner: the second choice replaces the first.
    expect(within(picker).getByRole('radio', { name: /^Jack Roy/ })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    // Escape closes the popup, not the wizard.
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Add Workspace Owner' })).not.toBeInTheDocument()
    })
    expect(wizard()).toBeVisible()
    expect(within(dialog).getByRole('button', { name: /^Workspace Owner/ })).toHaveTextContent(
      'Add workspace owner',
    )

    await chooseOwner(user, /^Areeba Hameed/)
    expect(within(dialog).getByRole('button', { name: /^Workspace Owner/ })).toHaveTextContent(
      'Areeba Hameed',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Remove Areeba Hameed' }))
    expect(within(dialog).getByRole('button', { name: /^Workspace Owner/ })).toHaveTextContent(
      'Add workspace owner',
    )

    // Four members: three avatars and "+1 Members", whose list can remove one.
    await chooseVisibility(user, 'Make Private')
    await user.click(screen.getByRole('button', { name: 'Add members' }))
    const members = await screen.findByRole('dialog', { name: 'Add Members' })
    for (const person of [/^Maryam Javed/, /^Haroon Jalani/, /^Rehan Ahmad/, /^Talha Aziz/]) {
      await user.click(within(members).getByRole('checkbox', { name: person }))
    }
    await user.click(within(members).getByRole('checkbox', { name: /^Talha Aziz/ }))
    await user.click(within(members).getByRole('checkbox', { name: /^Asad Mehmood/ }))
    await user.click(within(members).getByRole('button', { name: 'Add Member' }))
    const overflow = await screen.findByRole('button', { name: 'Show all 4 members' })
    expect(overflow).toHaveTextContent('+1 Members')
    await user.click(overflow)
    const list = await screen.findByRole('dialog', { name: 'Members' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(4)
    await user.click(within(list).getByRole('button', { name: 'Remove Asad Mehmood' }))
    expect(screen.getByRole('button', { name: 'Show all 3 members' })).toHaveTextContent(
      '3 Members',
    )

    // Escape closes the members list, then the visibility list, then the wizard.
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Members' })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('radio', { name: /^Make Private/ })).toBeVisible()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('radio', { name: /^Make Private/ })).not.toBeInTheDocument()
    })
    expect(wizard()).toBeVisible()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Create Workspace' })).not.toBeInTheDocument()
    })
  })

  it('switches views on and off, sets the default view, and Cancel discards', async () => {
    const { user, dialog } = await openWizard()
    await toCustomize(user)
    expect(within(summary('Default Views')).getByText('List, Board')).toBeVisible()

    await user.click(within(dialog).getByRole('button', { name: 'Customize Default Views' }))
    expect(
      await within(dialog).findByRole('heading', { name: 'Default Settings for Views' }),
    ).toHaveFocus()
    expect(within(dialog).getByText('Always Required')).toBeVisible()
    const list = within(dialog).getByRole('switch', { name: 'List view' })
    expect(list).toBeChecked()
    expect(list).toBeDisabled()
    expect(within(dialog).getByRole('switch', { name: 'Calendar view' })).not.toBeChecked()
    await user.click(within(dialog).getByRole('switch', { name: 'Calendar view' }))

    // The 3-dot menu makes Timeline the default view (and switches it on).
    await user.click(within(dialog).getByRole('button', { name: 'Timeline view options' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Select Default View' }))
    expect(within(dialog).getByRole('switch', { name: 'Timeline view' })).toBeChecked()
    expect(within(dialog).getByText('Default View Selected')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))

    expect(
      within(summary('Default Views')).getByText('List, Board, Calendar, Timeline'),
    ).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'Customize Default Views' })).toHaveFocus()

    // Cancel keeps what was saved.
    await user.click(within(dialog).getByRole('button', { name: 'Customize Default Views' }))
    await user.click(await within(dialog).findByRole('switch', { name: 'Board view' }))
    expect(within(dialog).getByRole('switch', { name: 'Board view' })).not.toBeChecked()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(
      within(summary('Default Views')).getByText('List, Board, Calendar, Timeline'),
    ).toBeVisible()

    await user.click(within(dialog).getByRole('button', { name: 'Create Workspace' }))
    await waitFor(() => {
      expect(
        workspaces.all().find((entry) => entry.name === 'Design Ops Hub')?.setup,
      ).toMatchObject({ views: ['list', 'board', 'calendar', 'timeline'], defaultView: 'timeline' })
    })
  })

  it('edits custom statuses, switches templates and keeps changes only on Done', async () => {
    const { user, dialog } = await openWizard()
    await toCustomize(user)
    const chain = () => within(summary('Task Statuses')).getByText(/,/)
    expect(chain()).toHaveTextContent('To Do, In-Progress, Completed')

    await user.click(within(dialog).getByRole('button', { name: 'Customize Task Statuses' }))
    await within(dialog).findByRole('heading', { name: 'Edit Statuses for Work Starter' })
    // Default statuses are read-only.
    expect(within(dialog).getByRole('radio', { name: /^Default statuses/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(
      within(dialog).queryByRole('button', { name: 'Add status to Active' }),
    ).not.toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'Add Status Color to Active' }),
    ).toBeDisabled()
    expect(within(dialog).queryByRole('heading', { name: 'Done' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /^Status Templates/ })).toHaveTextContent(
      'Select a status template',
    )

    await user.click(within(dialog).getByRole('radio', { name: /^Use custom statuses/ }))
    expect(within(dialog).getByRole('button', { name: /^Status Templates/ })).toHaveTextContent(
      'Custom',
    )
    expect(within(dialog).getByRole('heading', { name: 'Done' })).toBeVisible()

    // Add a status, refuse a duplicate in the same group, then rename and recolour it.
    await user.click(within(dialog).getByRole('button', { name: 'Add status to Active' }))
    await user.type(
      within(dialog).getByRole('textbox', { name: 'New status in Active' }),
      'In-Progress',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Add Status' }))
    expect(within(dialog).getByText('This group already has a status with this name')).toBeVisible()
    const input = within(dialog).getByRole('textbox', { name: 'New status in Active' })
    await user.clear(input)
    await user.type(input, 'Review{Enter}')
    expect(within(dialog).getByRole('listitem', { name: 'Review' })).toBeVisible()

    await user.click(within(dialog).getByRole('button', { name: 'Review options' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }))
    const rename = within(dialog).getByRole('textbox', { name: 'Rename Review' })
    await user.clear(rename)
    await user.type(rename, 'QA Review')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(within(dialog).getByRole('listitem', { name: 'QA Review' })).toBeVisible()

    await user.click(within(dialog).getByRole('button', { name: 'QA Review options' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Change Color' }))
    await user.click(await screen.findByRole('button', { name: 'Colour #DC3545' }))

    // Escape in an inline editor cancels it without closing the wizard.
    await user.click(within(dialog).getByRole('button', { name: 'Add status to Closed' }))
    await user.type(
      within(dialog).getByRole('textbox', { name: 'New status in Closed' }),
      'Archived',
    )
    await user.keyboard('{Escape}')
    expect(
      within(dialog).queryByRole('textbox', { name: 'New status in Closed' }),
    ).not.toBeInTheDocument()
    expect(wizard()).toBeVisible()

    // Reorder with the handle's arrow keys and by dragging.
    const handle = within(dialog).getByRole('button', {
      name: 'Reorder QA Review, position 2 of 2',
    })
    handle.focus()
    await user.keyboard('{ArrowUp}')
    expect(
      within(dialog).getByRole('button', { name: 'Reorder QA Review, position 1 of 2' }),
    ).toHaveFocus()
    const dataTransfer = { setData: () => undefined, getData: () => '' }
    fireEvent.dragStart(within(dialog).getByRole('listitem', { name: 'In-Progress' }), {
      dataTransfer,
    })
    fireEvent.dragOver(within(dialog).getByRole('listitem', { name: 'QA Review' }), {
      dataTransfer,
    })
    fireEvent.drop(within(dialog).getByRole('listitem', { name: 'QA Review' }), { dataTransfer })
    expect(
      within(dialog).getByRole('button', { name: 'Reorder In-Progress, position 1 of 2' }),
    ).toBeVisible()

    // Delete asks first.
    await user.click(within(dialog).getByRole('button', { name: 'In-Progress options' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete Status' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))
    expect(within(dialog).queryByRole('listitem', { name: 'In-Progress' })).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Done' }))
    expect(chain()).toHaveTextContent('To Do, QA Review, Completed')

    // A status template replaces the list; Cancel throws it away.
    await user.click(within(dialog).getByRole('button', { name: 'Customize Task Statuses' }))
    await user.click(await within(dialog).findByRole('button', { name: /^Status Templates/ }))
    await user.click(await screen.findByRole('option', { name: 'Scrum' }))
    expect(within(dialog).getByRole('listitem', { name: 'Blocked' })).toBeVisible()
    expect(within(dialog).getByRole('listitem', { name: 'Accepted' })).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(chain()).toHaveTextContent('To Do, QA Review, Completed')

    // A new template starts from the statuses shown and becomes the choice.
    await user.click(within(dialog).getByRole('button', { name: 'Customize Task Statuses' }))
    await user.click(await within(dialog).findByRole('button', { name: /^Status Templates/ }))
    await user.click(await screen.findByRole('button', { name: 'Add New Template' }))
    const popup = await screen.findByRole('dialog', { name: 'New Template' })
    await user.type(within(popup).getByRole('textbox', { name: 'Name' }), 'Kanban')
    await user.click(within(popup).getByRole('button', { name: 'Save' }))
    expect(within(popup).getByText('A status template with this name already exists')).toBeVisible()
    await user.clear(within(popup).getByRole('textbox', { name: 'Name' }))
    await user.type(within(popup).getByRole('textbox', { name: 'Name' }), 'Design Flow')
    await user.click(within(popup).getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: /^Status Templates/ })).toHaveTextContent(
        'Design Flow',
      )
    })
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))

    await user.click(within(dialog).getByRole('button', { name: 'Create Workspace' }))
    await waitFor(() => {
      expect(workspaces.all().some((entry) => entry.name === 'Design Ops Hub')).toBe(true)
    })
    const setup = workspaces.all().find((entry) => entry.name === 'Design Ops Hub')?.setup
    expect(setup?.statusMode).toBe('custom')
    expect(setup?.statuses.map((status) => status.name)).toEqual([
      'To Do',
      'QA Review',
      'Completed',
    ])
    expect(setup?.statuses.find((status) => status.name === 'QA Review')).toMatchObject({
      group: 'active',
      color: '#DC3545',
    })
  })

  it('renames and deletes status templates', async () => {
    const { user, dialog } = await openWizard()
    await toCustomize(user, { template: /^Project Management/ })
    await user.click(within(dialog).getByRole('button', { name: 'Customize Task Statuses' }))
    await within(dialog).findByRole('heading', { name: 'Edit Statuses for Project Management' })

    await user.click(within(dialog).getByRole('button', { name: /^Status Templates/ }))
    const options = await screen.findAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual([
      'Content',
      'Kanban',
      'Marketing',
      'Custom',
      'Scrum',
    ])
    await user.click(screen.getByRole('button', { name: 'Kanban template options' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }))
    const popup = await screen.findByRole('dialog', { name: 'Rename' })
    const field = within(popup).getByRole('textbox', { name: 'Status Template Name' })
    expect(field).toHaveValue('Kanban')
    await user.clear(field)
    await user.type(field, 'Board Flow')
    await user.click(within(popup).getByRole('button', { name: 'Save' }))

    await user.click(within(dialog).getByRole('button', { name: /^Status Templates/ }))
    expect(await screen.findByRole('option', { name: 'Board Flow' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Content template options' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete Template' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))
    await user.click(within(dialog).getByRole('button', { name: /^Status Templates/ }))
    await screen.findByRole('option', { name: 'Board Flow' })
    expect(screen.queryByRole('option', { name: 'Content' })).not.toBeInTheDocument()

    // Choosing "Custom" uses the workflow's own statuses.
    await user.click(screen.getByRole('option', { name: 'Custom' }))
    for (const status of ['To Do', 'Planning', 'At Risk', 'Update Required']) {
      expect(within(dialog).getByRole('listitem', { name: status })).toBeVisible()
    }
  })

  it('switches organizer features on and off', async () => {
    const { user, dialog } = await openWizard()
    await toCustomize(user)
    const organizer = () => within(summary('Organizer')).getByText(/Time Estimate/)
    expect(organizer()).toHaveTextContent(/^Tags, Time Estimate, Priority/)

    await user.click(within(dialog).getByRole('button', { name: 'Customize Organizer' }))
    await within(dialog).findByRole('heading', { name: 'Default Settings for Organizer' })
    const tags = within(dialog).getByRole('switch', { name: 'Tags' })
    expect(tags).toBeChecked()
    await user.click(tags)
    expect(tags).not.toBeChecked()
    expect(within(dialog).getByRole('button', { name: 'About Story Points' })).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))
    expect(organizer()).toHaveTextContent(/^Time Estimate, Priority/)

    await user.click(within(dialog).getByRole('button', { name: 'Customize Organizer' }))
    await user.click(await within(dialog).findByRole('switch', { name: 'Priority' }))
    // Back discards, like Cancel.
    await user.click(within(dialog).getByRole('button', { name: 'Back' }))
    expect(organizer()).toHaveTextContent(/^Time Estimate, Priority/)
  })
})
