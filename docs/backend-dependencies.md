# Backend dependencies (frontend gaps)

Endpoints the frontend needs and the HRango API (`/openapi.json`, checked 27 Oct 2026, 620 paths)
does not have yet. Each entry gives the method, path, request and response the UI will be built
against. Until an entry exists, its screen calls a typed API function marked
`// TODO(backend): endpoint not available`, answered by the MSW mock in development only; in
backend mode the screen says the feature is waiting for the server. Nothing below is "done".

Conventions (as the existing API): JSON bodies; ids are strings in responses and integers in
requests; one record answers `{ data: T }`, a page `{ data: T[], meta: { page, pageSize, total,
totalPages } }`; every edit carries `rowVersion`; errors are `{ message, code?, fieldErrors? }`
with 4xx / 5xx. Permission codes follow the module's existing pattern.

## Requests

### R1. Generate a request's application text (AI)

Used by Transfer, Travel, WFH, Punch, Leave, Loan, Promotion and Relaxation (replaces the
template-based Regenerate of Transfer and Travel).

`POST /api/requests/{type}/application/generate` (`{type}` as in `/api/requests/{type}`)

```ts
// request: the form as filled so far (same fields as RequestIn_<Type>Details_, all optional)
{
  employeeId?: number | null        // filing for someone else
  fromDate?: string | null          // yyyy-MM-dd
  toDate?: string | null
  reason?: string | null
  description?: string | null
  details?: Record<string, unknown> // the type's details object
  tone?: 'formal' | 'neutral'       // default 'formal'
  language?: string                 // default 'en'
}
// 200
{ data: { text: string /* HTML: <p>, <ul>, <strong> only */, generatedAt: string } }
// 422 { message, fieldErrors } when there is not enough to write from
// 503 { message, code: 'AI_UNAVAILABLE' } → the UI keeps the manual editor
```

Permission: the type's `.create` code. The text is stored in the request's existing `application`
field on save; nothing else changes.

### R2. WFH cancellation with times

The design's approver "WFH Cancel" has Start Time and End Time. `CancelIn` is `{ reason,
rowVersion }` only.

`POST /api/requests/work-from-home/{id}/cancel` and `POST /api/requests/approvals/{id}/cancel`
accept, for WFH:

```ts
{ reason: string, rowVersion: string, dates?: string[] /* yyyy-MM-dd */, startTime?: string /* HH:mm */, endTime?: string }
// 200 Item_RequestDetailOut_ (as today)
```

Pending product answer: what cancelling a WFH day "from–to" a time means (see questions).

### R3. Punch "Request Flow" filter (only if approved)

`GET /api/requests/punch?…&flowStep=<authority code>` (also on `/requests/approvals`): requests
waiting at that step. Response unchanged.

### R4. Request export format (confirm, no new endpoint)

`GET /api/requests/{type}/export` exists for every type, with the list's filters (`view, status,
q, employeeId, departmentId, branchId, locationId, from, to`), but the spec types its 200 as
`application/json` with an empty schema. The Attendance exports declare `text/csv`. Overtime's
Export button (My Overtime, Bulk Applications) downloads the body as a `.csv` file, so it expects:

```text
200 Content-Type: text/csv; charset=utf-8
    Content-Disposition: attachment; filename="overtime-….csv"   (optional; the UI names it otherwise)
first line: column headers; one row per request in the list's order, every page
```

If the API returns JSON or `.xlsx` instead, the download keeps working but gets the wrong file
extension; tell the frontend which, and the button will follow it.

Also unconfirmed for Overtime: the permission codes. The spec lists none; the screens use
`requests.overtime.create` (Apply, Edit, add images), `requests.overtime.cancel` (Withdraw,
Cancel, Delete) and `requests.approvals.approve` / `.reject` (Forward, Reject Selected), as the
other request types do.

## Payroll

### P1. Payroll close email

```
GET  /api/payroll/payrolls/{id}/close-email/preview
     → { data: { enabled: boolean, subject: string, bodyHtml: string, recipientCount: number } }
POST /api/payroll/payrolls/{id}/close   (existing) → add to the response:
     { …, email: { status: 'disabled' | 'queued' | 'sent' | 'failed', sentCount: number, failedCount: number } }
GET  /api/payroll/payrolls/{id}/close-email
     → { data: { status, queuedAt, sentAt, sentCount, failedCount, failures: { employeeId, employeeName, error }[] } }
```

### P2. Salary revision email

```
GET  /api/payroll/salary-revisions/{id}/email/preview → { data: { subject, bodyHtml, to: string } }
POST /api/payroll/salary-revisions/{id}/email  { rowVersion } → { data: { status: 'queued' | 'sent' | 'failed', sentAt } }
SalaryRevisionOut: add emailStatus ('none' | 'queued' | 'sent' | 'failed' | 'disabled') and emailedAt
```

### P3. Bank transfer file

```
GET /api/payroll/payrolls/{id}/bank-file?disbursementBankId=<id>&format=csv|txt|xlsx
    → 200 file (Content-Disposition: attachment; filename=…), 409 { code: 'PAYROLL_NOT_CLOSED' }
GET /api/payroll/daily-wages/{id}/bank-file?disbursementBankId=<id>&format=…   (same)
GET /api/payroll/bank-file-formats → { data: { code: string, name: string, extension: string }[] }
```

### P4. Leave encashment preview (optional)

The encashed days are worked out on the server, so the form cannot check them against the leave
type's `encashmentMin` / `encashmentMax` before saving.

```
POST /api/payroll/leave-encashments/preview
     { leaveTypeId, fiscalYear, allEmployees, employeeIds, basis, amountPerLeave }
     → { data: { employeeId, employeeName, availableDays, encashableDays, cappedBy: 'min' | 'max' | null, amount }[] }
```

Until it exists, the form (27 Oct 2026) shows the chosen type's limits under Leave Type (read from
`GET /leaves/types`: `allowEncashment`, `encashmentMin`, `encashmentMax`) and refuses a type whose
Encashment is off before saving. Please confirm how `POST/PUT /api/payroll/leave-encashments`
applies the limits; the mock and the screen assume:

- a type with `allowEncashment: false` is refused: `422`, `fieldErrors.leaveTypeId`;
- a person with fewer days left than `encashmentMin` is left out, and one with more than
  `encashmentMax` is paid for `encashmentMax` days;
- when nobody is left: `422`, `fieldErrors.employeeIds` with the reason (the form shows it under
  Employees).

## Project and Task Management

### T1. Docs

```
GET    /api/projects/workspaces/{workspaceId}/docs?folderId&listId&q&page&pageSize → page of DocOut
POST   /api/projects/workspaces/{workspaceId}/docs  DocIn → { data: DocOut }
GET    /api/projects/docs/{id} → { data: DocOut }
PUT    /api/projects/docs/{id}  DocIn → { data: DocOut }
DELETE /api/projects/docs/{id}?rowVersion=
PATCH  /api/projects/docs/{id}/archive { rowVersion }
POST   /api/projects/docs/{id}/duplicate { title } → { data: DocOut }
PUT    /api/projects/docs/{id}/tasks { taskIds: number[] }            // link to tasks
GET    /api/projects/docs/{id}/export?format=pdf|docx → file
GET    /api/projects/docs/{id}/comments, POST … { body } (as task comments)

DocIn  { title: string (1–50), content: object /* editor JSON */, contentHtml: string,
         visibility: 'private' | 'workspace' | 'public', folderId?: number | null,
         listId?: number | null, coverFileId?: number | null,
         settings?: { fontFamily, fontSize, header: { cover, title, subtitle, owner,
         contributors, updatedAt, toc } }, rowVersion?: string }
DocOut DocIn + { id, workspaceId, ownerId, ownerName, contributors: { id, name }[],
         wordCount, characterCount, readingMinutes, linkedTaskIds: string[],
         createdAt, updatedAt, rowVersion }
```

The Workspace and Project dashboards list docs with
`GET /api/projects/workspaces/{workspaceId}/docs?folderId&page=1&pageSize=6` (most recently
updated first; fields used: `id, workspaceId, title, folderId, listId, ownerName, wordCount,
updatedAt`). Meanwhile (27 Oct 2026) the Docs widget shows "Not available yet" against the real API.

### T2. Writing with AI (docs, task descriptions)

```
POST /api/projects/ai/write
     { action: 'improve' | 'summarize' | 'template' | 'email' | 'table' | 'blog' | 'continue',
       prompt?: string, text?: string /* selection */, context?: { docId?, taskId? } }
     → { data: { html: string } }      // 503 { code: 'AI_UNAVAILABLE' }
```

### T3. Notepad

```
GET    /api/projects/notes?archived=false&q&page&pageSize → page of NoteOut
POST   /api/projects/notes { title, contentHtml } → { data: NoteOut }
PUT    /api/projects/notes/{id} { title, contentHtml, rowVersion } → { data: NoteOut }
PATCH  /api/projects/notes/{id}/archive { rowVersion }
DELETE /api/projects/notes/{id}?rowVersion=
GET    /api/projects/notes/{id}/history → { data: { version, title, contentHtml, editedAt, editedByName }[] }
POST   /api/projects/notes/{id}/convert
       { to: 'task' | 'doc', listId?: number, workspaceId?: number, original: 'delete' | 'archive' | 'keep' }
       → { data: { taskId?: string, docId?: string } }
NoteOut { id, title, contentHtml, archived, createdAt, updatedAt, rowVersion }
```

### T4. Reminder delivery

`/api/projects/reminders` CRUD exists and keeps `notifiedAt`. Needed: a scheduler that, at
`remindAt − notifyBeforeMinutes`, creates an inbox notification (`GET /api/inbox/notifications`)
for the assignee and sets `notifiedAt`:

```
InboxNotification { …, type: 'projects.reminder', entityType: 'task' | 'list' | 'workspace' | 'doc',
                    entityId: string, link: string /* app path */, title: string }
```

Meanwhile (27 Oct 2026) the Project Management → Reminders page lists the caller's reminders from
`GET /api/projects/reminders` (Upcoming / Sent from `notifiedAt` / Past), with Change time and
Delete; nothing reaches the notification bell.

### T5. Story-point penalty for late work

`TaskOut` has `storyPointsTotal`, `isClosedLate` and `extensions`. Needed once the rule is agreed:

```
TaskOut: add storyPointsPenalty: number | null, storyPointsEffective: number | null
GET /api/projects/workspaces/{id}/settings/overdue → { data: { penaltyPercent: number, maxExtensions: number } }
```

Meanwhile (27 Oct 2026) the Overdue tab shows "Closed late", both due dates and the extension
request, and no penalty. Also useful: `latestExtension: { status, newDueDate } | null` on
`TaskRowOut`, so the tab need not read each task's detail.

### T6. Public share page

`/api/projects/shares` stores the link (`token`, `validFrom`, `validTo`, `maxAccess`). Needed: a
route that works without signing in, enforcing those limits.

```
GET /api/public/shares/{token}
    → { data: { entityType: 'list' | 'view' | 'task', title: string, allowOpenTasks: boolean,
                properties: string[], tasks: PublicTaskRow[] } }
GET /api/public/shares/{token}/tasks/{taskId} → { data: PublicTask }
410 { code: 'SHARE_EXPIRED' | 'SHARE_EXHAUSTED' }, 404 { code: 'SHARE_NOT_FOUND' }
```

Invitations: sending the email when `ShareIn.members[]` has an `email` is server-side.

### T7. Dashboards

The task list is per workspace; the Home dashboard spans workspaces.

```
GET /api/projects/dashboard/home
    → { data: { recents: { type, id, name, workspaceId, openedAt }[],
                agenda: { taskId, name, dueDate, dueTime, workspaceId }[],
                myWork: TaskRowOut[], assignedComments: CommentOut[],
                activity: { date: string, completed: number, assigned: number }[] } }
GET /api/projects/workspaces/{id}/dashboard
    → { data: { byStatus: { statusId, name, color, count }[], byAssignee: { employeeId, name, open, total }[],
                dueThisWeek: number, overdue: number, completedThisWeek: number, unassigned: number,
                recentDocs, bookmarks, resources } }
GET /api/projects/folders/{id}/dashboard   (Project dashboard: same shape, one folder)
```

Workspace and Tasks dashboards can start from `GET …/tasks` with its filters; these aggregates are
for large workspaces.

Recents (Home, Workspace and Project dashboards):

```
GET  /api/projects/recents?workspaceId&folderId&limit=8
     → { data: { entityType: 'workspace' | 'folder' | 'task_list' | 'task' | 'doc', entityId,
                 name, workspaceId, workspaceName: string | null, openedAt /* UTC */ }[] }   // newest first
POST /api/projects/recents { entityType, entityId } → 204      // recorded when a workspace, list, task or doc opens
```

Meanwhile (27 Oct 2026) the four dashboards compute everything from `GET /projects/workspaces`,
each workspace's `GET /projects/workspaces/{id}` and `GET …/tasks` (all pages),
`GET /tasks/{id}/comments` (Assigned Comments) and `GET /tasks/{id}/attachments` (Resources and
files). Recents shows "Not available yet" against the real API. Recording a visit also needs a
`POST /projects/recents` call from the workspace page and the task screen, not added yet.

### T8. Map view

Custom field types have no `location`. Needed: `fieldType: 'location'` with value
`{ address: string, lat: number, lng: number }`, and `GET …/tasks?hasLocation=true`.

### T9. External file sources (Google Drive, Dropbox, Box, OneDrive)

```
GET    /api/integrations/storage → { data: { provider, connected, accountEmail, connectedAt }[] }
POST   /api/integrations/storage/{provider}/connect { redirectPath } → { data: { authUrl } }
GET    /api/integrations/storage/{provider}/callback   (server-side OAuth callback, redirects to redirectPath)
DELETE /api/integrations/storage/{provider}
GET    /api/integrations/storage/{provider}/files?path&q&pageToken → { data: { id, name, mimeType, size, webUrl, isFolder }[], nextPageToken }
POST   /api/projects/tasks/{taskId}/attachments/link { provider, externalId, name, webUrl } → { data: AttachmentOut }
```

### T10. AI automation (only the items approved for UI)

| #   | Feature                         | Endpoint the UI would call                                                         |
| --- | ------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | Daily task line-up              | `GET /api/projects/ai/line-up?date` → ranked tasks with a reason each              |
| 2   | Standup summaries               | `GET /api/projects/ai/standup?scope=me\|team&workspaceId&from&to` → `{ html }`     |
| 3   | Smart reminders                 | `POST /api/projects/ai/reminders/suggest { taskId }` → suggested times             |
| 4   | At-risk extensions              | `GET /api/projects/ai/at-risk?workspaceId` → tasks with predicted delay            |
| 5   | Automated assignment            | `POST /api/projects/ai/assign/suggest { taskId }` → ranked employees with reasons  |
| 6   | Dependency risk                 | `GET /api/projects/ai/dependency-risk?workspaceId` → blocked chains at risk        |
| 7   | Overdue / story-point upkeep    | server job only (no UI beyond T5)                                                  |
| 8   | Document suggestions            | `POST /api/projects/ai/doc-suggest { docId?, title }` → templates / outline        |
| 9   | Task & document recommendations | `GET /api/projects/ai/related?taskId` → docs, files, similar tasks                 |
| 10  | Automatic progress updates      | server job; UI shows "updated by AI" in activity                                   |
| 11  | Comment suggestions             | `POST /api/projects/ai/comment-suggest { taskId }` → short replies                 |
| 12  | Predictive due-date extensions  | `GET /api/projects/ai/extension-suggestions?workspaceId`                           |
| 13  | Adaptive reminders              | server job; UI uses T4                                                             |
| 14  | Smart search                    | `GET /api/projects/ai/search?q` → ranked tasks, docs, lists                        |
| 15  | Workload rebalancing            | `GET /api/projects/ai/workload?workspaceId` → suggested reassignments              |
| 16  | Project summaries               | `GET /api/projects/ai/summary?folderId\|workspaceId&from&to` → `{ html, metrics }` |

All answer `503 { code: 'AI_UNAVAILABLE' }` when the model is off, so the UI can hide the panel.

### T11. Personal List (Home Dashboard)

The BRD's Home "Personal List": the caller's own to-dos, not tied to a workspace.

```
GET    /api/projects/personal-list → { data: PersonalItemOut[] }
POST   /api/projects/personal-list { title: string (1–120), dueDate: 'yyyy-MM-dd' | null } → { data: PersonalItemOut }
PATCH  /api/projects/personal-list/{id} { done: boolean, rowVersion } → { data: PersonalItemOut }   // 409 when stale
DELETE /api/projects/personal-list/{id}?rowVersion= → 204
PersonalItemOut { id, title, done, dueDate, createdAt, rowVersion }
```

Meanwhile (27 Oct 2026) the widget shows "Not available yet" against the real API and sample data
from the development mock.

## Custom Form

Used by Forms (builder), My Forms and Responses (built 28 Oct 2026). No `/forms` endpoint exists.
Shapes: `src/features/custom-forms/api/custom-forms.dto.ts`. Proposed permission codes:
`forms.forms.view|create|edit|publish|delete`, `forms.responses.view|export`,
`forms.my_forms.view|submit`. Register `/forms/assigned` and `/forms/my-responses` before
`/forms/{id}`. Also wanted: a `forms` value for `POST /files` `module` (uploads use `core`
meanwhile).

### CF1. Forms (HR)

```
GET    /api/forms?q&status=draft|published|closed&page&pageSize → page of FormSummary (newest change first;
       q matches title, category and description)
GET    /api/forms/{id} → { data: Form }
POST   /api/forms  FormIn → 201 { data: Form } (a draft)
PUT    /api/forms/{id}  FormIn + { rowVersion } → { data: Form }
DELETE /api/forms/{id}?rowVersion= → 204 (its responses too); 409 FORM_HAS_RESPONSES while published with responses
POST   /api/forms/{id}/publish { rowVersion } → { data: Form }   draft or closed → published;
       422 without fields or with a past closesOn; 409 FORM_PUBLISHED
POST   /api/forms/{id}/close { rowVersion } → { data: Form }     409 FORM_NOT_PUBLISHED
POST   /api/forms/{id}/duplicate {} → 201 { data: Form }         a draft "Copy of …", new ids, no responses

FormSummary { id, title, description: string|null, category: string|null,
  status: 'draft'|'published'|'closed', closesOn: string|null /* yyyy-MM-dd, last day to answer */,
  audience: { kind: 'everyone'|'departments'|'branches'|'people', targets: { id, name }[] },
  fieldCount, responseCount, anonymous, updatedAt, publishedAt: string|null, rowVersion }
Form = FormSummary & { oneResponsePerPerson, createdBy: { id, name }|null, createdAt, closedAt: string|null,
  sections: { id, title, description: string|null, position }[], fields: Field[] }
Field { id, sectionId: string|null, position,
  type: 'short_text'|'long_text'|'number'|'date'|'single_choice'|'multiple_choice'|'dropdown'|'checkbox'|'file'|'rating',
  label, helpText: string|null, required, options: { id, label }[], min: number|null, max: number|null }
  // min/max: text → length; number → value; multiple_choice → picks; rating → max = scale (3–10)
FormIn { title, description, category, closesOn, audience: { kind, ids: number[] }, oneResponsePerPerson, anonymous,
  sections: { key: string /* unique in the request */, id: number|null, title, description }[],
  fields: { id: number|null /* with an id it keeps its answers */, sectionKey: string|null, type, label, helpText,
            required, options: { id: number|null, label }[], min, max }[] }
// 422 fieldErrors: title, closesOn, audience.ids, sections.{i}.title, fields.{i}.label|options|min|max|type
// 409 STALE_ROW_VERSION. With responses: 409 FORM_HAS_RESPONSES if a field with answers is left out;
// 422 if its type changes, one of its options is removed, or anonymous changes.
// A published form whose closesOn has passed reads as closed.
```

### CF2. Filling (everyone)

```
GET  /api/forms/assigned?q&page&pageSize → page of AssignedForm: published and closed forms whose audience
     includes the caller (never drafts), open ones first
GET  /api/forms/assigned/{id} → { data: AssignedForm & { sections, fields } }   404 when not meant for the caller
POST /api/forms/{id}/responses { answers: { fieldId: number, value: string|number|boolean|number[]|null }[] }
     → 201 { data: Response }
     // text / date → string (yyyy-MM-dd); number / rating → number; single choice / dropdown → option id;
     // multiple choice → option ids; checkbox → boolean; file → upload id (POST /files first)
     // 422 fieldErrors { 'answers.<fieldId>': message }; 409 FORM_NOT_PUBLISHED | FORM_CLOSED | ALREADY_RESPONDED;
     // 404 when not for the caller
GET  /api/forms/my-responses?q&page&pageSize → page of { id, formId, formTitle, category, anonymous, submittedAt }
     (the caller's own submissions, anonymous forms included)

AssignedForm { id, title, description, category, status, closesOn, fieldCount, oneResponsePerPerson, anonymous,
  myResponseCount, lastResponseId: string|null, lastSubmittedAt: string|null, canRespond }
```

### CF3. Responses (HR)

```
GET /api/forms/{id}/responses?q&page&pageSize → page of Response, newest first (q: respondent name or code)
GET /api/forms/{id}/responses/summary
    → { data: { total, fields: { fieldId, answered, counts: { value, count }[] }[] } }
    // single / multiple choice and dropdown (value = option id), checkbox (true / false), rating (1…n)
GET /api/forms/responses/{id} → { data: Response & { form: { id, title, description, anonymous, sections, fields } } }
    (for HR, or for the response's author)

Response { id, formId, respondent: { id, name, code: string|null, departmentName: string|null } | null /* null when anonymous */,
  submittedAt, answers: { fieldId, value, file: { id, name, url } | null }[] }
```

Meanwhile (28 Oct 2026): Forms, My Forms and Responses call these as typed pending functions
marked `// TODO(backend): endpoint not available`. In development the MSW mock answers them with
sample data and a "Sample data" badge; against the real API the list calls get 404 and each page
shows "Waiting for the server" instead of an error or made-up data.

## Other modules

- **Subscriptions, Help & Support:** no endpoints and no design. Nothing is requested
  until the screens are designed.
