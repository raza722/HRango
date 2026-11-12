import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  comments,
  dependencies,
  lists,
  shares,
  tasks,
  workspaces,
} from '@/mocks/project-management/db'
import { renderApp, renderWithQueryClient, signIn } from '@/test/test-utils'

import { pmApi } from './api/pm.api'
import { useOpenComments } from './components/comments/comments-context'
import { CommentsProvider } from './components/comments/comments-panel'
import { ShareDialog } from './components/task-fields/share-dialog'

describe('Project Management shell', () => {
  it('lists the workspaces beside the panel tree, with the sidebar menu', async () => {
    const { user } = renderApp('/project-management/workspaces')

    expect(await screen.findByRole('heading', { name: 'Workspaces', level: 1 })).toBeVisible()
    const main = screen.getByRole('main')
    // A card per workspace, favourites first.
    const cards = await within(main).findAllByRole('link', { name: /Owner:/ })
    expect(cards[0]).toHaveTextContent('UX/UI Design Team Work Space')
    expect(cards[0]).toHaveAttribute('href', '/project-management/workspaces/ws_uxui')
    const page = screen.getByRole('region', { name: 'Workspaces' })
    expect(within(page).getByRole('button', { name: 'Create Workspace' })).toBeVisible()

    const panel = screen.getByRole('complementary', { name: 'Workspaces' })
    expect(await within(panel).findByText('QA Testing Phase')).toBeVisible()
    // The favourite workspace is listed under Favorites too.
    expect(within(panel).getAllByText('UX/UI Design Team Work Space')).toHaveLength(2)

    for (const name of [
      'Home Dashboard',
      'Workspace Dashboard',
      'Project Dashboard',
      'Task Dashboard',
      'Workspaces',
    ]) {
      expect(screen.getAllByRole('link', { name }).length).toBeGreaterThan(0)
    }

    await user.type(within(panel).getByRole('textbox', { name: 'Search workspaces' }), 'qa')
    await waitFor(() => {
      expect(within(panel).queryByText('User Research & Planning')).not.toBeInTheDocument()
    })
    expect(within(panel).getByText('QA Testing Phase')).toBeVisible()
  })

  it('shows the Create Workspace page while there is no workspace', async () => {
    for (const workspace of workspaces.all()) workspaces.remove(workspace.id)
    renderApp('/project-management/workspaces')
    expect(await screen.findByRole('heading', { name: 'Create your own workspace!' })).toBeVisible()
    const landing = screen.getByRole('region', { name: 'Create your own workspace!' })
    expect(within(landing).getByRole('button', { name: /^Create Workspace/ })).toBeVisible()
  })

  it('scales its pages to the design while open, and only then', async () => {
    const { user } = renderApp('/project-management/workspaces')
    expect(await screen.findByRole('heading', { name: 'Workspaces', level: 1 })).toBeVisible()
    // globals.css shrinks the rem with the screen width for `html.design-scale`.
    expect(document.documentElement).toHaveClass('design-scale')

    const [leaves] = screen.getAllByRole('link', { name: 'Leaves' })
    if (!leaves) throw new Error('No Leaves link in the sidebar')
    await user.click(leaves)
    await waitFor(() => {
      expect(document.documentElement).not.toHaveClass('design-scale')
    })
  })

  it('renames, moves and deletes folders and lists from their menus', async () => {
    const { user } = renderApp('/project-management/workspaces/ws_uxui')
    const panel = await screen.findByRole('complementary', { name: 'Workspaces' })
    expect(await within(panel).findByText('UX Design Process')).toBeVisible()

    // Rename a folder.
    await user.click(
      within(panel).getByRole('button', { name: 'Options for folder UX Design Process' }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }))
    const rename = await screen.findByRole('dialog', { name: 'Rename folder' })
    const name = within(rename).getByRole('textbox', { name: 'Name' })
    await user.clear(name)
    await user.type(name, 'Design Process')
    await user.click(within(rename).getByRole('button', { name: 'Save' }))
    expect(await within(panel).findByText('Design Process')).toBeVisible()

    // Move a list to the top level: its other settings go back unchanged (PUT replaces them).
    const flow = lists.find('it_flow')
    await user.click(
      within(panel).getByRole('button', {
        name: 'Options for list User Flow and Information Architecture',
      }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Top level (no folder)' }))
    await waitFor(() => {
      expect(lists.find('it_flow')?.folderId).toBeNull()
    })
    expect(lists.find('it_flow')?.privacy).toBe(flow?.privacy)

    // A list with tasks cannot be deleted; the menu says why.
    await user.click(
      within(panel).getByRole('button', {
        name: 'Options for list User Flow and Information Architecture',
      }),
    )
    expect(await screen.findByRole('menuitem', { name: /Move or delete its/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await user.keyboard('{Escape}')

    // Delete the folder: its lists stay, at the top level.
    await user.click(
      within(panel).getByRole('button', { name: 'Options for folder Design Process' }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    )
    await waitFor(() => {
      expect(within(panel).queryByText('Design Process')).not.toBeInTheDocument()
    })
    expect(lists.all().filter((list) => list.folderId === 'fd_ux_process')).toHaveLength(0)
    expect(within(panel).getByText('Low & High Fidelity Wire-frames')).toBeVisible()
  })

  it('opens a workspace tree and adds a list to it', async () => {
    const { user, router } = renderApp('/project-management/workspaces/ws_uxui')

    const panel = await screen.findByRole('complementary', { name: 'Workspaces' })
    // Folders and lists come with the workspace (`GET /projects/workspaces/{id}`).
    expect(await within(panel).findByText('UX Design Process')).toBeVisible()
    expect(within(panel).getByText('User Flow and Information Architecture')).toBeVisible()
    const before = lists.all().length

    await user.click(within(panel).getByRole('button', { name: /^Add to UX\/UI Design Team/ }))
    // Docs have no API: the menu offers folders and lists.
    expect(screen.queryByRole('menuitem', { name: 'Doc' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('menuitem', { name: 'List' }))
    // The list is named first (it used to be made as "New List 1"), optionally in a folder.
    const dialog = await screen.findByRole('dialog', { name: 'New list' })
    await user.click(within(dialog).getByRole('button', { name: 'Create list' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Name the list')
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Usability round 2')
    await user.click(within(dialog).getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'UX Design Process' }))
    await user.click(within(dialog).getByRole('button', { name: 'Create list' }))
    await waitFor(() => {
      expect(lists.all()).toHaveLength(before + 1)
    })
    const made = lists.all().find((list) => list.name === 'Usability round 2')
    expect(made?.folderId).toBe('fd_ux_process')
    expect(await within(panel).findByText('Usability round 2')).toBeVisible()
    // The new list opens, ready for its first task.
    await waitFor(() => {
      expect(router.state.location.search).toHaveProperty('list', made?.id)
    })

    // A folder folds away.
    await user.click(within(panel).getByRole('button', { name: 'UX Design Process' }))
    expect(
      within(panel).queryByText('User Flow and Information Architecture'),
    ).not.toBeInTheDocument()
  })

  it('opens a dashboard from the banner’s Quick Action Menu', async () => {
    const { user, router } = renderApp('/project-management/workspaces/ws_uxui')
    await user.click(
      await screen.findByRole('button', { name: 'Quick Action Menu' }, { timeout: 15_000 }),
    )
    const items = await screen.findAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual([
      'Home Dashboard',
      'Workspace Dashboard',
      'Project Dashboard',
      'Task Dashboard',
    ])
    // Each item is the link itself.
    expect(items[3]).toHaveAttribute('href', '/project-management/task-dashboard')
    await user.click(items[3]!)
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/project-management/task-dashboard')
    })
  })

  it('opens the Task Dashboard with its figures (the dashboards have their own tests)', async () => {
    renderApp('/project-management/task-dashboard')
    expect(await screen.findByRole('heading', { name: 'Task Dashboard', level: 1 })).toBeVisible()
    // Tiles are named "<label>: <count>"; the seed has four tasks in an Active status.
    expect(
      await screen.findByRole('button', { name: 'In Progress: 4' }, { timeout: 15_000 }),
    ).toBeVisible()
  })
})

describe('Sharing & Permissions', () => {
  it('invites by email, shares with a person and saves the link settings', async () => {
    signIn()
    const { user } = renderWithQueryClient(
      <ShareDialog
        open
        onOpenChange={() => undefined}
        entityType="task"
        entityId="tk_quali"
        targetName="User Qualitative Research"
      />,
    )

    const dialog = await screen.findByRole('dialog', { name: 'Sharing & Permissions' })
    const invite = await within(dialog).findByRole('textbox', { name: 'Invite from email' })
    await user.type(invite, 'not-an-email')
    await user.click(within(dialog).getByRole('button', { name: 'Invite' }))
    expect(await within(dialog).findByText('Enter a valid email')).toBeVisible()
    await user.clear(invite)
    await user.type(invite, 'designer@example.com{Enter}')
    expect(within(dialog).getByText('designer@example.com')).toBeVisible()

    await user.type(
      within(dialog).getByRole('textbox', { name: 'Search employee to share with' }),
      'Bilal',
    )
    await user.click(await within(dialog).findByRole('button', { name: /Bilal Ahmed/ }))
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Access for Bilal Ahmed' }),
      'Full Edit',
    )

    await user.click(within(dialog).getByRole('switch'))
    await user.click(within(dialog).getByRole('checkbox', { name: 'Priority' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    // PUT /projects/shares: people and emails are its members.
    const saved = () => shares.all().find((entry) => entry.entityId === 'tk_quali')
    await waitFor(() => {
      expect(saved()).toBeDefined()
    })
    expect(saved()?.members).toEqual([
      expect.objectContaining({ employeeId: 'em_bilal', accessLevel: 'full_edit' }),
      expect.objectContaining({ email: 'designer@example.com', accessLevel: 'limited' }),
    ])
    expect(saved()?.isPublic).toBe(true)
    // Every property starts shown; Priority was switched off.
    expect(saved()?.properties).not.toContain('priority')
    expect(saved()?.properties).toContain('task_name_status')
  })
})

function OpenComments() {
  const open = useOpenComments()
  return (
    <button
      type="button"
      onClick={() => {
        open({ taskId: 'tk_quali', workspaceId: 'ws_uxui' })
      }}
    >
      Open comments
    </button>
  )
}

describe('Comments', () => {
  it('shows the thread, replies, assigns and resolves', async () => {
    signIn()
    const { user } = renderWithQueryClient(
      <CommentsProvider>
        <OpenComments />
      </CommentsProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Open comments' }))
    const dialog = await screen.findByRole('dialog', { name: 'Comments' })
    expect(await within(dialog).findByText(/Complete this task ASAP/)).toBeVisible()
    expect(within(dialog).getByText('@Shelley Kannes')).toBeVisible()
    expect(within(dialog).getByText(/Assigned to/)).toBeVisible()

    // Replies open from the blue button; a reply is added with Done.
    await user.click(within(dialog).getByRole('button', { name: /1 Reply/ }))
    expect(await within(dialog).findByText('On it, the interview guide is ready.')).toBeVisible()
    await user.click(within(dialog).getAllByRole('button', { name: 'Reply' })[0]!)
    await user.type(within(dialog).getByRole('textbox', { name: 'Write reply here' }), 'Thanks!')
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))
    await waitFor(() => {
      expect(
        comments.all().some((comment) => comment.body === 'Thanks!' && comment.parentId === 'cm_1'),
      ).toBe(true)
    })

    // Mark as Resolve.
    await user.click(within(dialog).getByRole('checkbox', { name: 'Mark as Resolve' }))
    await waitFor(() => {
      expect(comments.find('cm_1')?.isResolved).toBe(true)
    })
    expect(await within(dialog).findByText('Resolved by Shelley Kannes')).toBeVisible()

    // A new comment; Send stays disabled while the box is empty.
    const send = within(dialog).getByRole('button', { name: 'Send' })
    expect(send).toBeDisabled()
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Write comment here' }),
      'Ready for review',
    )
    await user.click(send)
    expect(await within(dialog).findByText('Ready for review')).toBeVisible()
  })
})

describe('Moving a task to another workspace', () => {
  it('keeps its ID, subtasks and comments, and drops links that stay behind', async () => {
    signIn()
    const moved = await pmApi.moveTask('tk_quali', { workspaceId: 'ws_qa', listId: null })
    expect(moved.id).toBe('tk_quali')
    expect(moved.code).toBe('HR000000001')
    expect(moved.workspaceId).toBe('ws_qa')
    expect(moved.blocking).toEqual([])
    // Statuses map to the first of the same group in the new workspace.
    expect(moved.statusId).toBe('st_q_todo')
    expect(tasks.find('tk_quali_a')?.workspaceId).toBe('ws_qa')
    expect(tasks.find('tk_quali_a')?.parentTaskId).toBe('tk_quali')
    expect(dependencies.all().some((entry) => entry.taskId === 'tk_persona')).toBe(false)
    expect(comments.all().filter((comment) => comment.taskId === 'tk_quali')).toHaveLength(2)
  })
})
