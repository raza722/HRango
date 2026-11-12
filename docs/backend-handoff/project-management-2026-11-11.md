# Project Management: frontend changes and backend requests (11 Nov 2026)

For the backend developer. Part 1 lists what the backend needs to change; read it first. Part 2
lists the endpoints the frontend now calls, all of which already exist in
`app/routers/projects_*.py`; please check they behave as described. Part 3 lists the frontend
changes, for reference.

Conventions are the API's own: JSON bodies, ids sent as numbers, `rowVersion` on every edit,
errors as `{ message, code?, fieldErrors? }`.

> **Status, 12 Nov 2026: B1 to B6 are built in `hRango-Backend`** (not yet run against a database:
> there was none on the machine they were written on). Before merging, please seed a `*_dev`
> database (`scripts.seed`, which applies the new migrations `0002_pm_workspace_task_key.sql` and
> `0003_pm_task_due_notice.sql`) and run `pytest tests/test_projects*.py tests/test_leaves*.py`.
> What each change does is in section 1a below; `comparison/08-projects.md` has the same notes.

## 1a. What was built (12 Nov 2026)

| #   | Built                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | `fn_workspace_access`: in a `workspace` workspace a company employee who is not a member works as a contributor (`myRole: "contributor"`); `public` stays read only. New output `isMember` on workspaces. `fn_column_levels` gives them the contributor column rules. Only members can be assigned tasks (unchanged).                                                                  |
| B2  | `pm.workspace.task_key` (2–5 letters from the name: initials of several words, else the first three letters; a clash adds a letter) and `pm.workspace_task_sequence` (one counter per workspace, kept off the workspace row so adding a task does not change its rowVersion). New codes `ONB-12`; old codes kept. Output `key`; `PUT /workspaces/{id}` accepts an optional `key`.      |
| B3  | Notifications `projects.comment` (assignees), `projects.comment_reply` (the parent comment's author), `projects.extension_requested` (workspace admins, HR, managers), `projects.extension_decided` (the requester), and a daily job `pm.usp_task_due_notify` in `scripts/nightly.py` for `projects.task_due_tomorrow` / `projects.task_overdue` (once per task, person and due date). |
| B4  | `PATCH /projects/lists/{id}` and `PATCH /projects/views/{id}`: a field left out keeps its value, `null` clears it, `rowVersion` required. PUT unchanged.                                                                                                                                                                                                                               |
| B5  | `gantt` removed from the `project_management` template seed.                                                                                                                                                                                                                                                                                                                           |
| B6  | Most roles already held `projects.lists.edit/delete`; HR Officer lacked delete (its `*.delete` exclusion). `default_roles.py` now has `exclude_ok` and gives it back.                                                                                                                                                                                                                  |

Frontend changes made for them: workspaces read `isMember` (the dashboards' "my workspaces" and the
default workspace used `myRole !== null`, which B1 would have widened) and `key`; comments link
`#ONB-12` codes as well as `#HR000000001` (`comment-text.ts`), and a mention of `#ONB-1` is no
longer found inside `#ONB-12` (`mentionsIn`). The demo API does the same (codes, keys, roles).

Not done yet (frontend): an editable key in Workspace Settings, and sending PATCH instead of the
whole list on rename/move (PUT still works).

---

## 1. Backend changes requested

| #   | Priority | What                                                                               | Why                                                |
| --- | -------- | ---------------------------------------------------------------------------------- | -------------------------------------------------- |
| B1  | High     | Make `privacy = 'workspace'` differ from `'public'`                                | They behave the same today                         |
| B2  | High     | Short task codes per workspace (`ONB-12`, not `HR000000011`)                       | The codes are long and the same in every workspace |
| B3  | Medium   | More notifications: extensions, comments on your task, replies, due soon / overdue | People miss work that needs them                   |
| B4  | Medium   | Partial updates for lists and views (PATCH, or "omitted = keep")                   | A rename must resend every field                   |
| B5  | Low      | Drop the Gantt view from the `project_management` template seed                    | Gantt has no screen (the BRD leaves it out)        |
| B6  | Low      | Give roles `projects.lists.edit` / `projects.lists.delete` in the seeds            | The new rename/move/delete menu needs them         |

### B1. "workspace" and "public" visibility behave the same

`db/procedures/pm/fn_access.sql`: a company employee who is not a member gets rank 0 and may read
any workspace whose `privacy <> 'private'`. So `'workspace'` and `'public'` both mean "everyone can
read, only members can change". Nothing gives `'workspace'` its own behaviour.

The design's text for the two options was unclear, so the frontend now labels them:

| `privacy`   | Label in the app        | Text shown                                                                              |
| ----------- | ----------------------- | --------------------------------------------------------------------------------------- |
| `private`   | Private                 | Only the owner and the members you invite can see this workspace.                       |
| `public`    | Everyone can view       | Everyone in the company can open it and read its tasks. Only members can change things. |
| `workspace` | Everyone can work in it | Everyone in the company can open it and work on its tasks, like a member.               |

**Request:** for `privacy = 'workspace'`, treat a non-member employee as a `contributor` (rank 1)
in `fn_workspace_access`. If that is not wanted, tell us and we will remove one of the two options.

### B2. Task codes

`db/procedures/pm/usp_task_save.sql` (line ~135) builds the code as `N'HR' + RIGHT('000000000' +
@n, 9)` from a company-wide counter. Every task in every workspace gets a code like `HR000000011`.
These are long, and they don't say which workspace a task is in.

**Request:** add a short key to `pm.workspace` (2 to 5 capitals, made from the name, unique per
company, editable later) and keep a counter per workspace, so codes look like `ONB-12`. Keep
existing codes as they are. The frontend shows `code` exactly as sent, so it needs no change. Two
places find tasks by code text: `#CODE` in comments (mentions) and the search boxes. Both keep
working with any format.

### B3. Notifications

Sent today (`usp_task_announce.sql`, `usp_reminder.sql`): task assigned, @mention, and due
reminders (through the `remind_once` job). Their links,
`/project-management/workspaces/{ws}?task={id}`, now open the task panel (see 2.1).

**Request:** add these, with the same link shape:

| Event                                     | Who is told                         |
| ----------------------------------------- | ----------------------------------- |
| Extension requested                       | Managers and above in the workspace |
| Extension approved / rejected             | The person who asked                |
| New comment on a task you are assigned to | The assignees (not the author)      |
| Reply to your comment                     | The comment's author                |
| Task due tomorrow / now overdue           | The assignees (a daily job)         |

### B4. `PUT /lists/{id}` and `PUT /views/{id}` replace every field

`usp_list_save` overwrites `privacy`, `color`, `description`, `start_at`, `end_at` and `priority`
with whatever is sent (`privacy` falls back to `'workspace'`). `usp_list_view_save` does the same
for `is_pinned`, `is_protected` and `config`. So a client that only renames a list, or moves it
into a folder, must send every field back, or it wipes them.

The frontend now does that (it keeps a list's settings from `GET /workspaces/{id}` and sends them
back). **Request:** add `PATCH /lists/{id}` and `PATCH /views/{id}`, or treat a missing field as
"keep" (and only an explicit `null` as "clear"). Then the frontend can send only what changed.

### B5. Gantt in the templates

`db/seeds/0150_pm_templates.sql` line 54 gives the `project_management` template a `gantt` view.
Gantt, Workload and Mind Map are out of scope in the BRD and have no screen. The frontend now
ignores them everywhere: they are not shown, offered or saved, and a workspace whose default view
is one of them opens on List. **Request (optional):** remove `gantt` from the seed so new
workspaces don't store a view nobody can open.

### B6. Permission codes for folders and lists

The routes need `projects.lists.edit` (PUT `/folders/{id}`, `/lists/{id}`) and
`projects.lists.delete` (DELETE). They are in `app/catalogue/projects.py`. **Request:** give
those codes to the roles that should rename, move and delete folders and lists (managers and
above, as `usp_folder.sql` checks rank ≥ 3). Without them the new row menu stays hidden.

### Not a request: questions answered from the code

- **Deleting a workspace** (`usp_workspace_delete`) removes everything: tasks (via
  `usp_task_purge`), docs, lists, folders, members, shares, reminders and recents. The confirm
  dialog says so, and you must type the workspace name to confirm.
- **Deleting a folder** moves its lists to the top level. **Deleting a list** with tasks is
  refused (409). The menu says "Move or delete its N tasks first" instead of offering Delete.
- **Removing a status that tasks use** is refused with `STATUS_IN_USE`. Workspace Settings shows
  the server's message.
- **Sub-departments** come from the same `org.department` table, so their ids are valid
  `departmentId`s for a workspace. The picker now shows them indented under their department,
  using `parentId` from `GET /organisation/lookups/departments`. Please keep `parentId` there.

---

## 2. Endpoints the frontend now calls

All of these exist. Please check the behaviour in the "Expects" column.

### 2.1 Task panel (`?task=<id>`)

Clicking a task (name, card, calendar chip, timeline bar, history line, dashboard row) opens a
side panel. Its address is `/project-management/workspaces/{ws}?task={taskId}` (plus
`&list={listId}` when copied from a list). Old `#{taskId}` links still open it.

| Call                                                        | Expects                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------ |
| `GET /projects/tasks/{id}`                                  | Used when the task is not in the open list; 404 → "Task not found" |
| `GET /projects/tasks/{id}/activity?page=1&pageSize=30`      | Newest first; `ActivityOut` lines as the workspace history         |
| `POST /projects/tasks` with `parentTaskId`                  | "Add subtask" in the panel                                         |
| `PUT /projects/tasks/{id}` (name, description)              | Rename in the panel's title, description editor                    |
| `DELETE /projects/tasks/{id}?rowVersion=`                   | Delete in the panel                                                |
| `POST /projects/recents` `{ entityType: 'task', entityId }` | Recorded when the panel opens (errors are ignored)                 |

### 2.2 Workspace Settings (the banner's "•••" menu → Workspace Settings)

Only what changed is sent, in this order. Each step carries the `rowVersion` the previous step
answered with.

```jsonc
// 1. Details: PUT /projects/workspaces/{id}
{ "name": "HR Onboarding", "description": "…", "privacy": "private",
  "ownerId": 12, "departmentId": 4, "rowVersion": "…" }
// 2. Statuses: PUT /projects/workspaces/{id}/statuses
{ "statusMode": "custom", "statusTemplate": null,
  "statuses": [ { "id": 31, "name": "To Do", "color": "#87909E", "statusGroup": "not_started" },
                { "id": null, "name": "Review", "color": "#2E64E2", "statusGroup": "active" } ],
  "rowVersion": "…" }
// 3. Organizer: PUT /projects/workspaces/{id}/features
{ "features": [ { "featureCode": "tags" }, { "featureCode": "time_tracking" } ], "rowVersion": "…" }
// 4. Views (shared ones only):
//    POST   /projects/workspaces/{id}/views  { "viewType": "table", "name": "Table", "isDefault": false }
//    DELETE /projects/views/{viewId}?rowVersion=…   (never List, never isRequired)
//    PUT    /projects/views/{viewId}  (whole ViewIn, isDefault: true) to change the default view
```

Expects:

- Owner change: workspace admins only (403 otherwise; the frontend disables the field).
- Statuses: a status with an `id` keeps its tasks. One without is created. One left out is
  removed (`STATUS_IN_USE` if tasks use it).
- Views: only one shared default per workspace. `usp_list_view_save` already clears the old
  default when another view is saved with `isDefault: true`, and the mock does the same.

### 2.3 Delete workspace

`DELETE /projects/workspaces/{id}?rowVersion=` from Workspace Settings → Delete Workspace (or the
banner menu), for workspace admins only. Afterwards the app goes to the Workspaces page.

### 2.4 Folders and lists (Workspaces panel)

| Action                            | Call                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| New folder (named first)          | `POST /projects/workspaces/{id}/folders { name }`                                                                                    |
| New list (named, optional folder) | `POST /projects/workspaces/{id}/lists { name, folderId }`                                                                            |
| Rename folder                     | `PUT /projects/folders/{id} { name, sortOrder, rowVersion }`                                                                         |
| Rename / move list                | `PUT /projects/lists/{id} { name, folderId, privacy, color, description, startAt, endAt, priority, sortOrder, rowVersion }` (see B4) |
| Delete folder / list              | `DELETE /projects/folders/{id}?rowVersion=` / `DELETE /projects/lists/{id}?rowVersion=`                                              |

Before, the "+" made "New Folder 1" or "New List 1" without asking for a name, and nothing could
be renamed, moved or deleted.

### 2.5 Recents

`POST /projects/recents { entityType, entityId }` is now sent when a workspace page opens
(`workspace`), when a list opens (`task_list`), and when the task panel opens (`task`). The Home,
Workspace and Project dashboards read `GET /projects/recents`. They used to call it a "pending
endpoint" with a "Sample data" badge; the badge is gone because the endpoint exists.

---

## 3. Frontend changes (reference)

All in `frontend/src/features/project-management` unless noted.

**Bugs fixed**

| Bug                                                                                                           | Fix                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tasks typed quickly were lost: text typed while one task saved was joined to its name, then wiped             | The box clears on Enter and saves run one after another in the background (`components/workspace/use-task-composer.ts`, used by the List view's row and the Board's Add Task) |
| Create Workspace failed with "Department not found" for departments with a space in the name (demo data only) | The PM mock checks ids against the shared department lookup (`src/mocks/project-management/seed.ts`)                                                                          |
| Gantt was listed twice on Default Views                                                                       | Views are de-duplicated; unbuilt views are dropped (`BUILT_VIEWS` in `types/pm.types.ts`, `api/pm.mappers.ts`)                                                                |
| No way to delete a workspace                                                                                  | Delete Workspace in the banner menu and in Workspace Settings, with type-the-name confirmation (`components/workspace/delete-workspace-dialog.tsx`)                           |

**Added**

- Task panel: `components/workspace/task-panel.tsx`, route search `task` in `pm-search.ts`. It
  shows details (each field with its editor and the column permissions), description, subtasks
  (plus Add subtask), latest comment (opens the thread) and history.
- Workspace Settings: `components/workspace/workspace-settings-dialog.tsx`. It reuses the
  wizard's Default Views, Edit Statuses and Organizer pages.
- Folder and list dialogs and row menus: `components/layout/item-dialogs.tsx`,
  `components/layout/workspaces-panel.tsx`.
- Workspaces page (the sidebar entry is now "Workspaces", not "Create Workspace"):
  `components/layout/workspaces-home.tsx`, a card per workspace. The design's illustration shows
  only when there are none.
- API: `pmApi.updateItem`, `deleteItem`, `saveWorkspaceSettings`, `taskActivity`,
  `recordRecent` (`api/pm.api.ts`); hooks in `hooks/use-pm.ts`. The mock gained
  `PUT/DELETE /folders|lists/{id}`, `DELETE /views/{id}`, `PUT /workspaces/{id}/statuses|features`,
  `GET /tasks/{id}/activity` and `POST /recents`.

**Changed**

- Gantt, Workload and Mind Map are never shown or offered (B5).
- Wizard: you are the owner by default, and step 2 starts on the owner's department. The owner
  picker's button says "Select Owner". Character counters are grey until near the limit.
  Departments are A–Z with sub-departments indented. Visibility has the new labels (B1). "Add
  Status Color" now reads "Add Status", with a note on how to unlock editing. Some copy is
  clearer.
- Layout: the Workspaces panel is hidden by default on phones and tablets, narrower on 1024–1279
  px laptops, and remembers your choice. The view tabs are one row that scrolls sideways (they
  used to wrap onto five rows). A status group's Add Task no longer runs past the edge.
- The priority cell says "Set priority" (it said "Priorities this task").
- Permissions (`hooks/use-pm-access.ts`): `changeOwner` (rank 5), `editLists` / `deleteLists`
  (`projects.lists.edit|delete`, rank ≥ 3).

## 4. Trying it against the real API

1. `npm run dev:api` (Vite mode `backend`). Sign in with a real account (not the demo one).
2. Open Project Management → Workspaces → a workspace. Click a task name (panel). In the banner,
   open Workspace Settings: change the visibility, remove a view, rename a status, save.
3. In the panel's "+", make a folder and a list in it. Use the row's "…" to rename, move and
   delete.
4. Assign a task to someone. Their bell's notification link should open the task panel.
