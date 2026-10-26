# Roster and Scheduling: frontend ⇄ backend mapping

Features: `src/features/roster`, `src/features/scheduling`. Mocks: `src/mocks/roster`, `src/mocks/scheduling`.
Backend: `backend/app/routers/{roster,scheduling}.py`, `backend/app/schemas/{roster,scheduling}.py`,
permission codes in `backend/app/catalogue/{roster,scheduling}.py`, decisions in `comparison/02-scheduling.md`.
The backend is the source of truth; the screens were adapted to it.

Every route below was called against the dev backend (`hrango_dev`, test records `Rota Tester One/Two`,
time slots `RS Morning` / `RS Night`, break type `RS Lunch`) with the bodies the frontend sends; the JSON keys
match the TypeScript types (`types/roster.types.ts`, `types/scheduling.types.ts`).

## Roster (`/roster`)

| Screen / action                        | Route(s)                                                                                                                                                            | Permission (button hidden without it)  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Roster list (search, paging)           | `GET /roster/groups?q&page&pageSize` (`isActive` supported, not used)                                                                                               | `roster.groups.view` (route)           |
| Status switch                          | `GET /roster/groups/{id}` then `PUT /roster/groups/{id}` with `isActive` flipped                                                                                    | `roster.groups.edit` (switch disabled) |
| Add / Edit Roster Group                | `POST /roster/groups`, `PUT /roster/groups/{id}` (`rowVersion`)                                                                                                     | `roster.groups.create` / `.edit`       |
| View                                   | `GET /roster/groups/{id}`                                                                                                                                           | view; Edit button needs `.edit`        |
| Delete                                 | `DELETE /roster/groups/{id}?rowVersion=`                                                                                                                            | `roster.groups.delete`                 |
| Time slot pickers                      | `GET /scheduling/options/time-slots`                                                                                                                                | (planner or time-slot view)            |
| Enrolment tabs (Active / Discontinued) | `GET /roster/groups/{id}/enrolments?status&q&page&pageSize`                                                                                                         | `roster.enrolments.view` (green icon)  |
| Enroll New Employee                    | `GET /employees/lookup?permission=roster.enrolments.enroll&q&page&pageSize=50` → `{data, meta}` (server search, "Load more"), `POST /roster/groups/{id}/enrolments` | `roster.enrolments.enroll`             |
| Discontinue                            | `PATCH /roster/enrolments/{id}/discontinue` `{endDate: null, rowVersion}` (today)                                                                                   | `roster.enrolments.edit`               |
| Delete enrolment (new)                 | `DELETE /roster/enrolments/{id}?rowVersion=`                                                                                                                        | `roster.enrolments.delete`             |

Shape changes:

- `RosterGroupDetail` / `RosterGroupRow` = `RosterGroupOut`: `fromDate`, `toDate`, `description`, `enrolledCount`,
  `workingDays` (list), `days[]` (single item, seven, Monday first) with `weekday` 1–7, `isDayOff`, `timeSlotId`,
  `timeSlotCode/Name`, `startTime/endTime` (`HH:mm:ss`), `isOvernight`, `durationMinutes`, `workableMinutes`,
  `rowVersion`. Removed: group `clockIn/clockOut/applyToAll`, per-day `clockIn/clockOut/isWeekend`.
- `RosterGroupInput` = `{title, fromDate, toDate, description, isActive, days[{weekday, isDayOff, timeSlotId}], rowVersion?}`.
- `RosterEnrollment` = `EnrolmentOut` (`employeeCode/Name`, `departmentName`, `designationName`, `branchName`,
  `rosterGroupTitle`, `rowVersion`). Removed `branchId`, `locationName`, the `currentRoster` of a candidate.
- Enrol body `{employeeIds, startDate, endDate}` (`branchId` removed); answer `{data: Enrolment[]}`.
- Ids are strings; the backend accepts numeric strings for its `int` fields.

UI changes:

- The week picks a **time slot per weekday** (Select with "name (09:00–17:00)"), or Day Off; times and Defined Minutes
  are read from the slot. "Apply For All" now copies a default **time slot** (form-only field `defaultTimeSlotId`; on
  edit it is ticked when every working day uses the same slot).
- New fields: From Date (required), To Date (optional, open-ended), Description. Title limit 60 → 200 (API).
- API field errors (`title` duplicate `ROSTER_GROUP_DUPLICATE`, `fromDate`, `toDate`) land on the field.
- Enrolment table: Location column and column sorting removed (no API field / no sort parameter); the code is shown
  next to the name; row menu has Discontinue and Delete.
- Enroll form: Branch removed; Start Date limited to the group's period (hint shows it); the picker no longer marks
  people already on a roster (the lookup does not say) — the API's 409 `ENROLMENT_OVERLAP` shows under the list.
  The picker searches on the server (`q`, code or name, debounced) and shows 50 people a page with "Showing n of
  total" and **Load more** (next `page`), so more than 100 people are reachable; "Select all" ticks those shown.
- Delete of a group with enrolments shows the API's 409 message ("Employees are enrolled …").

## Scheduling (`/scheduling`)

| Screen / action                                        | Route(s)                                                                                                                                                                                                                                                               | Permission                             |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Board, week / month / custom range (≤ 93 days)         | `GET /scheduling/schedules?tab&from&to&page&pageSize&q&employeeStatus&employeeId&departmentId&branchId&locationId&designationId&employmentTypeId&employeeGroupId&gradeId&timeSlotId&rosterGroupId`                                                                     | `scheduling.schedules.view`            |
| Year view                                              | `GET /scheduling/schedules/year?year&tab&…filters`                                                                                                                                                                                                                     | view                                   |
| Active Status box                                      | `GET /scheduling/schedules?tab=my&from=today&to=today&pageSize=1` (first shift)                                                                                                                                                                                        | view                                   |
| Export                                                 | `GET /scheduling/schedules/export?tab&from&to&…filters` (CSV from the API)                                                                                                                                                                                             | `.export`                              |
| Create Scheduling                                      | `POST /scheduling/schedules/batches`                                                                                                                                                                                                                                   | `.create`                              |
| Apply Default Shift                                    | `POST /scheduling/schedules/default-shift`                                                                                                                                                                                                                             | `.create`                              |
| View / Edit a shift                                    | `GET /scheduling/schedules/{id}`, `PUT /scheduling/schedules/{id}`                                                                                                                                                                                                     | view / `.edit`                         |
| Move a shift (‹ › arrows, drag along the row)          | `GET` then `PUT /scheduling/schedules/{id}` with the new `workDate` (times and breaks kept)                                                                                                                                                                            | `.edit`                                |
| Swap (dialog, drag onto another person same date)      | `POST /scheduling/schedules/{id}/swap` `{withScheduleId}` or `{withEmployeeId}`                                                                                                                                                                                        | `.edit`                                |
| Delete a shift                                         | `DELETE /scheduling/schedules/{id}?rowVersion=`                                                                                                                                                                                                                        | `.delete`                              |
| Multi Edit / Multi Delete                              | `POST /scheduling/schedules/bulk-edit`, `POST /scheduling/schedules/bulk-delete {ids}`                                                                                                                                                                                 | `.edit` / `.delete`                    |
| Delete Scheduling (range)                              | `POST /scheduling/schedules/bulk-delete {startDate,endDate,employeeIds                                                                                                                                                                                                 | allEmployees,deleteRestDays}`          | `.delete` |
| Create New Rest Day (also used by Attendance settings) | `POST /scheduling/settings/rest-days`                                                                                                                                                                                                                                  | `scheduling.settings.rest_days.create` |
| Delete a rest day from the board                       | `POST /scheduling/settings/rest-days/delete-range` (that day, that person)                                                                                                                                                                                             | `scheduling.settings.rest_days.delete` |
| Pickers                                                | `GET /scheduling/options/{time-slots,break-types,roster-groups}`, `GET /attendance/settings/geo-fences?isActive=true&pageSize=100`, `GET /organisation/lookups/{kind}`, `GET /employees/lookup?permission=…&q&branchId&departmentId&page&pageSize=50` (`{data, meta}`) |                                        |

Shape changes:

- The board is no longer one `entry` per day: `BoardRow = {employee, shifts[], restDays[], holidays[]}`;
  `BoardEmployee` (`code`, `designationName`, `departmentName`, `status`, `defaultTimeSlotName`, `plannedMinutes`,
  `shiftCount`); `BoardShift` (`workDate`, `startAt/endAt` local date-times, `timeSlot*`, `timeSlotColor`,
  `isOvernight`, `geoFenceId/Name`, `isWfh`, `plannedMinutes`, `rowVersion`); `dayTotals` is an array
  (`workDate`, `plannedMinutes`, `shiftCount`). Planned minutes come from the API (no client maths).
- `ScheduleDetail` (one shift) with `breaks[{breakTypeId, breakTypeName, startAt, endAt, isInclusive}]`.
- Inputs: `ScheduleBatchInput`, `DefaultShiftInput`, `ScheduleInput`, `SwapInput`, `BulkEditInput`, `BulkDeleteInput`,
  `RestDayRuleInput`, `RestDayRangeDeleteInput` (weekdays as 1–7, Monday = 1). Results: `ScheduleBatchResult`
  (`createdCount`, `replacedCount`, `skippedRestDays`, `skippedNoShift`), `BulkDeleteResult`, `BulkEditResult`.
- The URL filters became API ids: `department` → `departmentId`, `group` → `employeeGroupId`, `employmentType`
  → `employmentTypeId`; added `designationId`, `gradeId`, `timeSlotId`. `status` is now an `hr.employee.status`
  (active, probation, notice, inactive, left) or `all` (default `all`; `active` alone would hide probation staff).
- The old types `ScheduleEntry`, `TimeSlotRules`, `ScheduleBreak`, `BreakType`, `GeoFence(Shape)`, `RepeatRule` are kept
  (`types/mock-store.types.ts`) only because other modules' mocks read and write the mock store in that shape. Same for
  `RosterGroup` / `RosterDaySchedule` in Roster. They are not API shapes.

UI changes:

- **Create Scheduling**: "Shifts from" Time Slot **or** Time Roster (the API takes one); Days (weekday chips, all = every
  day) with Repeat (0–8 weeks) and Step counted from the start week; one Geo Fence (select, the API stores one);
  Breaks rows are break type + times + inclusive and **replace** the slots' breaks (none = keep them).
  Step 2 is a summary (slot times, roster), Work From Home, the dates it covers (roster days off left out), "Replace
  shifts already planned" (`replaceExisting`; a 409 `SCHEDULE_OVERLAP`/`SCHEDULE_DAY_TAKEN` says to tick it) and the
  employees (optional with a roster: its enrolled members). Removed: the free Time Slot editor (name, times, overnight,
  Reverse Decision, Total Duration / flexible hours, overtime) — those are time slot settings; the "Rest Days"
  toggle (not built: rest days come from the rest-day form); several geo fences; Repeat From/To (the batch dates are
  the range); per-break dates and description.
- **Apply Default Shift**: no Roster Group select (the API uses each person's enrolled roster, else their default slot);
  adds "Replace shifts already planned".
- **Edit Scheduling**: Date (moves the shift), Time Slot, "Other times than the slot's" (start/end), Geo Fence, Work
  From Home. Breaks are kept (read-only list) unless the slot changes. Removed: Time Roster, Rest Days.
- **View Scheduling**: slot name/code, times, planned hours, geo fence, breaks, Full/Short Overtime, Rest Day, WFH.
  Rest-day cells get their own small view (payable, made by a rule or a request) and Delete.
- **Multi Edit**: Time Slot, Geo Fence or "Remove geo fence", Work From Home (keep / yes / no). Other fields removed.
- **Swap**: same date only; pick the person (and their shift when they have several). Dragging onto the same person's
  other day moves it; onto another person's same day swaps/gives; anything else shows a toast.
- **Board**: cell colour from the slot's own colour (Scheduling settings), else the drawn tones per slot; holidays
  shown as an amber chip (new legend dot); a day with several shifts shows the first and "+n"; the name column shows
  the default time slot and the employee status text. Export uses the API's CSV. **Import removed** (not in the
  API's first build). Year view reads the API's month totals and shows rest days.
- **Geo fence "+" (draw a new fence) removed**: fences are made in Attendance → Settings → Geo Fencing (backend decision
  "pick only"). The geo-fence dialog file was deleted.
- **EmployeeSelector** (also used by Payroll): reads `GET /employees/lookup` and takes a new optional `permission` prop
  (default `employees.directory.view`; the scheduling dialogs pass `scheduling.schedules.create`/`.delete`,
  `scheduling.settings.rest_days.create`). Filters shown: search (`q`, on the server, debounced), Department
  (`departmentId`), Branch (`branchId`) — what the lookup supports. Location, Designation, Grade, Employment Type,
  Group and Gender are accepted in `filters` and ignored. "All Employees" lists 50 a page (`page`, `pageSize=50`)
  with "Showing n of total" and **Load more**, so more than 100 people are reachable (the old `limit=200` would now
  give only 100); "All" ticks the people shown.
- **Planner Employee filter**: a server-searched drop-down (Payroll's `EmployeeSearchSelect`, `permission =
scheduling.schedules.view`, `q`/`page`/`pageSize`, Load more) instead of a fixed list of the first page.
- **RestDayDialog** (also used by Attendance settings): From / To, Repeat, Step, days, payable, employees → rest-day
  rule. Its separate "Start Date" was removed (the rule's From is the start).
- Buttons are hidden by permission (`useCan`): Apply Default Shift / Create (`.create`), Delete and Multi Delete
  (`.delete`), Export (`.export`), Edit / Swap / move arrows / drag / Multi Edit (`.edit`), rest-day create/delete.
  In mock mode (no permissions list) everything shows.

## Gaps

Backend features with no screen:

- **Time slot settings** (`/scheduling/settings/time-slots` CRUD: colour, flexible + workable minutes, overtime flags,
  breaks). Roster and planner only pick slots; nothing in the frontend can create one.
- Rest-day rule list / edit / delete and holidays (Attendance settings tabs — the attendance agent's).
- Edit an enrolment's dates (`PUT /roster/enrolments/{id}`): API call exists (`rosterApi.updateEnrollment`), no form.
- Discontinue on a chosen date (UI always sends today).
- Employee default time slot (`hr.employee.default_time_slot_id`) used by Apply Default Shift: the employee form
  (employees agent) should set it.
- Several shifts on one day (`allow_multi_shift`): the board shows the first and "+n"; the others are reachable only
  through swap/edit of the first.

Screens / controls with no backend:

- Schedule Import (CSV) — "not in first build"; `parseScheduleCsv` kept for later.
- Reverse Decision, Total Duration (hours per period), overtime allowance minutes on a slot.
- Create Scheduling "Rest Days" toggle; several geo fences per shift; drawing a geo fence from the planner.
- Roster enrolment branch and location; enrolment table sorting.
- A rest-day cell "Edit" (turn a rest day back into a shift): delete the rest day and add a shift instead.

Backend notes (not bugs, worth knowing):

- No status endpoint for roster groups: the switch re-sends the whole group (GET + PUT).
- No planner option for geo fences: `GET /attendance/settings/geo-fences` needs `attendance.settings.geo_fencing.view`;
  without it the picker says fences could not be loaded. A `GET /scheduling/options/geo-fences` (planner permission)
  would match the other pickers.
- No "current roster" on the employee lookup, so the enrol picker cannot grey out people already on a roster.
- The batch 409 code is `SCHEDULE_OVERLAP` for time overlaps and `SCHEDULE_DAY_TAKEN` for one-shift-per-day; both
  are handled.

## Mock mode

- `src/mocks/roster/handlers.ts` and `src/mocks/scheduling/handlers.ts` answer the routes above in the API's shapes.
  The stores keep the old record shapes (`rosterGroups`, `enrollments`, `scheduleEntries`, `geoFences`,
  `restDayBatches`) because the attendance, requests, leaves and payroll mocks read and write them.
- New `src/mocks/scheduling/time-slots.ts`: time slots and break types. Slots that match a seeded roster group keep
  the group's id (`rg_morning` …) because the payroll mock treats roster groups as time slots.
- Not mocked here (other modules' mocks serve them): `/scheduling/settings/*` (attendance),
  `/employees/lookup` (the shared paged `lookupPage` mocks: attendance for attendance codes, then the settings /
  payroll fallbacks; `departmentId` is not filtered there) and `/organisation/lookups/{kind}` (payroll's
  `lookup-handlers.ts`), `/attendance/settings/geo-fences` (attendance).
- Holidays are always empty on the mock board; rest days created through the attendance mock's rest-day rules do
  not appear on the mock board (separate stores).
