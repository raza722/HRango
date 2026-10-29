# Project Management: frontend ↔ backend mapping

Feature: `src/features/project-management` (sidebar → Project Management). Mocks:
`src/mocks/project-management`. Routes: `src/routes/_app/project-management/**` (unchanged; the search schemas
in `pm-search.ts` are unchanged too). Backend: `backend/app/routers/projects*.py`, `schemas/projects*.py`,
`catalogue/projects.py`; contract and decisions in `comparison/08-projects.md` and
`comparison/14-files-and-events.md`. Checked against the running API (dev company, 26 Oct 2026).

## How the feature talks to the API

- `api/pm.dto.ts` mirrors the API's shapes (`WorkspaceOut`, `TaskRowOut`, `TaskOut`, `CommentOut`, …). A script
  compared every DTO with the backend's Pydantic classes and with live responses: no missing or extra keys.
- `api/pm.mappers.ts` turns them into the screens' model (`types/pm.types.ts`) and back. The screens keep their
  own names where the design needs them (`not-started` for `not_started`, `mind-map`, `can-edit`,
  `workspace-admin`/`managers`/`team-leaders`/`contributors` for the workspace roles, camelCase column keys);
  each is mapped one-to-one in the mappers.
- `api/pm.api.ts` calls the routes. A List view edit (`updateTask(id, patch)`) is split by the API's endpoints:
  the task's own fields go to `PUT /tasks/{id}` as a whole (after a fresh `GET /tasks/{id}` for the rowVersion and
  the other fields), status to `PATCH …/status`, assignees and story points to `PUT …/assignees`, tags to
  `PUT …/tags`, labels to `PUT …/fields/{fieldId}`, list / parent / order to `POST …/move`, favourite to
  `PUT /favorites`. The parts run in that order; the first refusal stops the rest.
- Ids go out as numbers (`toApiId`: a numeric string becomes a number; the mock's readable ids such as
  `ws_uxui` go as strings, which the mock accepts).
- Instants come without an offset (UTC); `instant()` adds the `Z`. Times `HH:MM:SS` are shown as `HH:mm`.
- Lists the screens show whole (workspaces, people, tasks) are read page by page with `pageSize=100`.
- Edits and deletes send the `rowVersion` last read (tasks, comments, views, tags, custom fields, workspaces).

## Routes used, per screen

| Screen / action                                                                           | Route(s)                                                                                                                                                                                                                                                                                          | Shown with                                                                        |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Workspaces panel                                                                          | `GET /projects/workspaces` (all pages; hidden ones left out); the open workspace's folders and lists come with `GET /projects/workspaces/{id}`                                                                                                                                                    | `projects.workspaces.view` (route)                                                |
| Panel "+": Folder / List                                                                  | `POST /workspaces/{id}/folders`, `POST /workspaces/{id}/lists {name, folderId}`                                                                                                                                                                                                                   | `projects.lists.create` and manager or above                                      |
| Create Workspace buttons                                                                  | –                                                                                                                                                                                                                                                                                                 | `projects.workspaces.create`                                                      |
| Wizard step 1: owner and members                                                          | `GET /projects/people` (all pages)                                                                                                                                                                                                                                                                | –                                                                                 |
| Wizard step 2: department, workflow cards                                                 | `GET /organisation/lookups/departments`, `GET /projects/templates?kind=workflow`                                                                                                                                                                                                                  | –                                                                                 |
| Wizard step 3: status templates                                                           | `GET /projects/templates?kind=status`                                                                                                                                                                                                                                                             | –                                                                                 |
| Create Workspace                                                                          | `POST /projects/workspaces` (one call: name, description, privacy, ownerId, departmentId, workflowTemplate, statusMode, statusTemplate, statuses, views with isDefault, features, members)                                                                                                        | –                                                                                 |
| Workspace page                                                                            | `GET /workspaces/{id}`, `GET /workspaces/{id}/column-permissions`, `GET /workspaces/{id}/custom-fields` (the Labels field), in parallel                                                                                                                                                           | –                                                                                 |
| Rename, Add Description                                                                   | `PUT /workspaces/{id} {name, description, privacy, ownerId, departmentId, rowVersion}`                                                                                                                                                                                                            | `projects.workspaces.edit` and admin / HR                                         |
| Add to Favorite (workspace, task)                                                         | `PUT /projects/favorites {entityType, entityId, kind, on}`; task stars from `GET /favorites?kind=favorite`                                                                                                                                                                                        | –                                                                                 |
| Change Cover                                                                              | `POST /files` (module `projects`), `PUT /workspaces/{id}/cover {fileId \| null, rowVersion}`; the banner draws `cover.url`                                                                                                                                                                        | `projects.workspaces.edit` and admin / HR                                         |
| Members popover                                                                           | from `members` of the workspace (role shown per person)                                                                                                                                                                                                                                           | –                                                                                 |
| Invite Members                                                                            | `POST /workspaces/{id}/members {members: [{employeeId, memberRole: contributor}]}`                                                                                                                                                                                                                | `projects.workspaces.edit` and admin / HR                                         |
| "+ View"                                                                                  | `POST /workspaces/{id}/views {viewType, name}`                                                                                                                                                                                                                                                    | admin / HR (shared views)                                                         |
| Columns: hide, show, move, delete, Customize                                              | `PUT /views/{id}` (`config.columns`) of the caller's private List view, or of the workspace's when the caller is admin / HR; a member without a private one gets `POST /workspaces/{id}/views {isPrivate: true}`                                                                                  | any member                                                                        |
| Set Role Permission                                                                       | `PUT /workspaces/{id}/column-permissions/{columnKey}` (`start_date`, `cf_<labelsFieldId>` …)                                                                                                                                                                                                      | `projects.workspaces.edit` and admin / HR; not on Task Name                       |
| List view rows                                                                            | `GET /workspaces/{id}/tasks?listId&groupBy=none&sortBy=manual&subtasks=expanded` (all pages)                                                                                                                                                                                                      | –                                                                                 |
| Add Task / Milestone (inline row, view bar)                                               | `POST /projects/tasks {workspaceId, taskListId, statusId, name, taskType}`                                                                                                                                                                                                                        | `projects.tasks.create` and team leader or above                                  |
| Dependencies "Create New Task"                                                            | same                                                                                                                                                                                                                                                                                              | same                                                                              |
| Rename, Task Type, dates + time, recurrence, priority, description, time estimate, rating | `GET /tasks/{id}` → `PUT /tasks/{id}` (whole fields + rowVersion)                                                                                                                                                                                                                                 | `projects.tasks.edit`                                                             |
| Status                                                                                    | `PATCH /tasks/{id}/status {statusId, rowVersion}`                                                                                                                                                                                                                                                 | same                                                                              |
| Assignees, story points                                                                   | `PUT /tasks/{id}/assignees {assignees: [{employeeId, storyPoints}]}`                                                                                                                                                                                                                              | same (the API asks `projects.tasks.assign`)                                       |
| Tags                                                                                      | `GET/POST /workspaces/{id}/tags`, `PUT/DELETE /tags/{id}`, `PUT /tasks/{id}/tags {tagIds}`                                                                                                                                                                                                        | same                                                                              |
| Labels                                                                                    | the workspace's custom field of type `labels`: `POST /workspaces/{id}/custom-fields` (first label), `PUT /custom-fields/{id}` (add, rename an option), `DELETE /custom-fields/{id}` (last one), `PUT /tasks/{id}/fields/{fieldId} {value: [names]}`                                               | same                                                                              |
| Dependencies popup                                                                        | `GET /tasks/{id}` (`dependencies`), `POST /tasks/{id}/dependencies {otherTaskId, kind}`, `DELETE /dependencies/{id}`                                                                                                                                                                              | same                                                                              |
| Move To                                                                                   | `POST /tasks/{id}/move {workspaceId, taskListId, parentTaskId: null, rowVersion}`; other workspaces' lists from `GET /workspaces/{id}` when the menu opens                                                                                                                                        | team leader or above                                                              |
| Convert to Subtask / to Task, drag and drop                                               | `POST /tasks/{id}/move {parentTaskId \| taskListId, sortOrder}`                                                                                                                                                                                                                                   | same                                                                              |
| Convert to List                                                                           | `POST /tasks/{id}/convert-to-list {rowVersion}`                                                                                                                                                                                                                                                   | `projects.lists.create` and manager or above                                      |
| Delete (row, bulk)                                                                        | `DELETE /tasks/{id}?rowVersion=`                                                                                                                                                                                                                                                                  | `projects.tasks.delete`                                                           |
| Remind Me                                                                                 | `GET /reminders?entityType=task&entityId=`, `POST /reminders`, `PUT /reminders/{id}`, `DELETE /reminders/{id}`                                                                                                                                                                                    | `projects.reminders.create`                                                       |
| Board view (`?view=board`)                                                                | the List view's rows; a move: `PATCH /tasks/{id}/status` with the column's status and `POST /tasks/{id}/move {sortOrder}` (the List view's reorder); Add Task: `POST /tasks {statusId}`                                                                                                           | move: `projects.tasks.edit`; Add Task: team leader or above                       |
| Calendar and Timeline views (`?view=calendar`, `?view=timeline`)                          | the List view's rows; a move or resize: `PUT /tasks/{id}` with `startDate` / `dueDate` (the List view's task update, times kept); the task popup uses the List view's date cells                                                                                                                  | moving: `projects.tasks.edit` and the date columns editable                       |
| Table view (`?view=table`)                                                                | the List view's rows and cell calls; Export CSV is built in the browser from the rows shown (no task export route)                                                                                                                                                                                | as the List view                                                                  |
| Activity view (`?view=activity`)                                                          | `GET /workspaces/{id}/activity?page&pageSize=30&q&action&fromDate&toDate` (`ActivityOut`), a page per "Load more"; Export CSV is built in the browser from the lines loaded                                                                                                                       | reading the workspace                                                             |
| Team view (`?view=team`)                                                                  | the List view's rows only (no workload route): open tasks per assignee and status, `isOverdue`, `dueDate`, `closedAt`, story points, `timeEstimateMinutes`                                                                                                                                        | reading the workspace                                                             |
| Overdue tab (`?overdue=true`)                                                             | the List view's rows (`GET /workspaces/{id}/tasks`, `includeClosed` defaults to true): `isOverdue` → Overdue, `isClosedLate` → Closed late, `originalDueDate` beside the due date; each row's `GET /tasks/{id}` for its `extensions`                                                              | –                                                                                 |
| Request Extension (row menu, Overdue tab)                                                 | `POST /tasks/{id}/extension-requests {newDueDate, reason}` → `TaskOut`; offered to the task's assignees on an open task with a due date                                                                                                                                                           | `projects.tasks.edit`, contributor or above                                       |
| Approve / Reject an extension                                                             | `PATCH /extension-requests/{id}/approve \| reject {remarks, rowVersion}` → `TaskOut` (remarks required to reject)                                                                                                                                                                                 | `projects.tasks.edit`, manager or above, not the requester                        |
| Reminders page (`/project-management/reminders`)                                          | `GET /reminders?includeDone=` (all pages), Change time `PUT /reminders/{id} {entityType, entityId, name, remindAt, notifyBeforeMinutes, rowVersion}`, `DELETE /reminders/{id}`                                                                                                                    | `projects.reminders.create`                                                       |
| Sharing & Permissions                                                                     | `GET /shares?entityType=task&entityId=`, `PUT /shares`                                                                                                                                                                                                                                            | open: `projects.sharing.view`; Save: `projects.sharing.edit` and manager or above |
| Comments panel                                                                            | `GET /tasks/{id}/comments`, `POST /tasks/{id}/comments {body, parentId, mentions}`, `PUT /comments/{id} {body, mentions, rowVersion}`, `PATCH /comments/{id}/assign`, `PATCH /comments/{id}/resolve`, `PUT /comments/{id}/reaction {reaction: like \| null}`, `DELETE /comments/{id}?rowVersion=` | –                                                                                 |
| Files                                                                                     | `GET /tasks/{id}/attachments` (when the popup opens), `POST /files` (module `projects`, with progress) then `POST /tasks/{id}/attachments {fileId}`, `DELETE /attachments/{id}`; names link to the signed `url`                                                                                   | upload / remove: `projects.tasks.edit`                                            |
| Time Tracked                                                                              | `GET /tasks/{id}/time-entries` (when the popup opens), `POST /tasks/{id}/timer/start`, `POST /timer/stop`, `POST /tasks/{id}/time-entries {startAt, endAt \| minutes, notes}`, `DELETE /time-entries/{id}`                                                                                        | `projects.time_tracking.create` / `.delete`                                       |

Inside a workspace the caller's workspace role (`myRole`) decides as the backend does (admin 5, HR 4, manager 3,
team leader 2, contributor 1, a reader who is not a member 0; `hooks/use-pm-access.ts`), on top of the company
codes (`useCan`). Cells of a column the caller may only view (`myLevels`: Can View / Private Field) are inert;
columns in `hiddenColumns` (Private Field) are not drawn. In mock mode (no permissions list) every code passes and
the caller is Shelley Kannes, admin of the sample workspaces.

## Shape changes

- **Workspace**: `visibility` ← `privacy`; `department` (a name) → `departmentId` / `departmentName`;
  `template` is the API's code (`work_starter` …) with `templateName`; `memberIds` → `members[{employeeId, name,
designation, department, role}]` (`memberIds` stays, derived); new `myRole`, `myLevels`, `cover` (`FileRef`),
  `views[]`, `items` (folders as `folder:<id>` and lists), `labelsFieldId`, `rowVersion`. Gone: `coverUrl`,
  `createdById`. `setup.views` / `defaultView` come from the shared workspace views; `setup.organizer` from
  `features`; `statusTemplate` may be null.
- **Wizard request**: `department` → `departmentId`; `template` → `workflowTemplate` (code); statuses go without
  ids; views go as `{viewType, isDefault}`; organizer as `features[{featureCode}]` (`add-fields` →
  `custom_fields`, `sprint-points` → `sprints`, `incomplete-warnings` → `incomplete_warning`,
  `dependencies-warnings` → `dependency_warning`); members as `{employeeId, memberRole: contributor}`. The owner
  and the creator become workspace admins on the server.
- **Templates**: read from `GET /projects/templates` (workflow and status kinds) instead of frontend constants, so
  the Define Workflow cards show the API's names and descriptions ("Everyday tasks.") and the status templates
  are Normal/Custom, Content, Kanban, Marketing and Scrum with the API's statuses.
- **Column permission**: frontend keys ↔ API column keys (`startDate` ↔ `start_date`, `labels` ↔
  `cf_<labelsFieldId>`); levels `can-edit` ↔ `can_edit`; roles `managers` ↔ `manager`, `team-leaders` ↔
  `team_leader`, `contributors` ↔ `contributor`, `workspace-admin` ↔ `workspace_admin`.
- **Columns** (order, shown / hidden, deleted) are the List view's `config.columns: [{key, visible}]` (API keys);
  a view without config shows the design's first five.
- **Task row**: `listId` ← `taskListId`, `parentId` ← `parentTaskId`, `type` ← `taskType`, `order` ← `sortOrder`;
  `code` is `HR000000001` (no `#`; mentions write `#HR…`); new `assignees[{employeeId, name, storyPoints}]`,
  `timeTrackedMinutes`, `attachmentCount`, `openDependencyCount`, `blockingCount`, `isOverdue`, `listName`,
  `createdByName`, `cover`, `rowVersion`; `storyPoints` derived from the assignees; `labelIds` from list-valued
  custom field values (`<fieldId>:<option>`); `latestComment.authorName` (was `authorId`). Gone from the row:
  `timeEntries`, `timerStartedAt`, `attachments`, `waitingOn` / `blocking`, `reminderAt`, `invitedEmails`,
  `createdById` (each now read on demand: `TimeEntry[]`, `Attachment[]`, `TaskDetail.dependencies`, `Reminder`).
- **Time entry**: `{date, start, end, minutes, notes}` read from `startAt` / `endAt` (local time) plus
  `employeeName`, `isRunning`, `rowVersion`; new entries go as instants.
- **Attachment**: `{id, fileId, name, mimeType, size, uploadedByName, uploadedAt, url}`; `source` is gone.
- **Comment**: `resolved` ← `isResolved`; names come with it (`authorName`, `assignedToName`, `assignedByName`,
  `resolvedByName`); `likedByIds` ← reactions `like`; other reactions kept in `reactions`; `rowVersion`.
  `CommentPatch.likedByIds` → `liked` (the caller's own reaction). Mentions are sent as `mentions[{employeeId |
taskId}]`, read from the `@Name` / `#HR…` text.
- **Tag**: no `kind` on the API; labels are options of the Labels custom field (no colours: the palette is used).
- **Share**: `targetId` → `entityType` + `entityId`; access `full-edit / edit / view` → `full_edit / limited /
commenter` (Full Edit, Limited, Commenter); `invitedEmails` go as members `{email, accessLevel: limited}`;
  `linkEnabled` ↔ `isPublic`; property ids are the API's codes (12, all on by default; Custom Fields and
  Checklists added); `link` (private link) comes from the API once saved.
- **People**: `GET /projects/people` (`designationName`, `departmentName`, `photoUrl`); "me" is the signed-in
  user's `employeeId` (`usePmMe`), null for an account without an employee.

## UI changes

- Change Cover: uploads an image (PNG, JPG, GIF, WebP up to 5 MB) or removes it; the gradient presets are gone
  (the API keeps a file only).
- Workspaces panel: "+" offers Folder and List; Doc and doc rows are gone (no docs in the API).
- Add Assignee: the candidates are the workspace's members (the API refuses others); "Invite from email" is gone.
- Files: upload is a real upload with progress; accepted types PDF, DOCX, XLSX, PNG, JPG up to 10 MB; names link to
  the signed download; the cell shows "n files" until the popup has read the names.
- Dependencies cell: "Waiting On n tasks" / "Blocking n tasks" from the row's counts; the popup lists the links.
- Time Tracked: the running timer shows once the popup has read the entries; a typed duration is one entry ending
  now; entries of other people show their names from the API.
- Labels: no colour picker (options carry no colour); a label's first creation makes the "Labels" field.
- Comments: the mention menu's Docs tab is disabled like Locations.
- Status templates: Normal/Custom is a template with its own statuses (it no longer stands for the workflow's
  statuses); choosing custom statuses leaves the template unselected until one is picked; a template made in the
  wizard records no status template.
- Sharing: Save is hidden without `projects.sharing.edit` (manager or above); Copy private link waits for a save.
- Hidden without rights (see the table): Create Workspace, Add Task (view bar, groups, empty state), "+ View",
  Rename / Description / Cover / Invite Members, Add Role Permission, panel "+", row menu items (Rename, Move To,
  Convert, Task Type, Remind Me, Sharing, Delete), upload / remove file, timer, delete time entry.
- Drag and drop: the API keeps whole sort orders; when no whole number fits between two rows the siblings are
  renumbered (10, 20, 30 …).
- Members popover: each person's workspace role (Owner, Managers, …).
- Overdue handling (27 Oct 2026; not drawn, from the BRD): an **Overdue** tab after the views in the view bar, with
  the count of open overdue tasks, lists Overdue (open, past due: days late) and Closed late (closed after the due
  date), each with assignees, the due date and the first one when an extension moved it, and the task's latest
  extension request (Asked for … / Extended to … / Extension rejected). Assignees **Request Extension** (row menu or
  the tab; again after a rejection); managers and above **Approve** or **Reject** (with remarks) a request they did
  not make. A task name opens it in the List view. The List view says "overdue" on a past due date (red) and puts a
  **Closed late** chip after a late task's name. No story-point penalty is shown until it is defined (T5).
- **Reminders** (side menu → Project Management → Reminders; not drawn): the caller's reminders, soonest first, with
  "Show sent and past reminders"; Upcoming / Sent / Past; a task's name opens it; Change time reuses the Remind Me
  calendar; Delete asks first. Delivery as notifications waits for the server (T4).

## Mocks

`src/mocks/project-management` now answers the backend's routes under `/api/projects` with the backend's shapes
(records as the `pm` schema keeps them in `db.ts`, shaped by `handlers.ts`), including templates (copied from
`db/seeds/0150_pm_templates.sql`), people, views, folders, lists, column permissions (with `myLevels` and blanked
private columns), custom fields, tags, favourites, tasks (status move, assignees, tags, field values, move,
convert to list, dependencies), comments (assign, resolve, reactions), attachments, time entries and the timer,
reminders (`includeDone`; two seeded for Shelley, one sent) and shares, and extension requests (assignee asks
with a date after the due date; manager or above, not the requester, answers; approving keeps the first due date
as `originalDueDate`). Tasks carry `isClosedLate` (closed on a later day than due) and `originalDueDate`. The
QA Testing Phase workspace has the overdue examples: two open tasks past due (one Shelley's, one with Areeba
Hameed's waiting request) and one closed late. Workspace roles are enforced loosely (what the screens hide). Storage keys are new
(`hrms-mock-pm-v2-*`) so old session data is ignored. It also serves `GET /organisation/lookups/departments` from
the directory's departments.

## Gaps and findings

Backend (route: what is wrong or missing):

- `POST /api/projects/workspaces` with `privacy: private` by an account without an employee (the dev administrator):
  the workspace **is created** (a second try answers 409 WORKSPACE_DUPLICATE) but the answer is **404 Workspace
  not found**, because the creator is not a member and cannot read it. It should refuse before creating, or
  answer 201.
- The dev administrator has no employee, so in every workspace `myRole` is null (rank 0): it cannot add tasks
  (403 "Only team leaders and above add tasks"), tags, folders, lists, column permissions, edit a workspace, keep
  views (403 "Only workspace members can keep views") or favourites (403 "Only employees can keep favourites").
  Company Administrator does not reach inside workspaces. Live checks of task, comment and attachment calls were
  therefore not possible with the dev account (shapes were checked against the Pydantic schemas instead, and the
  calls through the mock). Needed: a dev user linked to an employee, or a rule for company administrators.
- `TaskRowOut` has counts only for dependencies, files and time; the row cannot show the first linked task's or
  file's name without a call per row.
- `TaskRowOut.createdBy*` is a user (id and name), not an employee: no photo or designation for "Created by".
- `GET /projects/people` has no department id; departments come from `/organisation/lookups/departments`.
- No API for status templates (wizard-made templates live in the wizard), for docs, for inviting assignees by
  email, for third-party file sources, for cover presets, or for label colours.
- `ViewOut.config` is free-form: this frontend defines `config.columns`. `PUT /views/{id}` replaces
  `isPinned` / `isProtected` too (sent as defaults).

Frontend (API available, not drawn or not wired):

- Extension requests: who may ask and answer, and whether a second request may follow a rejection, are not in the
  spec; the screens and the mock assume assignees ask, managers and above (not the requester) answer, and one
  request at a time (a rejected one may be followed by another). `TaskRowOut` has no extension status, so the
  Overdue tab reads each task's detail; a `latestExtension` on the row would save those calls.
- `GET /reminders` without `entityType` is read as "all of the caller's reminders"; `includeDone` as sent or past.
- Workspace history (Activity view): `actionName` and `fieldName` values are not documented. The screen and the
  mock assume `created`, `updated` (one line per changed field: `name`, `description` (no values), `status`,
  `priority`, `start_date`, `due_date`, `assignees`, `task_list`), `deleted`, `commented`, `extension_requested`,
  `extension_approved` (with `due_date` old and new) and `extension_rejected`; values as people read them
  (status and list names, assignee names joined with ", ", dates `yyyy-MM-dd`, priority keys). Any other action or
  field is shown with its name made readable (`due_date` and `dueDate` both read "Due date"). `q` is assumed to
  look in the item's name and code and the person's name; `fromDate` / `toDate` are sent as `yyyy-MM-dd` and read
  as inclusive (the mock compares the UTC date). `performedByUserId` is a user id, so the avatar is matched to the
  directory by `performedByName`; an employee id on `ActivityOut` would make that exact.
- Checklist, task history (`GET /tasks/{id}/activity`), custom fields other than Labels, list settings
  (privacy, dates, members), folder / list rename and delete, workspace delete, statuses and features after
  creation (`PUT …/statuses`, `PUT …/features`), task cover, member role change and removal
  (`pmApi.changeMemberRole` / `removeMember` exist, no screen), the List view's server-side filters, grouping and
  sorting (the List view still filters and sorts the loaded rows), reminders on lists and workspaces.

Shared files (not changed here):

- `src/mocks/auth/handlers.ts`: `DEMO_USER` has no `employeeId`; with `employeeId: 'em_shelley'` mock mode would
  know "me" (edit / delete own comments, likes, the running timer). The tests set it on the session.
- `src/mocks/files/handlers.ts`: uploads are private to that file; exporting a lookup of an upload's name would let
  the PM mock name attachments (today `rememberUpload` in the PM mock is fed by the test). In jsdom, undici cannot
  parse the multipart body (`request.formData()` throws), so the files mock's upload fails in tests; the PM test
  replaces it for its upload.
- `GET /organisation/lookups/departments` is served by the PM mock; if the organisation mocks add it, the PM copy
  can go.
