import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import {
  columnPermissions,
  favorites,
  reminders,
  tasks,
  views,
  workspaces,
} from '@/mocks/project-management/db'
import { renderApp } from '@/test/test-utils'

const PAGE = '/project-management/workspaces/ws_uxui'
/** The first render loads the route chunks and the mock data. */
const FIRST_LOAD = { timeout: 15_000 }

// Whole-app flows with many popups: give each wait room when every file runs in parallel.
configure({ asyncUtilTimeout: 4000 })

/** The status group's table ("To Do", "In-Progress", "Completed"). */
const group = async (name: string) => screen.findByRole('table', { name })

/** Task names of a group's rows, in the order drawn. */
const namesIn = (table: HTMLElement) =>
  within(table)
    .queryAllByRole('row')
    .map((row) => row.querySelector('span[title][class*="truncate"]')?.textContent)
    .filter(Boolean)

async function openRowMenu(user: UserEvent, task: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${task}` }, FIRST_LOAD))
  return screen.findByRole('menu')
}

async function openColumnMenu(user: UserEvent, column: string) {
  const [button] = await screen.findAllByRole(
    'button',
    { name: `${column} column menu` },
    FIRST_LOAD,
  )
  if (!button) throw new Error(`No ${column} column menu`)
  await user.click(button)
  return screen.findByRole('menu')
}

/**
 * Opens a sub menu with the keyboard (jsdom has no layout, so Radix closes a sub menu as soon as
 * the pointer leaves its trigger) and returns it.
 */
async function openSubMenu(user: UserEvent, menu: HTMLElement, trigger: string) {
  within(menu).getByRole('menuitem', { name: trigger }).focus()
  await user.keyboard('{ArrowRight}')
  const menus = await screen.findAllByRole('menu')
  const sub = menus.at(-1)
  if (!sub || sub === menu) throw new Error(`No ${trigger} menu`)
  return sub
}

const task = (id: string) => tasks.find(id)
const workspace = () => workspaces.find('ws_uxui')

/** The List view's columns as the workspace's List view keeps them (`config.columns`, API keys). */
const listColumns = () => {
  const config = views.find('vw_ws_uxui_list')?.config
  return (Array.isArray(config?.columns) ? config.columns : []) as {
    key: string
    visible: boolean
  }[]
}

describe('Workspace page', { timeout: 60_000 }, () => {
  it('draws the banner and groups the tasks by status, subtasks under their task', async () => {
    const { user } = renderApp(PAGE)

    expect(
      await screen.findByRole(
        'heading',
        { name: 'UX/UI Design Team Work Space', level: 1 },
        FIRST_LOAD,
      ),
    ).toBeVisible()
    expect(await screen.findByRole('button', { name: '8 members' })).toHaveTextContent('5 +')

    const todo = await group('To Do')
    expect(namesIn(todo)).toEqual(['User Qualitative Research', 'User Persona List'])
    expect(within(todo).getByText('2', { selector: '[title="2 subtasks"]' })).toBeVisible()
    const progress = await group('In-Progress')
    expect(namesIn(progress)).toEqual([
      'Iteration List',
      'Low fidelity wire-frames for Create Workspace',
    ])
    expect(namesIn(await group('Completed'))).toEqual(['Prototype the List view'])

    // Subtasks open under their task, whatever their own status.
    expect(within(todo).queryByText('Book interview slots')).not.toBeInTheDocument()
    await user.click(within(todo).getByRole('button', { name: 'Expand User Qualitative Research' }))
    expect(namesIn(todo)).toEqual([
      'User Qualitative Research',
      'Prepare interview questions',
      'Book interview slots',
      'User Persona List',
    ])
    await user.click(
      within(todo).getByRole('button', { name: 'Collapse User Qualitative Research' }),
    )
    expect(within(todo).queryByText('Book interview slots')).not.toBeInTheDocument()

    // A whole group folds away.
    await user.click(screen.getByRole('button', { name: 'Collapse Completed' }))
    expect(screen.queryByRole('table', { name: 'Completed' })).not.toBeInTheDocument()

    // Only the List view is designed.
    await user.click(screen.getByRole('button', { name: 'Board' }))
    expect(await screen.findByText('This view is not designed yet')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Open List view' }))
    expect(await group('To Do')).toBeVisible()
  })

  it('adds tasks from the inline row and from the view bar', async () => {
    const { user } = renderApp(PAGE)

    await user.click(
      await screen.findByRole('button', { name: 'Add Task to In-Progress' }, FIRST_LOAD),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Task' }))
    const name = await screen.findByRole('textbox', { name: 'Task name' })
    await user.keyboard('{Enter}')
    expect(await screen.findByText('Enter the task name')).toBeVisible()
    await user.type(name, 'Usability test plan{Enter}')

    const progress = await group('In-Progress')
    expect(await within(progress).findByText('Usability test plan')).toBeVisible()
    const created = tasks.all().find((entry) => entry.name === 'Usability test plan')
    expect(created).toMatchObject({
      statusId: 'st_progress',
      taskListId: null,
      parentTaskId: null,
    })
    // The row stays open for the next one; Escape closes it.
    expect(screen.getByRole('textbox', { name: 'Task name' })).toHaveValue('')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('textbox', { name: 'Task name' })).not.toBeInTheDocument()

    // The purple Add Task opens the row in the first status.
    await user.click(screen.getByRole('button', { name: 'More ways to add a task' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Milestone' }))
    await user.type(
      await screen.findByRole('textbox', { name: 'Milestone name' }),
      'Design sign-off{Enter}',
    )
    await waitFor(() => {
      expect(tasks.all().find((entry) => entry.name === 'Design sign-off')).toMatchObject({
        statusId: 'st_todo',
        taskType: 'milestone',
      })
    })
  })

  it('renames a task from the row menu', async () => {
    const { user } = renderApp(PAGE)

    const menu = await openRowMenu(user, 'Iteration List')
    await user.click(within(menu).getByRole('menuitem', { name: 'Rename Task' }))
    const box = await screen.findByRole('textbox', { name: 'Rename Iteration List' })
    expect(box).toHaveFocus()
    await user.clear(box)
    await user.type(box, 'Iteration Plan{Enter}')

    expect(await screen.findByText('Iteration Plan', { selector: '[title]' })).toBeVisible()
    await waitFor(() => {
      expect(task('tk_flow')?.name).toBe('Iteration Plan')
    })
    expect(await screen.findByText('Task renamed')).toBeInTheDocument()
  })

  it('sorts, hides, shows and moves columns', async () => {
    const { user } = renderApp(PAGE)

    const todo = await screen.findByRole('table', { name: 'To Do' }, FIRST_LOAD)
    const [sortByName] = within(todo).getAllByRole('button', { name: 'Sort by Task Name' })
    if (!sortByName) throw new Error('No sort button')
    await user.click(sortByName)
    expect(namesIn(todo)).toEqual(['User Persona List', 'User Qualitative Research'])
    await user.click(sortByName)
    expect(namesIn(todo)).toEqual(['User Qualitative Research', 'User Persona List'])

    // Header menu: Sort as Bottom on Set Priority puts Low before Urgent and High.
    let menu = await openColumnMenu(user, 'Set Priority')
    expect(within(menu).getByText('Sorting Order')).toBeVisible()
    await user.click(within(menu).getByRole('menuitemcheckbox', { name: 'Sort as Bottom' }))
    const progress = await group('In-Progress')
    expect(namesIn(progress)).toEqual([
      'Low fidelity wire-frames for Create Workspace',
      'Iteration List',
    ])
    menu = await openColumnMenu(user, 'Set Priority')
    await user.click(within(menu).getByRole('menuitem', { name: 'Clear Sort' }))
    expect(namesIn(progress)).toEqual([
      'Iteration List',
      'Low fidelity wire-frames for Create Workspace',
    ])

    // Hide Start Date, then add it back with the round "+".
    menu = await openColumnMenu(user, 'Start Date')
    await user.click(within(menu).getByRole('menuitem', { name: 'Hide Column' }))
    await waitFor(() => {
      expect(screen.queryAllByRole('button', { name: 'Start Date column menu' })).toHaveLength(0)
    })
    await waitFor(() => {
      expect(listColumns().find((column) => column.key === 'start_date')?.visible).toBe(false)
    })
    const [add] = screen.getAllByRole('button', { name: 'Add Column' })
    if (!add) throw new Error('No Add Column button')
    await user.click(add)
    await user.click(await screen.findByRole('menuitem', { name: 'Start Date' }))
    expect(
      (await screen.findAllByRole('button', { name: 'Start Date column menu' })).length,
    ).toBeGreaterThan(0)

    // Move to Start puts Set Priority right after Task Name.
    menu = await openColumnMenu(user, 'Set Priority')
    await user.click(within(menu).getByRole('menuitem', { name: 'Move to Start' }))
    await waitFor(() => {
      const shown = listColumns()
        .filter((column) => column.visible)
        .map((column) => column.key)
      expect(shown.slice(0, 3)).toEqual(['name', 'priority', 'assignees'])
    })
    const headers = within(await group('To Do'))
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
      .filter(Boolean)
    expect(headers.slice(0, 3)).toEqual(['Task Name', 'Set Priority', 'Add Assignee'])

    // Delete Column asks first.
    menu = await openColumnMenu(user, 'Due Date')
    await user.click(within(menu).getByRole('menuitem', { name: 'Delete Column' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete column?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete Column' }))
    await waitFor(() => {
      expect(listColumns().some((column) => column.key === 'due_date')).toBe(false)
    })
  })

  it('favorites, moves, converts, retypes and deletes tasks from the row menu', async () => {
    const { user } = renderApp(PAGE)

    let menu = await openRowMenu(user, 'User Persona List')
    await user.click(within(menu).getByRole('menuitem', { name: 'Add to Favorite' }))
    await waitFor(() => {
      expect(
        favorites
          .all()
          .some((entry) => entry.entityType === 'task' && entry.entityId === 'tk_persona'),
      ).toBe(true)
    })
    menu = await openRowMenu(user, 'User Persona List')
    expect(within(menu).getByRole('menuitem', { name: 'Remove from Favorite' })).toBeVisible()
    await user.keyboard('{Escape}')

    // Move To a list of another folder.
    menu = await openRowMenu(user, 'Iteration List')
    const moveTo = await openSubMenu(user, menu, 'Move To')
    const lists = within(moveTo).getByRole('group', { name: 'UX/UI Design Team Work Space' })
    fireEvent.click(within(lists).getByRole('menuitem', { name: /^Information Gathering/ }))
    await waitFor(() => {
      expect(task('tk_flow')?.taskListId).toBe('it_info')
    })
    expect(await screen.findByText('Moved to Information Gathering')).toBeInTheDocument()

    // Convert to Subtask of another task.
    menu = await openRowMenu(user, 'User Persona List')
    const convert = await openSubMenu(user, menu, 'Convert Task')
    expect(within(convert).getByRole('menuitem', { name: 'Convert to List' })).toBeVisible()
    const parents = await openSubMenu(user, convert, 'Convert to Subtask')
    expect(
      within(parents).getByRole('menuitem', { name: 'User Qualitative Research' }),
    ).toHaveFocus()
    await user.keyboard('{Enter}')
    await waitFor(() => {
      expect(task('tk_persona')).toMatchObject({
        parentTaskId: 'tk_quali',
        taskListId: 'it_quali',
      })
    })
    // It now opens under its parent.
    const todo = await group('To Do')
    await waitFor(() => {
      expect(namesIn(todo)).toEqual([
        'User Qualitative Research',
        'Prepare interview questions',
        'Book interview slots',
        'User Persona List',
      ])
    })

    // Task Type: Milestone.
    menu = await openRowMenu(user, 'Prototype the List view')
    const types = await openSubMenu(user, menu, 'Task Type')
    expect(within(types).getByRole('menuitemcheckbox', { name: 'Task' })).toBeChecked()
    await user.keyboard('{ArrowDown}{Enter}')
    await waitFor(() => {
      expect(task('tk_ui')?.taskType).toBe('milestone')
    })

    // Delete asks first.
    menu = await openRowMenu(user, 'Prototype the List view')
    await user.click(within(menu).getByRole('menuitem', { name: 'Delete' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete task?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(task('tk_ui')).toBeUndefined()
    })
    expect(await screen.findByText('Task deleted')).toBeInTheDocument()
  })

  it('reorders tasks with the drag handle, by keyboard or drag and drop', async () => {
    const { user } = renderApp(PAGE)

    const todo = await screen.findByRole('table', { name: 'To Do' }, FIRST_LOAD)
    within(todo).getByRole('button', { name: 'Reorder User Persona List' }).focus()
    await user.keyboard('{ArrowUp}')
    expect(namesIn(todo)).toEqual(['User Persona List', 'User Qualitative Research'])
    await waitFor(() => {
      expect(task('tk_persona')?.sortOrder).toBeLessThan(task('tk_quali')?.sortOrder ?? 0)
    })

    // Dropped on a row of another group, a task takes that group's status.
    const handle = screen.getByRole('button', { name: 'Reorder Prototype the List view' })
    const target = within(todo).getByText('User Qualitative Research', { selector: '[title]' })
    const row = target.closest('[role="row"]')
    if (!row) throw new Error('No row for User Qualitative Research')
    fireEvent.dragStart(handle)
    fireEvent.dragOver(row)
    fireEvent.drop(row)
    await waitFor(() => {
      expect(task('tk_ui')?.statusId).toBe('st_todo')
    })
    // No whole number fits between them: the group is renumbered.
    await waitFor(() => {
      expect(['tk_persona', 'tk_ui', 'tk_quali'].map((id) => task(id)?.sortOrder)).toEqual([
        10, 20, 30,
      ])
    })
    expect(namesIn(todo)).toEqual([
      'User Persona List',
      'Prototype the List view',
      'User Qualitative Research',
    ])
  })

  it('sets a reminder from Remind Me', async () => {
    const { user } = renderApp(PAGE)

    const menu = await openRowMenu(user, 'User Persona List')
    await user.click(within(menu).getByRole('menuitem', { name: /Remind Me/ }))
    const popup = await screen.findByRole('dialog', { name: 'Remind me about User Persona List' })
    await user.click(within(popup).getByRole('button', { name: /^Tomorrow/ }))
    await user.click(within(popup).getByRole('button', { name: 'Save' }))
    // POST /projects/reminders: the caller's own reminder on the task.
    const reminder = () => reminders.all().find((entry) => entry.entityId === 'tk_persona')
    await waitFor(() => {
      expect(reminder()).toBeDefined()
    })
    const at = new Date(`${reminder()?.remindAt ?? ''}Z`)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(at.getDate()).toBe(tomorrow.getDate())
    expect(at.getHours()).toBe(9)
  })

  it('saves a column role permission', async () => {
    const { user } = renderApp(PAGE)

    const menu = await openColumnMenu(user, 'Add Assignee')
    await user.click(within(menu).getByRole('menuitem', { name: 'Add Role Permission' }))
    const dialog = await screen.findByRole('dialog', { name: 'Set Role Permission' })

    // Everyone: Can View.
    await user.click(
      within(dialog).getByRole('button', { name: 'Default Role permission: Default' }),
    )
    await user.click(await screen.findByRole('radio', { name: /^Can View/ }))
    // Managers: Private Field.
    await user.click(within(dialog).getByRole('button', { name: 'Default Role: Default Role' }))
    await user.click(await screen.findByRole('button', { name: /^Managers/ }))
    expect(within(dialog).getByRole('list', { name: 'Managers employees' })).toHaveTextContent(
      'Bilal Ahmed',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Managers permission: Set Permissions' }),
    )
    await user.click(await screen.findByRole('radio', { name: /^Private Field/ }))
    // A custom member.
    await user.click(
      within(dialog).getByRole('button', { name: 'Add Members or Teams: Add Members or Teams' }),
    )
    await user.click(await screen.findByRole('button', { name: /Haroon Jalani/ }))
    const custom = within(dialog).getByRole('list', { name: 'Custom permissions' })
    expect(custom).toHaveTextContent('Designation: Software Developer')
    expect(custom).toHaveTextContent('Department: Software')

    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Set Role Permission' })).not.toBeInTheDocument()
    })
    // PUT /projects/workspaces/{id}/column-permissions/assignees
    expect(columnPermissions.all().find((entry) => entry.columnKey === 'assignees')).toMatchObject({
      defaultLevel: 'can_view',
      roles: [{ memberRole: 'manager', permissionLevel: 'private' }],
      members: [{ employeeId: 'em_haroon', permissionLevel: 'can_edit' }],
    })
    expect(await screen.findByText('Permissions saved')).toBeInTheDocument()
  })

  it('filters the tasks with the banner search', async () => {
    const { user } = renderApp(PAGE)

    const search = await screen.findByRole('searchbox', { name: 'Search tasks' }, FIRST_LOAD)
    await group('To Do')
    await user.type(search, 'persona')
    expect(namesIn(await group('To Do'))).toEqual(['User Persona List'])
    expect(screen.queryByRole('table', { name: 'In-Progress' })).not.toBeInTheDocument()

    // A matching subtask shows under its task.
    await user.clear(search)
    await user.type(search, 'questions')
    expect(namesIn(await group('To Do'))).toEqual([
      'User Qualitative Research',
      'Prepare interview questions',
    ])

    await user.clear(search)
    await user.type(search, 'nothing like this')
    expect(await screen.findByText('No tasks match your search or filters.')).toBeVisible()
  })

  it('invites members to the workspace', async () => {
    const { user } = renderApp(PAGE)

    await user.click(await screen.findByRole('button', { name: 'Invite Members' }, FIRST_LOAD))
    const dialog = await screen.findByRole('dialog', { name: 'Invite Members' })
    // Members already in the workspace are not offered.
    expect(within(dialog).queryByText('Bilal Ahmed')).not.toBeInTheDocument()
    await user.type(within(dialog).getByRole('textbox', { name: 'Search employee' }), 'daniel')
    await user.click(within(dialog).getByRole('checkbox', { name: 'Invite Daniel Brooks' }))
    await user.click(within(dialog).getByRole('button', { name: 'Invite Member' }))

    await waitFor(() => {
      expect(workspace()?.members).toContainEqual({
        employeeId: 'em_daniel',
        memberRole: 'contributor',
      })
    })
    expect(await screen.findByText('Member invited')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '9 members' })).toHaveTextContent('6 +')
  })
  it('hides what a contributor may not do: the workspace role decides', async () => {
    const research = workspaces.find('ws_research')
    if (!research) throw new Error('No ws_research')
    workspaces.update('ws_research', {
      ...research,
      members: [
        { employeeId: 'em_jack', memberRole: 'workspace_admin' },
        { employeeId: 'em_shelley', memberRole: 'contributor' },
      ],
    })
    renderApp('/project-management/workspaces/ws_research')

    expect(
      await screen.findByRole(
        'heading',
        { name: 'User Research & Planning', level: 1 },
        FIRST_LOAD,
      ),
    ).toBeVisible()
    expect(await screen.findByText('No tasks yet')).toBeVisible()
    // Contributors add subtasks only, keep the workspace as it is and set no permissions.
    expect(screen.queryByRole('button', { name: 'Add Task' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'More ways to add a task' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Invite Members' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add View' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change Cover' })).not.toBeInTheDocument()
  })
})
