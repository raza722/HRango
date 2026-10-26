# Settings → Control Panel, navigation, Dashboard, Inbox: frontend ↔ backend

Backend sources: `backend/app/routers/{organisation,employees,dashboard,inbox,auth}.py`, schemas of the same
names, permission codes in `backend/app/catalogue/{organisation,dashboard,inbox,access,...}.py`, decisions in
`comparison/01-organisation.md`. Every shape below was checked against the running API (dev database) on
2026-10-26: list envelopes, ids as strings, camelCase, `rowVersion`.

## Common changes

| Topic             | Before (mock)                                                                                                            | Now (API)                                                                                                                                                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paths             | `/settings/{branches,locations,areas,job-titles,general}`, `/companies`, `/employees`, `/geo/{countries,regions,cities}` | `/organisation/{branches,locations,areas,job-titles,general}`, `/organisation/lookups/{companies,locations,areas,…}`, `/employees/lookup`, `/organisation/geo/{countries,states,cities}`                                                                                                     |
| Search            | `?search=`                                                                                                               | `?q=` (`OrgListParams.search` is still the name in code; it is sent as `q`)                                                                                                                                                                                                                  |
| Company           | every Location / Branch form had a Company select; lists had a company filter and column                                 | Records belong to the **active company** (the user's current one; `X-Company-Id` switches). Company select, company filter and Company column removed. `companyName` is still in the records                                                                                                 |
| Edits and deletes | plain PUT / DELETE                                                                                                       | PUT body carries the `rowVersion` last read; DELETE sends `?rowVersion=`. Missing → 422 `fieldErrors.rowVersion`, stale → 409 "Someone else changed this … Reload it and try again" (shown as the error toast). `OrgResource.api.update(id, input, rowVersion)` and `remove(id, rowVersion)` |
| Empty text        | `''`                                                                                                                     | `null` (`toOptionalText`): description, employee prefix, legal name, email, phone, website, address                                                                                                                                                                                          |
| Field limits      | name 80, prefix 12, description 500                                                                                      | name 200, prefix 10, description 4000 (as `schemas/organisation.py`)                                                                                                                                                                                                                         |
| Record shape      | separate record and list-row types                                                                                       | one shape per record (`LocationRow = OrgLocation` etc.), with names and counts: `branchCount`, `employeeCount`, `headCount`; `updatedAt` is `null` until the first edit                                                                                                                      |
| Errors            | `DUPLICATE_NAME`, `IN_USE`                                                                                               | `<THING>_DUPLICATE` (409, `fieldErrors.name`), `CONFLICT` (409, message only), `VALIDATION_FAILED` (422, `fieldErrors`)                                                                                                                                                                      |

## Screens

### General Settings (`/settings/control-panel/general`)

- `GET /organisation/general`, `PUT /organisation/general` (`CompanyIn` + `rowVersion`).
- Shape: `GeneralSettings` is now the company record (`id, organizationName, legalName…, countryId, countryName,
timezone, currency, dateFormat, weekStartsOn, fiscalYearStartMonth, isActive, createdAt, updatedAt, rowVersion`);
  nullable fields become `''` in the form and `null` again on save.
- UI: **Country** select added (`countryId`, optional, from `/organisation/geo/countries`). Phone max 30, address 500,
  names 200. "Last saved" shows only when `updatedAt` is set.
- Permissions: without `organisation.general.edit` the form is read-only (fields disabled, no Save, Cancel reads Close).

### Branches (`/settings/control-panel/branches?q=&locationId=`)

- List `GET /organisation/branches?page&pageSize&q&locationId` (`areaId` also supported by `OrgListParams`); get /
  create / edit / delete `…/branches/{id}`.
- Form fields: Name, Employee Prefix, Location (from `/organisation/lookups/locations`), Area (from
  `/organisation/lookups/areas?parentId=<location>`), Manager, Description, Country → State → City, Latitude,
  Longitude, map. **Company removed.** Country / state / city are now **ids** (`countryId`, `stateId`, `cityId`;
  the record also carries `countryCode` / `stateCode` ISO codes and names).
- Manager picker: `GET /employees/lookup?permission=organisation.branches.create|edit&q&page&pageSize` (whom the user
  may pick through the code the form needs), searched on the server with Load more (see Employee pickers). Name with
  job title (or designation) below. The current manager keeps their name even if no page read has them.
- Choosing a location copies its pin to an empty branch (reads `GET /organisation/locations/{id}`; skipped silently
  if the user cannot read locations).
- List: company filter → **location filter**; Company column removed; **Employees** column added (`employeeCount`).
  Delete refused while employees are assigned (409, toast; the row comes back).

### Locations (`/settings/control-panel/locations?q=`)

- `/organisation/locations` (CRUD). Form: Name, Employee Prefix, Description, coordinates, map. **Company removed.**
- List: company filter and column removed; **Branches** column added (`branchCount`). Delete refused while it has
  branches or areas (409).

### Areas (`/settings/control-panel/areas?q=&locationId=`)

- `/organisation/areas` (CRUD, `?locationId=` filter). Form unchanged (Name, Location, Description); the Location
  select reads `/organisation/lookups/locations`. List gains **Branches** (`branchCount`).

### Job Titles (`/settings/control-panel/job-titles?q=`)

- `/organisation/job-titles` (CRUD). Form unchanged. Head Count column now shows the holders: "3 of 25" with a
  limit, "3 · No limit" without (`headCount`). Server rules shown on the field: max below current holders (409 on
  `maxHeadCount`), duplicate name (409 on `name`); delete refused while employees hold it.

### Control Panel menu, list pages, forms (all four)

- Menu entries hide without their view code: General `organisation.general.view`, Branch / Location / Area / Job
  Title `organisation.<thing>.view`, Users `access.users.view`. Subscriptions and Help (no API) always show.
- Lists hide **Add** without `.create`, **Edit** / **Delete** row actions without `.edit` / `.delete`, and the name
  is plain text (not a link to the form) without `.edit`. Forms are read-only without `.create` (new) or `.edit`.
- "Search Location" (geocoder) renders only in mock mode: the API has no geocoder (`LocationSearch` returns `null`
  when `VITE_ENABLE_MOCKS=false`; this also affects the scheduling geo-fence dialog and attendance geo-fencing tab
  that reuse it). Coordinates and the map remain.

### Lookups other features use (exported from `@/features/settings`)

- Kept: `branchResource`, `locationResource`, `useOrgList` (rows now have the API shape; `locationName` and `name`
  unchanged), `LocationSearch`, `companiesQueryOptions` (now `{id, name, isCurrent}`).
- Added: `employeesQueryOptions(params)` (`/employees/lookup`, one page `{data, meta}`; params `q`, `page`, `pageSize`), `orgLookupQueryOptions(kind, parentId)`
  (`/organisation/lookups/{kind}`), `countriesQueryOptions`, `statesQueryOptions(countryId)`,
  `citiesQueryOptions(stateId)`, types `Employee`, `LookupItem`, `State`, `City`, `Country`, `LookupKind`.
  `Region` / `regionsQueryOptions` remain as aliases of `State` / `statesQueryOptions`.
- Removed: `companyFilteredSearchSchema` (only the settings routes used it).

### Employee pickers

- The branch Manager picker is `EmployeeSearchSelect` (from `@/features/payroll`): `GET /employees/lookup` searched on
  the server (`q`, code or name, debounced), a page at a time (`pageSize` 50) with **Load more**, so it works past
  100 people. `useManagerOptions` (first 100 only) was removed.

## Navigation (`src/app/navigation.ts`, sidebar)

- `NavItem.permission` / `NavChild.permission` hold code prefixes; an entry shows when the user may **view** a
  screen under one of them (`<prefix>.view`, `<prefix>.*.view` or `<prefix>.*.*.view`, through `can()`).
  `filterNavItems(items, user)` is applied in `Sidebar` and to the Dashboard "Modules" shortcuts. A user without a
  `permissions` list (mock API) sees everything.
- Mapping: Recruitment `recruitment`; Talent Management `employees`; Separation Management `offboarding`;
  Attendance `attendance` or `scheduling.settings` (pages: `attendance.overview|time_sheet|logs`, Settings
  `attendance.settings` or `scheduling.settings`); Leaves `leaves`; Requests `requests` (pages
  `requests.punch|expense|leave|shift_swap|loan|work_from_home|official_visit|promotion|relaxation|rest_day|travel|transfer|resignation`,
  Settings `requests.settings`); Payroll `payroll` (pages not filtered); Assets `assets`; End of Employment
  `offboarding.end_of_employment`; Project Management `projects`; Performance `performance` or `training`; Benefits
  `benefits`; Roster `roster`; Warning `warning`; Scheduling `scheduling`; Manpower Planning `manpower`; Settings
  children: Control Panel `organisation`, Off Boarding Settings `offboarding.settings`, System User `access.users`,
  User Group Permissions `access.roles`, Biometric Devices `attendance.settings.devices`.
- Always shown (no API module): Dashboard (landing page), Configuration, Custom Form, Settings → Custom Forms.

## Dashboard (`/`)

- The page reads one dashboard, by permission: `GET /dashboard/hr` (`dashboard.hr.view`), else `/dashboard/ceo`
  (`dashboard.ceo.view`), else `/dashboard/me` (`dashboard.employee.view`); `dashboardKindFor(user)`. Optional
  `?month=` / `?day=` are supported by `dashboardQueryOptions(kind, params)` (not exposed in the UI).
- Tiles: Headcount = `workforce.headcount` (HR / CEO); Present today = `attendance.present`; On leave =
  `attendance.onLeave`; Warning policies = total of the warning policy list (warning API, only with
  `warning.settings.policies.view`).
- Empty states ("—" with a reason) instead of numbers: **Open positions** (not on the dashboard API), Headcount on
  the employee dashboard, every dashboard tile when the user holds no dashboard code, Warning policies without the
  warning code (the Warning policies card is hidden too).
- `dashboardSummaryQueryOptions()` (used by the `/` route loader) now selects the summary from the user's dashboard;
  `DashboardSummary` fields are nullable and `activeWarningPolicies` was removed from it.
- API data with no widget yet: workforce breakdowns (by department, employment type, gender, age band, turnover by
  month, department by gender, women by job title, women %, hired / left / turnover %), attendance by month,
  absenteeism %, today's attendance table, leave applications table, notice board, upcoming events, the CEO dashboard
  as such. All typed in `features/dashboard/api/dashboard.api.ts` for the dashboard screens to come.

## Inbox (top bar)

- Bell: `GET /inbox` → `{unread, latest[5]}` (polled every minute); the dot and label use `unread`. Clicking an item
  marks it read (`PATCH /inbox/notifications/{id}/read`) and opens its `link` when it is an app path. "Mark all as
  read" → `PATCH /inbox/notifications/read-all`. Also wired, no UI yet: `GET /inbox/notifications?unreadOnly&page`,
  `PATCH …/{id}/clear`, `PATCH …/clear-all` (`inboxApi`, `useClearNotification`, `notificationsQueryOptions`).
- Shape: items are `NotificationOut` (`notificationType, title, body|null, link, entityType, entityId, read, readAt,
createdAt`); the summary is no longer `{messages, notifications}`.
- Hidden without `inbox.notifications.view`.
- **Messages** (mail icon): the API has no messages (chat is out of the first release, SRS 8). The menu stays with
  an empty state and makes no request.

## Mocks (mock mode and tests)

- `src/mocks/settings/`: routes and shapes as above (`/organisation/...`, `q`, `rowVersion` checks with the API's
  422 / 409 answers and messages, delete guards, geo by id and ISO code, general settings). Records keep the mock ids
  (`lc_lhr`, `br_lhr_ho` …) and keep `companyId`; geography is stored as `countryId` / `stateId` (`cn_pk`,
  `st_pk_pb`); storage keys are `…-v2` so old sessionStorage data is not read. `branchGeo(branchId)` gives other
  mocks a branch's ids and ISO codes (the attendance audience mock read `branch.countryCode` / `regionCode`).
- `/organisation/lookups/:kind` in `settingsHandlers` answers **locations and areas only** and passes other kinds
  on (payroll, manpower, leaves, project mocks answer them with their own data). `settingsLookupFallbackHandlers`
  (every kind + `/employees/lookup`, from the settings tables and the directory) is exported but **not registered**,
  so it cannot shadow other modules' samples; register it last in `src/mocks/handlers.ts` once the shared pickers
  are consolidated.
- `src/mocks/employees/lookup.ts`: `toEmployeeLookup()` and `createEmployeeLookupHandler()` (API row shape).
- `src/mocks/dashboard/`: `/dashboard/hr|ceo|me` with fixed figures. `src/mocks/inbox/`: notifications only.

## Gaps

API has, no screen: departments, divisions, cost centers, designations, grades, job levels, employee groups,
employment types (CRUD under `/organisation/*`); companies (`/organisation/companies` list / add / edit) and a company
switcher (`/organisation/lookups/companies` + `X-Company-Id`); announcements (`/organisation/announcements`); users,
roles, grants, sessions, audit, own password (`/access/*`; Control Panel Users, System User and User Group
Permissions are still placeholders); the employee directory and profile (`/employees/*`); the full CEO / HR / My
dashboards (see above); the notifications page (list, clear).

Screens with no API: Search Location geocoder; Subscriptions; Help & Support; Custom Forms; Messages; the Open
positions tile.

## Notes for others / open points

- The app never calls `GET /auth/me` after sign-in, so permissions are those sent at login until the next sign-in
  (a role change is not seen). A refresh on start (e.g. in the authenticated layout's loader) would fix it.
- `/settings` and `/settings/control-panel` redirect to General Settings; a user without
  `organisation.general.view` lands on a 403 page there (route redirect not changed: route files are search-schema
  only for this task).
- **Backend bug (all modules)**: timestamps are stored UTC (`SYSUTCDATETIME()`) but sent without a zone
  (`"createdAt": "2026-10-26T05:14:37"`), so `parseISO` reads them as local time (5 h off in Pakistan). The bell
  and General Settings' "Last saved" append `Z` when no zone is given; the API should send `Z` (or the shared
  `lib/date` helpers should assume UTC) so every screen gets it right.
- `PUT /organisation/general` was not exercised against the dev database (the shared company record was left
  untouched); create / edit / delete with `rowVersion`, duplicates and delete guards were.
