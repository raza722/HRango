import { configure, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { tasks, views, workspaces } from '@/mocks/project-management/db'
import { renderApp } from '@/test/test-utils'

const PAGE = '/project-management/workspaces/ws_uxui'
/** The first render loads the route chunks and the mock data. */
const FIRST_LOAD = { timeout: 15_000 }

// Whole-app flows with several dialogs: give each wait room when every file runs in parallel.
configure({ asyncUtilTimeout: 4000 })

describe('Task panel', { timeout: 60_000 }, () => {
  it('opens a task from its name, edits it, adds a subtask and closes', async () => {
    const { user, router } = renderApp(PAGE)
    await user.click(
      await screen.findByRole('button', { name: 'Open User Qualitative Research' }, FIRST_LOAD),
    )
    const panel = await screen.findByRole('dialog', { name: 'User Qualitative Research' })
    expect(router.state.location.search).toHaveProperty('task', 'tk_quali')

    // Every field with its editor, labelled as fields (not as the List view's headers).
    const details = within(panel).getByRole('region', { name: 'Details' })
    for (const label of ['Status', 'Assignees', 'Due date', 'Priority', 'Story points']) {
      expect(within(details).getByText(label)).toBeVisible()
    }
    // Its subtasks, and its history.
    const subtasks = within(panel).getByRole('region', { name: /^Subtasks/ })
    expect(
      within(subtasks).getByRole('button', { name: /Prepare interview questions/ }),
    ).toBeVisible()
    expect(
      await within(within(panel).getByRole('region', { name: 'History' })).findByText(
        /created this task/,
      ),
    ).toBeVisible()

    // Add a subtask.
    await user.type(
      within(subtasks).getByRole('textbox', { name: 'New subtask name' }),
      'Recruit participants{Enter}',
    )
    await waitFor(() => {
      expect(tasks.all().find((task) => task.name === 'Recruit participants')?.parentTaskId).toBe(
        'tk_quali',
      )
    })

    // Rename it from the title.
    const title = within(panel).getByRole('textbox', { name: 'Task name' })
    await user.clear(title)
    await user.type(title, 'User interviews{Enter}')
    await waitFor(() => {
      expect(tasks.find('tk_quali')?.name).toBe('User interviews')
    })

    await user.click(within(panel).getByRole('button', { name: 'Close task' }))
    await waitFor(() => {
      expect(router.state.location.search).not.toHaveProperty('task')
    })
  })

  it('opens from a ?task= link (as the inbox notifications send)', async () => {
    renderApp(`${PAGE}?task=tk_persona`)
    expect(
      await screen.findByRole('dialog', { name: 'User Persona List' }, FIRST_LOAD),
    ).toBeVisible()
  })

  it('opens from an older #id link too', async () => {
    renderApp(`${PAGE}#tk_persona`)
    expect(
      await screen.findByRole('dialog', { name: 'User Persona List' }, FIRST_LOAD),
    ).toBeVisible()
  })

  it('says so when the task no longer exists', async () => {
    renderApp(`${PAGE}?task=tk_gone`)
    expect(await screen.findByRole('dialog', { name: 'Task not found' }, FIRST_LOAD)).toBeVisible()
  })
})

describe('Adding tasks', { timeout: 60_000 }, () => {
  it('keeps every task typed in quick succession', async () => {
    const { user } = renderApp(PAGE)
    await user.click(await screen.findByRole('button', { name: 'Add Task' }, FIRST_LOAD))
    const box = await screen.findByRole('textbox', { name: 'Task name' })
    // The second name is typed while the first one is still saving.
    await user.type(box, 'Book the lab{Enter}')
    expect(box).toHaveValue('')
    await user.type(box, 'Print consent forms{Enter}')
    await waitFor(() => {
      const names = tasks.all().map((task) => task.name)
      expect(names).toEqual(expect.arrayContaining(['Book the lab', 'Print consent forms']))
    })
    expect(box).toHaveValue('')
  })
})

describe('Workspace Settings', { timeout: 60_000 }, () => {
  it('changes the details and views, then deletes the workspace', async () => {
    const { user, router } = renderApp(PAGE)
    await user.click(await screen.findByRole('button', { name: 'Workspace Settings' }, FIRST_LOAD))
    await user.click(await screen.findByRole('menuitem', { name: 'Workspace Settings' }))
    const dialog = await screen.findByRole('dialog', { name: 'Workspace Settings' })
    const save = within(dialog).getByRole('button', { name: 'Save Changes' })
    // Nothing to save until something changes.
    expect(save).toBeDisabled()

    await user.type(
      await within(dialog).findByRole('textbox', { name: 'Description (Optional)' }),
      ' Updated.',
    )
    await user.click(within(dialog).getByRole('radio', { name: /^Everyone can view/ }))

    // The wizard's Default Views page: Board off. Unbuilt views (Gantt) are never listed.
    await user.click(within(dialog).getByRole('button', { name: 'Customize Default Views' }))
    expect(within(dialog).queryByRole('switch', { name: 'Gantt view' })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('switch', { name: 'Board view' }))
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))

    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => {
      expect(workspaces.find('ws_uxui')).toMatchObject({ privacy: 'public' })
    })
    expect(workspaces.find('ws_uxui')?.description).toMatch(/Updated\.$/)
    expect(
      views
        .all()
        .filter((view) => view.workspaceId === 'ws_uxui' && !view.isPrivate)
        .map((view) => view.viewType),
    ).not.toContain('board')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Workspace Settings' })).not.toBeInTheDocument()
    })

    // Delete Workspace: the name is typed to confirm.
    await user.click(screen.getByRole('button', { name: 'Workspace Settings' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete Workspace' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete this workspace?' })
    const remove = within(confirm).getByRole('button', { name: 'Delete Workspace' })
    expect(remove).toBeDisabled()
    await user.type(
      within(confirm).getByRole('textbox', { name: /to confirm/ }),
      'UX/UI Design Team Work Space',
    )
    await user.click(remove)
    await waitFor(() => {
      expect(workspaces.find('ws_uxui')).toBeUndefined()
    })
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/project-management/workspaces')
    })
  })
})
