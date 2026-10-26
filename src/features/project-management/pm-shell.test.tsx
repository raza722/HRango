import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { comments, dependencies, lists, shares, tasks } from '@/mocks/project-management/db'
import { renderApp, renderWithQueryClient, signIn } from '@/test/test-utils'

import { pmApi } from './api/pm.api'
import { useOpenComments } from './components/comments/comments-context'
import { CommentsProvider } from './components/comments/comments-panel'
import { ShareDialog } from './components/task-fields/share-dialog'

describe('Project Management shell', () => {
  it('shows the Create Workspace page, the panel tree and the sidebar menu', async () => {
    const { user } = renderApp('/project-management/workspaces')

    expect(await screen.findByRole('heading', { name: 'Create your own workspace!' })).toBeVisible()
    const panel = screen.getByRole('complementary', { name: 'Workspaces' })
    expect(await within(panel).findByText('QA Testing Phase')).toBeVisible()
    // The favourite workspace is listed under Favorites too.
    expect(within(panel).getAllByText('UX/UI Design Team Work Space')).toHaveLength(2)

    for (const name of [
      'Home Dashboard',
      'Workspace Dashboard',
      'Project Dashboard',
      'Task Dashboard',
      'Create Workspace',
    ]) {
      expect(screen.getAllByRole('link', { name }).length).toBeGreaterThan(0)
    }

    await user.type(within(panel).getByRole('textbox', { name: 'Search workspaces' }), 'qa')
    await waitFor(() => {
      expect(within(panel).queryByText('User Research & Planning')).not.toBeInTheDocument()
    })
    expect(within(panel).getByText('QA Testing Phase')).toBeVisible()
  })

  it('opens a workspace tree and adds a list to it', async () => {
    const { user } = renderApp('/project-management/workspaces/ws_uxui')

    const panel = await screen.findByRole('complementary', { name: 'Workspaces' })
    // Folders and lists come with the workspace (`GET /projects/workspaces/{id}`).
    expect(await within(panel).findByText('UX Design Process')).toBeVisible()
    expect(within(panel).getByText('User Flow and Information Architecture')).toBeVisible()
    const before = lists.all().length

    await user.click(within(panel).getByRole('button', { name: /^Add to UX\/UI Design Team/ }))
    // Docs have no API: the menu offers folders and lists.
    expect(screen.queryByRole('menuitem', { name: 'Doc' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('menuitem', { name: 'List' }))
    await waitFor(() => {
      expect(lists.all()).toHaveLength(before + 1)
    })
    expect(await within(panel).findByText('New List 1')).toBeVisible()

    // A folder folds away.
    await user.click(within(panel).getByRole('button', { name: 'UX Design Process' }))
    expect(
      within(panel).queryByText('User Flow and Information Architecture'),
    ).not.toBeInTheDocument()
  })

  it('shows the dashboards as not designed yet', async () => {
    renderApp('/project-management/task-dashboard')
    expect(await screen.findByRole('heading', { name: 'Task Dashboard', level: 1 })).toBeVisible()
    expect(screen.getByText(/has no screen in the Figma files yet/)).toBeVisible()
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
