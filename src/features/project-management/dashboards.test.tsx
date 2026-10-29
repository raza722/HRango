import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, format } from 'date-fns'
import { delay, http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { DEMO_USER } from '@/mocks/auth/handlers'
import { server } from '@/mocks/node'
import { resetPmDashboardMocks } from '@/mocks/project-management/dashboard-handlers'
import { attachments, comments } from '@/mocks/project-management/db'
import { apiPath, errorResponse } from '@/mocks/utils'
import { useAuthStore } from '@/stores/auth-store'
import { renderApp, setViewportWidth } from '@/test/test-utils'

const HOME = '/project-management/home'
const WORKSPACE = '/project-management/workspace-dashboard'
const PROJECT = '/project-management/project-dashboard'
const TASKS = '/project-management/task-dashboard'
const FIRST_LOAD = { timeout: 15_000 }

const region = (name: RegExp) => screen.findByRole('region', { name }, FIRST_LOAD)

/** Renders as a user who holds only these permission codes (as `/auth/me` sends them). */
function renderAs(path: string, codes: string[]) {
  const result = renderApp(path)
  useAuthStore.getState().setSession({
    token: useAuthStore.getState().token ?? '',
    user: { ...DEMO_USER, permissions: codes.map((code) => ({ code, scope: 'company' })) },
  })
  return result
}

async function choose(user: UserEvent, label: string, option: string) {
  await user.click(await screen.findByRole('combobox', { name: label }, FIRST_LOAD))
  await user.click(await screen.findByRole('option', { name: option }))
}

/** The figures row of the workload table: status → tasks. */
function workloadRow(table: HTMLElement, status: string) {
  const header = within(table).getByRole('rowheader', { name: status })
  const row = header.closest('tr')
  if (!row) throw new Error(`No row for ${status}`)
  return row
}

beforeEach(() => {
  resetPmDashboardMocks()
})

describe('Home Dashboard', { timeout: 60_000 }, () => {
  it('greets the signed-in person and sums up their work across workspaces', async () => {
    renderApp(HOME)
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: /^Good (morning|afternoon|evening), Shelley$/ },
        FIRST_LOAD,
      ),
    ).toBeVisible()
    expect(await screen.findByText('Covers 3 workspaces you can open.')).toBeVisible()

    // My Work: the overdue audit first, the subtask due in two days in the next week.
    const myWork = await region(/^My Work/)
    expect(within(myWork).getByRole('button', { name: /^Overdue/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(
      within(myWork).getByRole('link', { name: /^Accessibility audit of the old portal/ }),
    ).toHaveAttribute('href', '/project-management/workspaces/ws_qa#tk_audit')
    expect(within(myWork).getByText('3 days overdue')).toBeVisible()
    expect(within(myWork).getByRole('link', { name: /^Prepare interview questions/ })).toBeVisible()

    // Assigned to Me: open tasks by default, the done ones on request.
    const assigned = await region(/^Assigned to Me/)
    expect(within(assigned).getAllByRole('link')).toHaveLength(4)
  })

  it('shows the agenda of a chosen day', async () => {
    const { user } = renderApp(HOME)
    const agenda = await region(/^Agenda/)
    const inTwoDays = addDays(new Date(), 2)
    await user.click(
      within(agenda).getByRole('button', {
        name: `${format(inTwoDays, 'EEEE d MMMM')}: 1 item`,
      }),
    )
    const list = within(agenda).getByRole('list', {
      name: `Agenda for ${format(inTwoDays, 'EEEE d MMMM')}`,
    })
    expect(within(list).getByRole('link', { name: /Prepare interview questions/ })).toBeVisible()
    expect(within(list).getByText('All day')).toBeVisible()
  })

  it('resolves a comment assigned to her', async () => {
    const { user } = renderApp(HOME)
    const panel = await region(/^Assigned Comments/)
    expect(await within(panel).findByText('@Shelley Kannes Complete this task ASAP')).toBeVisible()
    expect(within(panel).getByText('Bilal Ahmed')).toBeVisible()

    await user.click(
      within(panel).getByRole('button', {
        name: 'Resolve the comment from Bilal Ahmed on User Qualitative Research',
      }),
    )
    await waitFor(() => {
      expect(comments.find('cm_1')?.isResolved).toBe(true)
    })
    expect(await within(panel).findByText('No comments for you')).toBeVisible()
  })

  it('reads the Activity KPI as a table, for her or her team', async () => {
    const { user } = renderApp(HOME)
    const kpi = await region(/^Activity KPI/)
    expect(
      within(kpi).getByRole('img', { name: /^Your tasks due and completed per day/ }),
    ).toBeVisible()

    await user.click(within(kpi).getByRole('button', { name: /^Table view of Your tasks/ }))
    const table = within(kpi).getByRole('table', { name: /^Your tasks due and completed/ })
    // A header row and fourteen days.
    expect(within(table).getAllByRole('row')).toHaveLength(15)

    await user.click(within(kpi).getByRole('button', { name: 'Team' }))
    expect(within(kpi).getByRole('button', { name: 'Team' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(kpi).getByRole('table', { name: /^Team tasks due and completed/ })).toBeVisible()
    // Two tasks of her workspaces have closed: one on time, one late.
    expect(within(kpi).getByText('50%')).toBeVisible()
  })

  it('keeps a personal list (sample data until the backend has one)', async () => {
    const { user } = renderApp(HOME)
    const panel = await region(/^Personal List/)
    expect(await within(panel).findByText('Sample data')).toBeVisible()
    expect(await within(panel).findByText('Prepare the sprint review slides')).toBeVisible()

    await user.click(within(panel).getByRole('button', { name: 'Add' }))
    expect(within(panel).getByText('Write what you need to do')).toBeVisible()

    await user.type(within(panel).getByRole('textbox', { name: 'New item' }), 'Call the venue')
    await user.click(within(panel).getByRole('button', { name: 'Add' }))
    expect(await within(panel).findByText('Call the venue')).toBeVisible()

    await user.click(within(panel).getByRole('checkbox', { name: 'Mark Call the venue as done' }))
    expect(
      await within(panel).findByRole('checkbox', { name: 'Mark Call the venue as not done' }),
    ).toBeChecked()

    await user.click(within(panel).getByRole('button', { name: 'Delete Call the venue' }))
    await waitFor(() => {
      expect(within(panel).queryByText('Call the venue')).not.toBeInTheDocument()
    })
  })

  it('marks Recents as sample data, and says when the backend has no such endpoint', async () => {
    renderApp(HOME)
    const recents = await region(/^Recents/)
    expect(await within(recents).findByText('Sample data')).toBeVisible()
    expect(
      await within(recents).findByRole('link', { name: /^User Qualitative Research/ }),
    ).toHaveAttribute('href', '/project-management/workspaces/ws_uxui#tk_quali')
    // A project (folder) opens its Project Dashboard.
    expect(
      within(recents).getByRole('link', { name: /^User Research & Planning/ }),
    ).toHaveAttribute(
      'href',
      '/project-management/project-dashboard?workspace=ws_uxui&folder=folder%3Afd_research',
    )
  })

  it('shows "not available yet" when the real API lacks a pending endpoint', async () => {
    server.use(http.get(apiPath('/projects/recents'), () => errorResponse(404, 'Not Found')))
    renderApp(HOME)
    const recents = await region(/^Recents/)
    expect(await within(recents).findByText('Not available yet')).toBeVisible()
    expect(within(recents).getByText(/Backend Dependencies T7/)).toBeVisible()
    // Nothing is shown, so nothing is marked as sample data.
    expect(within(recents).queryByText('Sample data')).not.toBeInTheDocument()
  })

  it('works at phone width', async () => {
    setViewportWidth(375)
    renderApp(HOME)
    expect(await region(/^My Work/)).toBeVisible()
    expect(await region(/^Agenda/)).toBeVisible()
  })
})

describe('Dashboard states', { timeout: 60_000 }, () => {
  it('shows a loading state while the workspaces load', async () => {
    server.use(
      http.get(apiPath('/projects/workspaces'), async () => {
        await delay(400)
      }),
    )
    renderApp(HOME)
    expect(
      await screen.findByRole('status', { name: 'Loading your dashboard' }, FIRST_LOAD),
    ).toBeInTheDocument()
    expect(await region(/^My Work/)).toBeVisible()
  })

  it('offers Create Workspace when there is no workspace', async () => {
    server.use(
      http.get(apiPath('/projects/workspaces'), () =>
        HttpResponse.json({ data: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 } }),
      ),
    )
    renderApp(HOME)
    expect(
      await screen.findByRole('heading', { name: 'No workspaces yet' }, FIRST_LOAD),
    ).toBeVisible()
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: 'Create Workspace' }),
    ).toHaveAttribute('href', '/project-management/workspaces?create=true')
  })

  it('shows the error with Try again when the workspaces cannot be read', async () => {
    server.use(
      http.get(apiPath('/projects/workspaces'), () => errorResponse(500, 'The server is down.')),
    )
    renderApp(TASKS)
    const alert = await screen.findByRole('alert', {}, FIRST_LOAD)
    expect(within(alert).getByText('Could not load this dashboard')).toBeVisible()
    expect(within(alert).getByText('The server is down.')).toBeVisible()
    expect(within(alert).getByRole('button', { name: /Try again/ })).toBeVisible()
  })

  it.each([HOME, WORKSPACE, PROJECT, TASKS])(
    'refuses %s without the workspace view permission',
    async (path) => {
      renderAs(path, ['projects.workspaces.create'])
      expect(
        await screen.findByRole('heading', { name: 'No access to Project Management' }, FIRST_LOAD),
      ).toBeVisible()
      expect(screen.getByRole('link', { name: 'Go to Workspaces' })).toBeVisible()
    },
  )

  it('says so when a workspace refuses the caller', async () => {
    server.use(
      http.get(apiPath('/projects/workspaces/:id'), ({ params }) =>
        params.id === 'ws_qa' ? errorResponse(403, 'Not a member.') : undefined,
      ),
    )
    renderApp(`${WORKSPACE}?workspace=ws_qa`)
    expect(
      await screen.findByRole('heading', { name: 'You cannot open this workspace' }, FIRST_LOAD),
    ).toBeVisible()
  })
})

describe('Workspace Dashboard', { timeout: 60_000 }, () => {
  it('opens on the favourite workspace with its workload, folders, lists and bookmarks', async () => {
    renderApp(WORKSPACE)
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'UX/UI Design Team Work Space' },
        FIRST_LOAD,
      ),
    ).toBeVisible()

    const workload = await region(/^Workload by Status/)
    const table = within(workload).getByRole('table', { name: 'Workload by status' })
    expect(workloadRow(table, 'To Do')).toHaveTextContent('343%')
    expect(workloadRow(table, 'Completed')).toHaveTextContent('114%')

    const folders = await region(/^Folders/)
    expect(within(folders).getByRole('link', { name: /^UX Design Process/ })).toHaveAttribute(
      'href',
      '/project-management/project-dashboard?workspace=ws_uxui&folder=folder%3Afd_ux_process',
    )

    const lists = await region(/^Lists/)
    const done = within(lists).getByRole('link', { name: /^User Interface & Prototyping/ })
    expect(done).toHaveAttribute('href', '/project-management/workspaces/ws_uxui?list=it_ui')
    expect(within(done).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')

    const bookmarks = await region(/^Bookmarks/)
    expect(
      await within(bookmarks).findByRole('link', { name: /^UX\/UI Design Team Work Space/ }),
    ).toBeVisible()

    const docs = await region(/^Docs/)
    expect(await within(docs).findByText('Sample data')).toBeVisible()
    expect(await within(docs).findByText('Interview guide')).toBeVisible()
  })

  it('lists the files attached to its tasks', async () => {
    attachments.insert({
      id: 'att_brief',
      taskId: 'tk_quali',
      fileId: 'file_brief',
      name: 'research-brief.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      uploadedByName: 'Shelley Kannes',
      createdAt: new Date().toISOString().slice(0, 19),
      url: 'https://files.example/research-brief.pdf',
    })
    renderApp(WORKSPACE)
    const files = await region(/^Resources and files/)
    expect(await within(files).findByRole('link', { name: 'research-brief.pdf' })).toHaveAttribute(
      'href',
      'https://files.example/research-brief.pdf',
    )
    expect(within(files).getByRole('link', { name: 'User Qualitative Research' })).toBeVisible()
  })

  it('switches workspace with the picker', async () => {
    const { user, router } = renderApp(WORKSPACE)
    await choose(user, 'Workspace', 'QA Testing Phase')
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ workspace: 'ws_qa' })
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'QA Testing Phase' })).toBeVisible()
    expect(await screen.findByText('No folders yet')).toBeVisible()
  })
})

describe('Project Dashboard', { timeout: 60_000 }, () => {
  it('shows a folder as a project, with its tasks by assignee', async () => {
    renderApp(`${PROJECT}?workspace=ws_uxui&folder=folder:fd_research`)
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'User Research & Planning' },
        FIRST_LOAD,
      ),
    ).toBeVisible()

    const people = await region(/^Tasks by Assignee/)
    const rows = within(
      within(people).getByRole('list', { name: 'Tasks by Assignee' }),
    ).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent(/Bilal Ahmed2 open · 0 done/)

    const lists = await region(/^Lists/)
    expect(within(lists).getAllByRole('link')).toHaveLength(3)

    const projects = await region(/^Projects in this workspace/)
    expect(
      within(projects).getByRole('link', { name: /^User Research & Planning/ }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('picks another project, and says when one is missing', async () => {
    const { user, router } = renderApp(`${PROJECT}?workspace=ws_uxui&folder=folder:gone`)
    expect(
      await screen.findByRole('heading', { name: 'This project is not here' }, FIRST_LOAD),
    ).toBeVisible()
    await choose(user, 'Project', 'UX Design Process')
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ folder: 'folder:fd_ux_process' })
    })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'UX Design Process' }),
    ).toBeVisible()
  })

  it('explains a workspace without folders', async () => {
    renderApp(`${PROJECT}?workspace=ws_qa`)
    expect(
      await screen.findByRole('heading', { name: 'No projects in this workspace' }, FIRST_LOAD),
    ).toBeVisible()
  })
})

describe('Task Dashboard', { timeout: 60_000 }, () => {
  it('sums up every workspace and opens a tile’s tasks', async () => {
    const { user, router } = renderApp(TASKS)
    const inProgress = await screen.findByRole('button', { name: 'In Progress: 4' }, FIRST_LOAD)
    expect(screen.getByRole('button', { name: 'Unassigned: 0' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Completed: 2' })).toBeVisible()

    await user.click(inProgress)
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ show: 'in-progress' })
    })
    expect(inProgress).toHaveAttribute('aria-pressed', 'true')
    const drill = await region(/^Tasks in progress/)
    expect(within(drill).getAllByRole('link')).toHaveLength(4)

    // Several workspaces: counted by status group.
    const workload = await region(/^Workload by Status/)
    const table = within(workload).getByRole('table', { name: 'Workload by status' })
    expect(workloadRow(table, 'Active')).toHaveTextContent('440%')
    expect(workloadRow(table, 'Closed')).toHaveTextContent('220%')

    const due = await region(/^Due This Week or Overdue/)
    expect(
      within(due).getByRole('link', { name: /^Accessibility audit of the old portal/ }),
    ).toBeVisible()
    expect(within(due).getByRole('link', { name: /^Write the onboarding copy/ })).toBeVisible()

    const activity = await region(/^Latest Activity/)
    expect(activity).toHaveTextContent('Prototype the List view was completed')

    await user.click(within(drill).getByRole('button', { name: /^Close/ }))
    await waitFor(() => {
      expect(router.state.location.search).not.toHaveProperty('show')
    })
  })

  it('narrows to one workspace with its own statuses', async () => {
    const { user, router } = renderApp(TASKS)
    await choose(user, 'Workspace', 'QA Testing Phase')
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ workspace: 'ws_qa' })
    })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Tasks in QA Testing Phase' }),
    ).toBeVisible()
    const table = within(await region(/^Workload by Status/)).getByRole('table', {
      name: 'Workload by status',
    })
    expect(workloadRow(table, 'In-Progress')).toHaveTextContent('133%')

    const people = await region(/^Totals and Open by Assignee/)
    expect(within(people).getByText('Areeba Hameed')).toBeVisible()
  })

  it('says when a tile has nothing', async () => {
    renderApp(`${TASKS}?show=unassigned`)
    const drill = await region(/^Unassigned tasks/)
    expect(await within(drill).findByText('Every open task has someone on it.')).toBeVisible()
  })
})
