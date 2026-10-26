# Attendance and Warning: frontend ↔ backend mapping

Features: `src/features/attendance` (Attendance Overview, Time Sheet, Attendance Logs, Attendance Settings) and
`src/features/warning` (policy, penalty, history, overview). Mocks: `src/mocks/attendance`,
`src/mocks/warning-policies`, `src/mocks/warning-penalties`, `src/mocks/warning-history`. Route files under
`src/routes/_app/attendance/**` and `src/routes/_app/warning/**` are unchanged; only the search schemas changed
(`features/attendance/routing.ts`, warning route `edit` params).
Backend: `app/routers/{attendance,warning,scheduling}.py` with their schemas, codes in
`app/catalogue/{attendance,warning,scheduling}.py`; `comparison/03-attendance.md`, `05-leaves-and-warning.md`
(warning part), `02-scheduling.md`, `14-files-and-events.md`. Every route below was called against the running dev
API (26 Oct 2026, company 1, with a test employee "ATT Tester", id 19, made for this) and the JSON compared with the
types.

The frontend uses the backend's names and values everywhere (snake_case enum values such as `half_day`,
`check_in`, `on_time`; camelCase fields). The only translation layer is in the api modules:

- **Local wall-clock times.** The API sends attendance date-times as `yyyy-MM-ddTHH:mm:ss` without a zone. The api
  layer (`fromWire` / `toWire` in `api/attendance.api.ts`) trims them to the screens' `LocalDateTime`
  (`yyyy-MM-ddTHH:mm`) and adds `:00` on the way out. Nothing is converted between zones.
- **Record stamps are UTC.** `createdAt`, `updatedAt` and history `performedAt` come back in UTC **without** a `Z`
  (procedures use `SYSUTCDATETIME()`): `utcStamp()` appends the `Z` so the browser shows local time. (Warning has the
  same fix in `features/warning/utils/server-time.ts`.)
- **Decimals as strings.** `penaltyPercentage`, `latitude`, `longitude` (and geo-fence centres) arrive as strings
  (`"50.00"`); the api layer turns them into numbers.

## Attendance Overview (`/attendance/overview`)

| Screen / action                                                       | Route                                                                                                      | Permission                         |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Grid (month, All / Subordinates, Employee Status, Department, search) | `GET /attendance/overview?month=yyyy-mm&tab=all\|subordinates&employeeStatus&departmentId&q&page&pageSize` | `attendance.overview.view` (route) |
| Export (new button)                                                   | `GET /attendance/overview/export` (same filters, CSV)                                                      | `attendance.overview.export`       |
| Department picker                                                     | `GET /organisation/lookups/departments`                                                                    | —                                  |
| A day (click a cell)                                                  | `GET /attendance/days/{employeeId}/{date}` (see Time Sheet View)                                           | `attendance.time_sheet.view`       |

Shape changes: a row is `OverviewRowOut` (`employeeId, employeeCode, employeeName, departmentName, designationName,
employeeStatus, totals{totalDays, present, absent, holiday, daysOff, leave, lateArrival, earlyLeft}, days{date →
dayStatus}`) instead of `{employee, totals, days}`; `days` lists every date of the month. Days the backend has not
processed are missing from the map ("—", label "Not processed").

UI changes:

- The legend has the API's **12 day states** (`present, absent, holiday, half_day, short_day, leave, sandwich,
official_visit, yet_to_start, weekend, rest_day, wfh`) instead of 21. Late Arrival, Early Left, Half / Short
  Leave and Relaxation are flags of a day in the API (shown on the time sheet), Leave Applied, Workable shifts /
  hours and Official Duty do not exist there.
- **Employee Name filter removed**: the overview route has no `employeeId` (backend gap); the search box (`q`)
  finds a person. Department is now an id (`?departmentId=` in the URL, was `?department=` name).
- Export button (CSV from the API), shown with `attendance.overview.export`.

## Time Sheet (`/attendance/time-sheet`)

| Screen / action                   | Route                                                                                                                                    | Permission (button shown with)                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| My / Subordinates / All list      | `GET /attendance/time-sheet?tab=my\|subordinates\|all&fromDate&toDate&employeeId&employeeStatus&dayStatus&flag&q&page&pageSize`          | `attendance.time_sheet.view` (route)                   |
| Days Overview This Month tiles    | `GET /attendance/time-sheet/summary?tab&fromDate&toDate[&employeeId]`                                                                    | —                                                      |
| Employee Name picker              | `GET /employees/lookup?permission=attendance.time_sheet.view&includeInactive=<status≠active>&q&page&pageSize` (server search, Load more) | —                                                      |
| Export (new)                      | `GET /attendance/time-sheet/export` (same filters, CSV)                                                                                  | `attendance.time_sheet.export`                         |
| Process (new; Subordinates / All) | `POST /attendance/time-sheet/process {fromDate, toDate, employeeIds?}`                                                                   | `attendance.time_sheet.process`                        |
| View                              | `GET /attendance/days/{employeeId}/{date}` → `{day, flags[{flag, minutes}], breaks[], punches[]}`                                        | `.view`                                                |
| History (in View)                 | `GET /attendance/days/{employeeId}/{date}/history?page&pageSize=5`                                                                       | `.view`                                                |
| Logs (in View)                    | the day's `punches` (no separate call)                                                                                                   | `.view`                                                |
| Edit                              | `PUT /attendance/days/{employeeId}/{date}` (`DayEditIn` + `rowVersion`)                                                                  | `attendance.time_sheet.edit`                           |
| Break type picker (Edit)          | `GET /scheduling/settings/break-types?pageSize=100`                                                                                      | `scheduling.settings.break_types.view`                 |
| Clock In / Clock Out              | `GET /attendance/clock`, `POST /attendance/clock {punchType, source: web, latitude?, longitude?, photoFileId?}`                          | `attendance.time_sheet.clock` (card hidden without it) |
| Clock-in picture                  | `POST /files` (module `attendance`) via `uploadFile`, then `photoFileId`                                                                 | any signed-in user                                     |

Shape changes (`types/attendance.types.ts`, mirrors `TimesheetDayOut`):

- A row is one person **and** one day: `id, employeeId, employeeCode, employeeName, departmentName, workDate,
scheduleId, timeSlotId, timeSlotName, expectedIn/Out` (local date-times, were `HH:mm`), `expectedMinutes,
firstIn, lastOut` (were `checkIn/checkOut`), `workedMinutes, breakMinutes, shiftWorkedMinutes, lateMinutes,
earlyLeftMinutes, overtimeBeforeMinutes, overtimeAfterMinutes, approvedOvertimeMinutes, graceConsumedMinutes,
dayStatus, markedStatus, leaveRequestId, isManuallyUpdated, isFrozen, comments, processedAt, flags[],
warningCount, penaltyType, penaltyPercentage, clockInStatus, clockOutStatus, rowVersion`.
- Removed: `durationMinutes` (computed from first in / last out), `overtimeMinutes` (= before + after),
  `warning {percent, penalty}` (now `warningCount` + the heaviest penalty), `relaxed` (flag `relaxation`), the
  `employee` block on the page response (each row names its person).
- Chips: `clockInStatus/clockOutStatus` ∈ `on_time` (shown "Present"), `grace`, `late`, `early`, `overtime`,
  `missing`, `absent` (were present / late-arrival / early-left / missing-punch / absent).
- Flags: `late, early, grace, overtime, missing_punch, relaxation, official_visit, half_leave, short_leave`.
- `approvedOvertimeMinutes` is `0` (not `null`) when nothing is approved; the column shows the worked overtime as
  "pending" until it is.
- Summary (`SummaryOut`): `totalDays, employees, present, absent, holiday, weekend, restDay, leave, halfDay,
shortDay, wfh, officialVisit, sandwich, yetToStart, lateArrival, earlyLeft, missingPunch, workedMinutes,
overtimeMinutes, approvedOvertimeMinutes` (was `DaysOverview` with warnings / penalty counts).
- Day detail: no `profile`, `comments[]` thread or `marks`; the person card is built from the day (name, code,
  department; location, company, joining date and designation are not in the API and are hidden), comments are the
  day's one `comments` text, marks are `markedStatus` (`absent | half_day | short_day`). Breaks are
  `{id, breakTypeId, breakTypeName, outAt, inAt, minutes}` (no description). History lines are
  `{fieldName, oldValue, newValue, actionName, performedAt, performedByName}` (one per changed field).
- Clock: `ClockStateOut` (`allowed, reason, photoRequired, locationRequired, clockedIn, nextPunchType,
lastPunchType, lastPunchedAt, expectedIn/Out, now`); the POST answers the new punch (`PunchOut`).

UI changes:

- **Subordinates tab** added (`tab=subordinates`). On Subordinates / All the Employee Name filter is optional
  ("All employees") and the table gets an **Employee** column; the rows are newest first, as the API sorts them.
  From / To may span up to 366 days (was 93), as the API allows.
- Row actions: **Edit** (Subordinates / All, with `attendance.time_sheet.edit`, a scheduled day that has started and
  is not `isFrozen`) and **View**. **Missing Punch, Relaxation, Absent (as leave / visit / WFH) and Overtime approve
  are removed**: in the API they are requests (punch, time_window, official visit / WFH, overtime) handled by the
  requests module; their dialogs and mock routes (`/days/{..}/missing-punch|relaxation|absence|overtime`) are gone.
  HR's direct correction is the day edit.
- Edit sends `DayEditIn`: `firstIn, lastOut, markedStatus, comments, breaks[{breakTypeId, outAt, inAt}],
rowVersion` plus **`expectedIn/expectedOut` sent back unchanged** (see backend issues). The break type is optional
  (the API allows a break without one); the break Description column is gone; **Comments** is one text box saved
  with the day (the separate comment thread with add / delete per comment is gone). `fieldErrors` `firstIn`,
  `lastOut`, `comments` land on their fields; 409 (stale rowVersion, `DAY_FROZEN`) shows under the form; Save is
  disabled on a frozen day.
- View: state pill, clock chips, the day's flags with minutes, expected / actual times, breaks with duration,
  comments; Logs lists the day's punches (struck through when ignored).
- History: Edited By (`performedByName`), Action ("Update Check In Time", "Update Mark" …) with old → new (times as
  "09:05 AM"), Date.
- Warnings column: "n warnings" and the penalty ("Half Day Penalty", "Full Day Penalty", "25% Penalty") from the
  row; no more progress meter.
- Days Overview tiles: Absent, Holiday, Late Arrival, Present, Weekend (weekend + rest day), Yet To Start, **Leave**,
  **Missing Punch**, Overtime (hours). The design's **Warnings** and **Penalty** tiles are dropped: the summary has
  no such counts (backend gap). Subordinates / All show the totals of everyone in view, or of the chosen person.
- Clock card: hidden without `attendance.time_sheet.clock`; disabled with the API's `reason` (e.g. "Your user is not
  linked to an employee in this company."); a **Take Picture** file input (camera on phones) appears when
  `photoRequired`, uploads to `/files` and sends `photoFileId`; when `locationRequired` the browser position is sent.
- `?flag=` / `?dayStatus=` filter the list (a removable "Only Missing Punch days" chip shows the flag).

## Attendance Logs (`/attendance/logs`)

| Screen / action                                                 | Route                                                                                                                                                | Permission (button shown with) |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| List (From / To ≤ 31 days, Employee, Punch Type, Source)        | `GET /attendance/logs?fromDate&toDate&employeeId&punchType&source&q&page&pageSize`                                                                   | `attendance.logs.view` (route) |
| Employee pickers                                                | `GET /employees/lookup?permission=attendance.logs.view\|create\|edit&q&page&pageSize` (filter adds `includeInactive=true`; server search, Load more) | —                              |
| + Create                                                        | `POST /attendance/logs` (`PunchIn`)                                                                                                                  | `attendance.logs.create`       |
| Edit (manual / imported punches)                                | `PUT /attendance/logs/{id}` (`PunchIn` + `rowVersion`)                                                                                               | `attendance.logs.edit`         |
| Delete (manual / imported)                                      | `DELETE /attendance/logs/{id}?rowVersion=`                                                                                                           | `attendance.logs.delete`       |
| Ignore / Count again (new; machine, dashboard, request punches) | `PATCH /attendance/logs/{id}/ignore {isIgnored, rowVersion}`                                                                                         | `attendance.logs.edit`         |
| Import (file)                                                   | `POST /attendance/logs/import {lines[{line, employeeCode, punchedAt, punchType}]}` → `{created, skipped, failed, errors[{line, message}]}`           | `attendance.logs.import`       |
| Download                                                        | `GET /attendance/logs/export?fromDate&toDate` (CSV from the API)                                                                                     | `attendance.logs.export`       |
| Break type picker (break punches)                               | `GET /scheduling/settings/break-types`                                                                                                               | —                              |

Shape changes: a row is `PunchOut` (`employeeId, employeeCode, employeeName, punchedAt, punchType, breakTypeId,
breakTypeName, source, deviceId, deviceCode, deviceName, latitude, longitude, ipAddress, photoFileId,
photo{id,name,url}, requestId, remarks, isManuallyUpdated, isIgnored, editable, createdAt, updatedAt, rowVersion`)
instead of `{type, at, description, source, machineId, manuallyUpdated, date, employee, editable}`. Punch types are
`check_in, check_out, break_out, break_in`; sources `biometric, mobile, web, manual, import_file, punch_request`
(labels: Import from Machine, Mobile App, Dashboard, Manual, Imported File, Punch Request). The create / edit body is
`{employeeId, punchedAt, punchType, breakTypeId, remarks, rowVersion}` (was date + time + description).

UI changes: Description = `remarks` (else the break type or device name); Machine shows the device name and code;
ignored punches are struck through with "Ignored"; View adds break type, IP, location and the clock-in picture.
Create / Edit add a **Break Type** select for break punches; nobody can enter their own punches (403 from the API).
Import: Computer only — the **Machine** mode is removed (HRango cannot read a device; a device connector posts to
`/attendance/settings/devices/{id}/punches`), the file is still checked in the browser first (template now uses
`check_in` …; `check-in` / "Check In" are still accepted) and the server's per-line errors are listed. Download takes
From / To (≤ 31 days) and saves the API's CSV (was one date, built in the browser).

## Attendance Settings (`/attendance/settings?tab=…`)

Files: `api/settings.api.ts` (`settingsApi`, `lookupsApi`, `settingsKeys`), `hooks/use-attendance-settings.ts`,
`types/settings.types.ts`, `components/settings/*`, `utils/criteria.ts`; mocks `src/mocks/attendance/settings-db.ts`,
`settings-handlers.ts`, `audience.ts`.

Common to every tab:

- Edits send the `rowVersion` last read (body); deletes send `?rowVersion=`. A stale version gives the API's 409
  ("Someone else changed this …"), shown as a toast or under the form. 422 `fieldErrors` land on the named field
  (or under the form when the field is not on screen, e.g. `targets`, `rules`, `weekdays`).
- Lists page with `?page&pageSize` and search with `?q` (was `?search`). `SettingsListCard` now hides the search box
  for lists the API cannot search (rest days) and the Filter button when there is nothing to filter.
- Lists leave out child data (`targets: null` on IP restrictions / geo fences, `rules: []` + `ruleCount` on
  holidays, `employees: []` on rest-day rules). View / Edit therefore loads the single record
  (`GET …/{id}`) before showing the form (`useSettingsRecord`).
- Pickers: employees from `GET /employees/lookup?permission=<tab's view code>&q&page&pageSize` → `{data, meta}`,
  searched on the server with "Load more" (`EmployeeMultiSelect`); organisation units from `GET /organisation/lookups/{locations|areas|branches|departments|
designations|grades|job-titles}`; places from `GET /organisation/geo/countries | states?countryId | cities?stateId`.
  Religions are the frontend's `RELIGIONS` list, nationalities a short `NATIONALITIES` list (free text in the API).
- Buttons follow `useCan`: + Create = `.create`, View / Edit (else View only) and Activate/Deactivate = `.edit`,
  Delete = `.delete`; a tab is hidden without its `.view` code and the URL falls back to the first visible tab.
- Saving invalidates `['attendance']` and `schedulingKeys.all` (time sheets and the planner depend on these).

| Tab             | Routes                                                                                                            | Permission codes                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Basic           | `GET/PUT /api/attendance/settings/basic`                                                                          | `attendance.settings.basic.view/edit`   |
| Scheduling      | none in the API (mock only: `GET/PUT /attendance/settings/scheduling`)                                            | none                                    |
| Rest Days       | `GET/POST /api/scheduling/settings/rest-days`, `GET/PUT/DELETE …/rest-days/{id}`, `POST …/rest-days/delete-range` | `scheduling.settings.rest_days.*`       |
| Break Types     | `GET/POST /api/scheduling/settings/break-types`, `PUT/DELETE …/{id}`                                              | `scheduling.settings.break_types.*`     |
| IP Restrictions | `GET/POST /api/attendance/settings/ip-restrictions`, `GET/PUT/DELETE …/{id}`                                      | `attendance.settings.ip_restrictions.*` |
| Geo Fencing     | `GET/POST /api/attendance/settings/geo-fences`, `GET/PUT/DELETE …/{id}`                                           | `attendance.settings.geo_fencing.*`     |
| Holidays        | `GET/POST /api/scheduling/settings/holidays?year&q`, `GET/PUT/DELETE …/{id}`                                      | `scheduling.settings.holidays.*`        |

### Basic

- Shape: `{ignorePunchType, useCheckInOutForBreaks, shortDurationOnNonFlexible, dashboardPunch, allowMultiShift,
pictureOnDashboardPunch, minimumWorkableMinutes, lateGraceMinutes, rowVersion}`. Renamed `multiShiftPerDay` →
  `allowMultiShift`. `minimumWorkableMinutes` is a number (0 = use the day's expected minutes; was `null` = no limit;
  the box shows 0 as empty). Added input **Late Grace Minutes** (0–240; the API's daily grace before a day is late).
  `rowVersion` is `null` until the settings are first saved.
- The form used to save Basic + Scheduling together (`/attendance/settings/config`); each tab now saves its own set.
- Without `attendance.settings.basic.edit` the switches are disabled and Save Changes is hidden.

### Scheduling

- **Backend gap**: the switches "Geo Fences Required On Shift" and "Ignore rest days for shift selection" have no
  endpoint. `att.usp_clock` reads `company_setting (scheduling, geo_fence_required_on_shift)` but nothing writes it;
  "ignore rest days" is not read anywhere. Decision: keep the tab; it calls `GET/PUT /attendance/settings/scheduling`,
  which only the mock answers. Against the API the 404 shows "These switches cannot be saved yet: the server does not
  store them." with the switches disabled. Needed: e.g. `GET/PUT /api/scheduling/settings/configuration`
  (`geoFenceRequiredOnShift`, `ignoreRestDaysForLeaves`, `rowVersion`) with a `scheduling.settings.*` code.

### Rest Days

- The API keeps **rules** (employees, from/to, weekdays 1–7, `repeatEveryWeeks` 0–8, `step`, `isPayable`), not the
  frontend's rest-day batches with a row per person and date. The list is now one row per rule: Employees (count),
  Dates, Days, Repeat, Rest Days (`restDayCount`, "Payable"). View loads the rule with its people and offers
  **Edit** (new: `PUT` with rowVersion) and Delete (`DELETE ?rowVersion`).
- Create no longer opens Scheduling's `RestDayDialog`: the tab has its own "Create New Rest Day" form posting
  `RestDayRuleIn` (employee picker, From/To, day chips, Repeat = every week or a cycle of 1–8 weeks, Step = weeks on,
  Payable). Removed the dependency on `@/features/scheduling`.
- Red **Delete** (range) sends `{startDate, endDate, allEmployees, employeeIds}`; added "All Employees" / pick
  employees (the API needs one or the other). The toast uses `deletedRestDays`.
- Filter: From / To (`?from&to`) instead of a name search (the API has no `q` here; `employeeId` is not used).

### Break Types

- Shape adds `updatedAt` (nullable) and `rowVersion`; ids are the API's. Name ≤ 200, identifiers ≤ 50; the end
  identifier must differ from the start one (checked in the form too). 409 `BREAK_TYPE_DUPLICATE` /
  `IDENTIFIER_DUPLICATE` shows under Name / the identifier; delete refused while a slot or shift uses the type (409).
- `useBreakTypes()` (used by the time sheet's Breaks table) now reads `/scheduling/settings/break-types`.

### IP Restrictions

- Shape: `{id, code, ipv4, ipv6, netmask, rangeStart, rangeEnd, appliesToAll, isActive, addressCount, targetCount,
targets, createdAt, updatedAt, rowVersion}`. Removed `name` (the API has none), `mode` (derived: range when
  `rangeStart` is set), the typed-in `count` (now the API's computed `addressCount`, shown read-only in the dialog and
  as a list column), renamed `subnetMask` → `netmask`, `allEmployees` → `appliesToAll`, `active` → `isActive`.
- Netmask mode sends `ipv4` (address or CIDR) and/or `ipv6` and an optional `netmask`; Range mode sends
  `rangeStart`/`rangeEnd` (IPv4 or IPv6). IPv4 is no longer required when IPv6 is given. Added an **Active** box.
- Activate / Deactivate: there is no status route, so the hook reads the record and `PUT`s it back with `isActive`
  flipped (two calls).
- Columns: Code, IP, Count, Applies To, Status (Name dropped).

### Geo Fencing

- Shape: `{id, code, name, shape: circle|polygon, centerLat, centerLng, radiusM, polygonPoints[{lat,lng}],
appliesToAll, joiningFromDate, joiningToDate, isForShift, isActive, targetCount, targets, …, rowVersion}` instead of
  `shape: {type, latitude, longitude, radiusMeters | points}`. The API sends `centerLat/centerLng` as decimal
  **strings** ("31.520400"); `settingsApi` converts them to numbers. Radius up to 100,000 m (was 50,000).
- Step 2 adds **Active** and, with criteria, **Joining Start / End Date** (`joiningFromDate/ToDate`; these were
  inside each criteria block before).
- Delete: the API refuses a fence that shifts use (409 `GEO_FENCE_IN_USE`, "set it inactive"); the confirm text says
  so (the mock used to strip the fence from shifts instead).

### Criteria ("Add Criteria", IP restrictions and geo fences)

- The API stores a flat list `targets[{targetType, targetId | targetValue}]`, one value per row; same type = any,
  different types = all. The frontend's several OR-ed criteria blocks (each an AND of fields), the
  Organization/Employees switch and per-block joining dates cannot be stored. The editor is now one block with a
  multi-select per target type: Locations, Branches, Areas, Departments, Designations, Grades, Job Titles, Countries
  (ids), Religion, Nationalities (names) and Employees. `AudienceCriteria` is now `Record<TargetType, string[]>`
  (`toCriteria` / `toTargets` in `utils/criteria.ts`).
- Targets come back without names; organisation values show their lookup names, employees not in the current search
  show as "Employee {id}" until found.

### Holidays

- Shape adds `holidayType` (public | local, **new required Type select**, default Public), `dayCount`, `ruleCount`
  (list) and `rowVersion`; `description` is nullable.
- Rules: `{ruleType: religion | geo_location | org_structure | employee, employeeId, locationId, branchId, countryId,
stateId, cityId, religion}` plus names in responses. Removed the rule **Name** field (the API has none); the rules
  table shows Type and Applies to. One rule names one employee, so picking several employees adds one rule each.
  Geo rules use the API's country/state/city ids (cascading pickers); org rules a location and a branch of it.

### Mocks

- `settings-handlers.ts` now serves the API routes and shapes above (rowVersion checks, 409/422 bodies like the API,
  computed `addressCount`, `dayCount`, `restDayCount`). Records are stored in the API's shapes under new storage keys
  (`…-api`). Geo fences still store name and drawing in Scheduling's `geoFences` collection (Scheduling's pickers keep
  seeing them) plus details in `geoFenceSettings` (`id`, `active` still read by `mocks/scheduling/handlers.ts`).
- Rest-day rules are a new `restDayRules` collection; the mock attendance engine does not turn them into rest days
  (it never read rest-day rules), so in mock mode a new rule does not change time sheets.
- `/employees/lookup` for these tabs' codes (`attendance.*`, `scheduling.settings.*`) is answered by the attendance
  mock (see Mocks below); `/organisation/lookups/*` and `/organisation/geo/*` come from the settings mocks.
- `audience.ts`: `holidayFor` follows the new rule shape (ids of the branch's country/state/city); `matchesTargets`
  applies targets as the API does.

### Gaps

Backend features with no screen here:

- **Overtime settings** (`GET/PUT /attendance/settings/overtime`: six switches + encashment shift minutes) — no tab.
- **Overtime policies** (`/attendance/settings/overtime-policies` with slabs) — no tab.
- **Biometric devices** (`/attendance/settings/devices` CRUD, `/enrolments`, `/punches`) — no tab (Logs' "Machine"
  import was removed).
- **Time slots** (`/scheduling/settings/time-slots`) — no Time Slots tab (Scheduling's create form only).
- List filters the UI does not offer: `isActive` (IP, geo), `isForShift` (geo), `holidayType` (holidays),
  `employeeId` (rest days).

Frontend features the API lacks:

- Scheduling tab switches (above).
- IP restriction name; several OR-ed criteria blocks; per-block joining dates on IP restrictions (IP restrictions
  have no joining window at all); holiday rule names; search on rest days.

Backend issues found:

- `POST/PUT /attendance/settings/ip-restrictions` (and geo fences) accept target ids that do not exist (a `branch`
  target with id 5 was saved while the company had no branch 5); `targets` are not checked against their tables.
- Lists return `targets: null` / `rules: []` / `employees: []`, so a list toggle (Activate) needs a GET first;
  a `PATCH …/{id}` for `isActive` would avoid the read-modify-write.
- Geo-fence `centerLat/centerLng` are serialised as strings (Decimal), unlike `polygonPoints` (floats).

## Warning

Backend: `app/routers/warning.py`, `app/schemas/warning.py`, `db/procedures/att/usp_warning_policy.sql`,
codes in `app/catalogue/warning.py`. Frontend: `src/features/warning`, mocks `src/mocks/warning-policies`
(+ `store.ts`, the shared mock tables), `src/mocks/warning-penalties`, `src/mocks/warning-history`.
The old mock paths `/warning-policies`, `/warning-penalties`, `/warning-history` are gone.

### Policy (`/warning`, `/warning/policy`, `/warning/policy/$policyId`)

Routes: `GET /api/warning/policies?page&pageSize[&q&appliesTo]`, `GET/POST /api/warning/policies[/{id}]`,
`PUT /api/warning/policies/{id}` (body carries `rowVersion`), `DELETE /api/warning/policies/{id}?rowVersion=`.

Shape changes (`types/warning-policy.types.ts`):

| Before (mock)                                                                                                                               | Now (API)                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `policyName` (`grace-minutes`, `late-arrival`, …)                                                                                           | `appliesTo`: `late_arrival`, `early_departure`, `overtime`, `half_day_leave` (no "grace minutes" kind: grace is a field of every policy)                                        |
| `timeSpan` `weekly/monthly/yearly`                                                                                                          | `period`: `day`, `week`, `month`, `year`                                                                                                                                        |
| `clockEvent` on the policy + `periods[]` (start/end dates or weekdays, month, day chip, weekdays, total grace, clock in/out times, minutes) | `graceMinutes` (total per period, optional), `weekStartDay` / `weekEndDay` (weekly only), `isActive`, `rules[1..2]` `{clockEvent clock_in/clock_out, minutes, occurrenceCount}` |
| —                                                                                                                                           | `penalties[]`, `warningCount`, `rowVersion`, `updatedAt` nullable                                                                                                               |

- The API mapper (`toWarningPolicy`) adds read-only `policyName` (= `appliesTo`) and `timeSpan` (= `period`) so
  `features/dashboard/components/dashboard-page.tsx` keeps compiling (`POLICY_NAME_LABELS[policy.policyName]`,
  `TIME_SPAN_TABLE_LABELS[policy.timeSpan]`; both label maps are keyed by the API values now).
- `createdAt` / `updatedAt` / history `performedAt` are **UTC without a zone** (`2026-10-26T05:22:31` while the
  local time was 10:22 PKT). `utils/server-time.ts` (`toUtcIso`, `formatServerTime`) adds the `Z` before formatting.

UI changes:

- Policy form: Policy Name (what it watches), Title, Time Span (Daily/Weekly/Monthly/Yearly), Total Grace Minutes
  (empty = none), Week Start / End Day (weekly only; start defaults to Monday on the server), Status switch. The
  second card is now "<Span> rules": one block per clock event (Clock Event, Minutes, Warn every n occurrences),
  "+ Add Rule" only while a clock event is free. Late arrival = Clock In only, early departure = Clock Out only,
  overtime = both, half-day leave = one rule (checked in the Zod schema and again by the server).
- Removed: the repeated Year/Month/Week blocks, date ranges, month and day chips, weekday toggles, clock in / clock
  out times (`period-fields/`, `time-span-card.tsx` deleted).
- Server `fieldErrors` (`title`, `rules`, `rules.0.clockEvent` …) land on the fields; duplicate title is a 409
  `WARNING_POLICY_DUPLICATE` with `fieldErrors.title`.
- Policy table: + Status column (Active/Inactive). Delete confirms with "Warnings have been raised … make it
  inactive" when `warningCount > 0` (the API refuses with 409); deletes send the `rowVersion`.
- View page: summary (+ grace, week, status, warnings raised), Rules table, Penalties table, "Penalties" button.

Permissions: Save/"Add Policy"/"Add Form" need `warning.settings.policies.create` (new) or `.edit` (editing); row
Edit needs `.edit`, Delete `.delete`. Mock mode (no permission list) shows everything.

### Penalty (`/warning/penalty`)

Routes: `GET /api/warning/penalties?page&pageSize[&policyId]` (list), `GET /api/warning/policies/{id}` (load),
`PUT /api/warning/policies/{id}/penalties` `{penalties: [...], rowVersion}` (save, replaces all rules of the policy),
`GET /api/leaves/types?isActive=true&pageSize=100` (leave-type picker, only with `leaves.settings.types.view`).

Shape changes (`types/warning-penalty.types.ts`):

- A penalty is no longer its own record with a title, scale and badge; it is a rule of a policy:
  `{afterCount 1..100, period week/month/year, penaltyType half_day/full_day/percentage, percentage, deduction
payroll/leave/both, leaveTypeId}`. The list row (`WarningPenalty`) is `PenaltyListOut` (+ `policyTitle`,
  `appliesTo`, `warningPolicyId`).
- Dropped: Title, Type Of Scale, Points, Badge Color, start/end day, Day chip, weekday chips, From–To window.
  `SCALE_TYPES`, `BADGE_COLORS` stay exported from the barrel only as legacy names.

UI changes:

- The form picks a **Warning Policy** (select of all policies) and edits its penalties; `?edit=` is now the
  policy id. Blocks: Count, Time Span, Penalty Type, Percentage of a day (percentage only), Deduction, Leave Type
  (leave/both only, required). Saving with no blocks clears the policy's penalties.
- Penalty list columns: Policy Name (title + kind), Warning Count ("2nd / Month"), Penalty Type, Deduction (with
  leave type). Edit opens the policy's penalties; Delete re-saves the policy's penalties without that rule (reads
  the policy first for its rules and rowVersion).

Permissions: Save, "+ Add Form" and row actions need `warning.settings.penalties.edit`; the leave-type picker
needs `leaves.settings.types.view` (without it, the select only shows a saved leave type).

### History (dialog on `/warning`)

Route: `GET /api/warning/history?page&pageSize=50[&policyId]` → `HistoryOut {id, performedAt, actionName
create/update/delete, policyId, policyTitle, fieldName, oldValue, newValue, performedByUserId, performedByName}`.

- One line per changed field: "Policy updated — Late (Total Grace Minutes)"; View shows old → new (rules and
  penalties JSON summarised as "2 penalties"), who and when. Penalty changes are a policy update of `penalties`.
- Loaded a page at a time ("Load more").
- Removed: Delete and Delete All (the audit log is not deletable; `useDeleteHistoryEntry` / `useClearHistory`
  remain exported for the barrel and reject with an explanation).
- The History button needs `warning.settings.history.view`.

### Overview (`/warning`)

Same two lists (policy, penalty), Column Preferences (column ids changed: policy + Status; penalty Sr #, Policy
Name, Warning Count, Penalty Type, Deduction; the persisted store moved to version 2 and resets).

### Gaps

Backend has, no screen:

- `GET /api/warning/warnings` (warnings raised per employee/policy/date, with penalty and payslip) and
  `POST /api/warning/warnings/process` (`warning.warnings.view|process|export`). Only the time sheet's Warnings /
  Penalty columns show them (attendance). The mock serves both (empty list, `{raised: 0}`).
- `GET /api/warning/policies?q=&appliesTo=` filters (the API supports them; the list has no search box).

Frontend had, backend lacks:

- Policy name "Grace Minutes" as a kind; repeated period blocks with dates and expected clock times; penalty
  title, points scale, badge colour, weekday chips and time windows; History Delete / Delete All.

### Backend notes found while wiring

- `createdAt`, `updatedAt`, `performedAt` are UTC without a `Z` (procedures use `SYSUTCDATETIME()`), while
  attendance times are local wall-clock. A shared helper in `src/lib/date.ts` (or a `Z` from the API) would help
  every module; warning uses its own `utils/server-time.ts`.
- Duplicate title answers **409** (not 422) with `fieldErrors.title` — fine, noted because the README's examples
  use 422 for validation.
- `DELETE /policies/{id}` without `rowVersion` answers 422 `rowVersion: Required.`; the frontend always sends it.
- History of a deleted policy still returns `policyTitle` (good); history rows of a renamed policy show the
  current title, not the title at the time (only `oldValue`/`newValue` of the `title` line keep the old one).
- Penalties history `oldValue` is `null` when the policy had none (not `[]`).

### Routes (search schemas)

`/warning/policy` and `/warning/penalty`: `edit` accepts a string or a number (`?edit=4` typed by hand parses as a
number; API ids are numeric strings) and is turned into a string. On the penalty route `edit` is the policy id.

## Mocks

- `src/mocks/attendance/handlers.ts` and `logs-handlers.ts` serve the backend routes above with the backend's
  shapes, envelopes, 409 on a stale `rowVersion`, 403 on one's own punches / day, 422 bodies like the API's.
- The mock **engine** (`engine.ts`, `db.ts`, `seed.ts`) is unchanged in what it computes and keeps its own shapes in
  `src/mocks/attendance/types.ts` (the requests, payroll, assets and leaves mocks read `attendancePunches`,
  `attendanceEdits`, `attendanceHistory`, `dayId`, `personRef`, `toProfile` in those shapes). `backend.ts`
  translates the engine's 21 states into the API's status + flags, chips, wire date-times and row versions. Added
  `attendanceIgnored` (ignored punches; the engine skips them for first in / last out) and `DayEdit.comments`.
- The attendance mock answers `GET /employees/lookup` itself **only** when `permission` is an `attendance.*` or
  `scheduling.settings.*` code (the directory people the engine works with); other screens fall through to their own
  lookup mocks.
- Mock-only behaviour: Process does nothing (the engine computes on read); the department filter matches the
  directory's department names; the clock never asks for a location.

## Employee pickers

- Every attendance employee picker searches `GET /employees/lookup` on the server (`q`, code or name, debounced
  300 ms) and reads it a page at a time (`page`, `pageSize` 50 → `{data, meta}`) with a **Load more** row, so it
  works past 100 people (`useEmployeeLookup` → `useEmployeeLookupSearch` in `src/hooks/use-employee-lookup.ts`).
- Pickers: Logs filter "Employee" and Create/Edit "Employee Name" (`EmployeeFilter` /
  `EmployeeSearchSelectField`), Time Sheet "Employee Name" (`EmployeeFilter`), Settings `EmployeeMultiSelect`
  (Rest Days, Holidays, Criteria). A chosen person outside the pages read so far keeps the name from the record
  (`known`).
- The attendance mock now honours `includeInactive` (former staff only with `includeInactive=true`).

## Gaps both ways

Backend has, no screen:

- **Biometric devices** (`/attendance/settings/devices` CRUD, `/enrolments`, `/punches` for a connector).
- **Overtime settings** (`/attendance/settings/overtime`) and **overtime policies**
  (`/attendance/settings/overtime-policies` with slabs).
- **Time slots** (`/scheduling/settings/time-slots`): no Time Slots tab.
- `POST /attendance/logs/import/csv` (raw CSV; the screen parses the file and uses the JSON import instead).
- `GET /attendance/overview/summary` (count tiles of the overview; the overview has no tiles).
- Logs filter `deviceId`; time-sheet filters `departmentId` and `timeSlotId` (not offered in the filter card).
- `overwriteManual` of Process (the screen always keeps HR's edits).
- Warnings raised list and process (`/warning/warnings`, `/warning/warnings/process`), see Warning.

Frontend has (had), backend lacks:

- Time-sheet row actions Missing Punch, Relaxation, Absent-as-leave / visit / WFH, Overtime approve (requests
  module, not attendance) — removed here.
- Overview Employee Name filter (`employeeId` on `/attendance/overview`).
- Days Overview **Warnings** / **Penalty** tiles (no counts in `SummaryOut`).
- Comment thread per day (the API keeps one `comments` text); break descriptions; person card facts (location,
  company, joining date, designation) on the day.
- Import from a machine (needs a device connector); legend states Leave Applied, Workable shifts / hours, Official
  Duty.
- Attendance menu placeholders **Overtime** and **Missing Punch** (`/attendance/$section`) stay placeholders: overtime
  is a request kind (requests module); missing punches are the time sheet's `?flag=missing_punch` list plus punch
  requests.
- Scheduling settings tab switches (see Settings).

## Backend issues found (route and what is wrong)

1. `PUT /api/attendance/days/{employeeId}/{date}`: `DayEditIn` fields default to `null`, and `null` **clears**. Sending
   only `firstIn/lastOut` (no `expectedIn/expectedOut`) wiped the expected times and turned a present day into
   `weekend` with `clockInStatus: on_time` (tested on ATT Tester, 2026-10-20, then restored). The frontend always
   sends the expected times back; the API should treat omitted fields as "keep" (or document it).
2. `createdAt` / `updatedAt` (punches, policies) and `performedAt` (day and warning history) are UTC without a zone,
   while every attendance time is local wall-clock. A `Z` (or `+00:00`) on these would remove the guesswork.
3. Decimals (`penaltyPercentage`, punch `latitude/longitude`, geo-fence centres) are serialised as strings; warning
   schemas already use a float serializer (`Number`), attendance schemas do not.
4. `GET /api/attendance/overview` has no `employeeId` filter, and `SummaryOut` has no warning / penalty counts, though
   the design has both.
5. Settings and warning findings are listed in their sections (targets not validated, no `isActive` PATCH, duplicate
   title answers 409, `DELETE` without `rowVersion` answers 422).
6. Not a bug, but noted: the dev administrator has no employee, so `GET /attendance/clock` answers
   `allowed: false` ("Your user is not linked to an employee in this company.") and `POST` 403 — the clock can only be
   tried with an employee's account.

## Needs from shared files / other owners

- `src/lib/date.ts` (shared): a helper for UTC-without-zone stamps; attendance (`utcStamp`) and warning
  (`server-time.ts`) each carry their own.
- `src/mocks/handlers.ts`: no change needed (export names kept). Several modules answer `GET /employees/lookup` and
  `/organisation/lookups/*` with different sample people; the first registered wins. Attendance now answers its own
  permission codes only.
- Jsdom: `POST /files` (multipart) fails inside MSW under vitest (`undici` FormData assertion), so the clock test turns
  "Take Picture" off; a fix in the files mock / test setup would let upload flows be tested.
- Dashboard owner: switch `dashboard-page.tsx` from `policy.policyName` / `policy.timeSpan` to `appliesTo` / `period`
  so the warning aliases can go.
- Leaves owner: keep `leaveTypes` exported from `src/mocks/leaves/db.ts` (the penalty mock reads it).
