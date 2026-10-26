# Manpower Planning and Benefits: frontend ↔ backend mapping

Features: `src/features/manpower-planning` (sidebar → Planning, E-Budgeting, Open Positions, Budget Approvals,
E-Budget Settings) and `src/features/benefits` (sidebar → Benefits). Mocks: `src/mocks/manpower-planning`,
`src/mocks/benefits`. Routes: `src/routes/_app/manpower-planning/**`, `src/routes/_app/benefits/**` (unchanged; the
search schemas in `routing.ts` of each feature are unchanged too).
Backend: `backend/app/routers/{manpower,benefits}.py`, `schemas/{manpower,benefits}.py`,
`catalogue/{manpower,benefits}.py`; comparison `09-manpower-benefits.md` and `14-files-and-events.md`.
Checked against the running API (dev company, 26 Oct 2026): every list, create, edit, decision and delete below was
called and its JSON compared with the types (`types/manpower.types.ts`, `types/benefits.types.ts` mirror
`*Out` / `*In` of the schemas; there is no mapping layer, except the two lookup shapes noted below).

Both features now use the backend's names and ids (strings), send `rowVersion` on every edit, decision and delete
(`?rowVersion=` on deletes), and show buttons only for the codes the user holds (`useCan`, codes in
`MP_CODES` / `BEN_CODES` of each feature's `constants.ts`). In mock mode (no permissions list) everything shows.

## Manpower Planning

### Routes used

| Screen / action                          | Route                                                                                                                                                                                                          | Permission (button shown with)                                       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Form pickers (all screens)               | `GET /organisation/lookups/{divisions,branches,departments,employee-groups,grades,cost-centers,job-titles}`, `GET /manpower/budget-durations?pageSize=100`, `GET /manpower/positions?pageSize=100` (all pages) | any signed-in user / `DURATIONS_READ`, `POSITIONS_READ`              |
| People pickers                           | `GET /employees/lookup?permission=<screen code>&q&departmentId&branchId&page&pageSize` → `{data, meta}` (all pages for Import Existing Employees and HR contacts)                                              | —                                                                    |
| Planning list                            | `GET /manpower/plans?q&budgetDurationId&mode&status&isCurrent&page&pageSize`                                                                                                                                   | `manpower.planning.view`                                             |
| Add / Edit Planning                      | `POST /manpower/plans`, `PUT /manpower/plans/{id}` (`PlanIn`: header, `lines[]`, `fileIds[]`, `rowVersion`)                                                                                                    | `.planning.create` (Add New Plan) / `.planning.edit` (row menu Edit) |
| Plan Details, Approvals dialog           | `GET /manpower/plans/{id}` (`PlanDetailOut`: lines, budgets, files)                                                                                                                                            | `.planning.view`                                                     |
| Delete plan                              | `DELETE /manpower/plans/{id}?rowVersion=` (disabled while `isLocked`)                                                                                                                                          | `.planning.delete`                                                   |
| Plan attachments                         | `POST /files` (module `manpower`) then `fileIds` on the plan                                                                                                                                                   | any signed-in user                                                   |
| E-Budgeting list                         | `GET /manpower/budgets?q&page&pageSize`                                                                                                                                                                        | `manpower.e_budgeting.view`                                          |
| Add Budget (new) / Edit Budget           | `POST /manpower/budgets`, `PUT /manpower/budgets/{id}` (`BudgetIn` + `rowVersion`)                                                                                                                             | `.e_budgeting.create` / `.edit`                                      |
| Delete budget                            | `DELETE /manpower/budgets/{id}?rowVersion=`                                                                                                                                                                    | `.e_budgeting.delete`                                                |
| Budget Approvals list                    | `GET /manpower/budget-approvals?q&status&page&pageSize` (Status select: Pending (default), Active, Rejected, All = `status=`)                                                                                  | `manpower.budget_approvals.view`                                     |
| Approve / Reject                         | `POST /manpower/budgets/{id}/approve` · `/reject` `{rowVersion, remarks: null}`                                                                                                                                | `.budget_approvals.approve` / `.reject`                              |
| Open Positions list                      | `GET /manpower/open-positions?q&page&pageSize`                                                                                                                                                                 | `manpower.open_positions.view`                                       |
| JD download                              | `GET /manpower/open-positions/{id}/jd` (fresh signed `url`), opened as a download                                                                                                                              | `.open_positions.download`                                           |
| Edit open position (count, end date, JD) | `POST /files` (module `manpower`) then `PUT /manpower/open-positions/{id}` `{totalPositions, endDate, jdFileId, rowVersion}`                                                                                   | `.open_positions.edit`                                               |
| Close / Reopen                           | `POST /manpower/open-positions/{id}/close` · `/reopen` `{rowVersion}`                                                                                                                                          | `.open_positions.close` / `.reopen`                                  |
| Budget Duration tab                      | `GET/POST /manpower/budget-durations`, `PUT …/{id}`, `DELETE …/{id}?rowVersion=`                                                                                                                               | `.settings.budget_durations.*`                                       |
| Position Title tab                       | `GET /manpower/position-titles?q&page&pageSize` (read only)                                                                                                                                                    | `.settings.position_titles.view`                                     |
| Employee Position tab                    | `GET /manpower/positions?q&jobTitleId&branchId&divisionId&departmentId&employeeGroupId&status`, `POST`, `PUT …/{id}`, `DELETE …/{id}?rowVersion=`                                                              | `.settings.positions.*`                                              |
| Activate / Deactivate (row menu)         | `PUT /manpower/positions/{id}` with the whole position and the other `status`                                                                                                                                  | `.settings.positions.edit`                                           |
| Salary Ranges (row menu, new)            | `GET /manpower/positions/{id}/salary-ranges`, `POST …/salary-ranges {effectiveDate, minSalary, maxSalary}`                                                                                                     | view / `.settings.positions.edit`                                    |
| Upload Excel                             | CSV read in the browser → `POST /manpower/positions/import {rows: [{code, positionTitle, station, employeeGroup, division, department, subDepartment, costCenter, grade, reportsTo, minSalary, maxSalary}]}`   | `.settings.positions.import`                                         |

### Shape changes

- **Stamps**: `added` / `modified` / `decided` / `approved` objects (`{at, byName, byRole}`) → the flat
  `createdAt/createdByName`, `updatedAt/updatedByName`, `decidedAt/decidedByName`, `approvedAt/approvedByName`. The
  role the designs draw after the name is not sent, so it is not shown.
- **Lookups**: the frontend's own `GET /manpower-planning/lookups` is gone. `ManpowerLookups` is built from
  Organisation's pickers, the durations and the positions (`manpowerApi.lookups`). Stations are branches; a
  sub-department is a department whose `parentId` is the chosen department; divisions no longer narrow departments
  (Organisation does not link them). People come from `GET /employees/lookup` (no salary, no ids of department or
  branch: names only).
- **Budget duration**: + `planCount`, `budgetCount`, `rowVersion`.
- **Position title**: `{title, active, added, modified}` → Organisation's job title `{name, positionCount,
activePositionCount, openPositionCount, createdAt, createdByName, updatedAt}`.
- **Employee position**: `positionTitleId → jobTitleId` (+ `jobTitleName`), `stationId → branchId`, `active →
status: active|inactive`; + names of every id, `reportsToId` is a **position** (was a person) with
  `reportsToCode/Title`, new `employeeId/employeeName` (the person in the seat), `minSalary/maxSalary` are the band in
  force today and may be `null`.
- **Import**: rows by names with string amounts; result `errors: string[]` → `{rowNo, field, message}[]` (shown as
  "Line n: message", line = rowNo + 1 for the header).
- **Plan**: `durationId → budgetDurationId`, `stationId → branchId`, `planningYear → budgetDurationName`,
  `locked → isLocked`, `modes → hasNewPositions/hasExistingPositions`; + names, `submittedAt`, `budgetCount`,
  `approvedBudgetCount`, `rowVersion`. Detail: `newPositions[]` / `existingPositions[]` → one `lines[]` with
  `kind: new_position|existing_employee`, priced by the server (`months`, `totalSalary`, `annualGross`, `eBudgetId`);
  - `files[]` (`{attachmentId, id, name, url…}`).
- **Plan input**: lines carry `startDate/endDate` (dates, not months), `headcount` (new), optional `minSalary`,
  `maxSalary`, `monthlySalary`, `totalAllowance` (blank = the server's default); per-line division / station /
  department / group are gone (they come from the position); + `fileIds`, `rowVersion`.
- **Budget**: `durationId/duration → budgetDurationId/budgetDurationName`, `planId → manpowerPlanId` (+ `planTitle`),
  `positions → totalPositions`, status `active → approved` (still drawn as the green "Active"); + `jobTitleId/Name`,
  `departmentId/Name`, `remarks`, `openPositionCount`, `rowVersion`. Input: + `title`, `budgetDurationId`,
  `jobTitleId`, `departmentId`, `totalPositions`.
- **Open position**: `budgetId → eBudgetId`; + plan, position, title, department, branch, `approvedPositions`,
  `jdFile {id, name, url}`; `endDate` may be `null`. The JD endpoint returns a file reference with a signed `url`
  (was `{fileName, text}`).
- **Errors**: field errors keep the API's names; the plan form maps `lines[i].field` to its line
  (`planErrorPath`: new positions are sent first).

### UI changes

- Planning filters: "Planning Year" (a year box the API cannot filter by) is replaced by **Current Planning** (`isCurrent`);
  "Showing:" stays the plan year (`budgetDurationId`). Title search uses `q`.
- Add Planning, new positions: **Head Count** column added; Division, Station, Department, Sub-Department and Employee
  Group are read-only facts of the chosen position (were selects per line); Min / Max Salary may be left blank (the
  position's band); Total Salary = (max + allowance) × head count. The month boxes stay; a month is sent as its first
  and last day (a plan saved elsewhere with mid-month dates is rounded to whole months when re-saved here).
- Add Planning, existing positions: Monthly Salary may be blank ("Current", Payroll's salary at save); the monthly total
  then reads "… + current salaries". Position / Department / Station show the person's names from the lookup. The
  employee picker lists up to 100 people (the lookup's cap); Import Existing Employees asks the lookup for the plan's
  department and station.
- Add Planning: an **Attachments** section (upload, list with links, remove) for `fileIds`.
- Plan list: Delete is disabled on a locked plan.
- E-Budgeting: **Add Budget** button (a budget by hand) and a fuller Edit Budget (title, duration, position title,
  department, amount, positions, dates; a plan's budget keeps its plan year, title and department).
- Budget Approvals: a **Status** select (Pending by default, as the API).
- Open Positions: the position's department and station under its title; **No JD yet** instead of a download when
  none is attached; Edit uploads / replaces / removes the JD.
- Position Title tab: read only (counts of employee positions and open positions) with **Manage Job Titles** linking to
  Settings → Job Titles; Add / Edit / Activate / Deactivate / Delete and the Status filter are gone (no
  `is_active` on `org.job_title`).
- Employee Position tab: filters reduced to what the API filters (code/title search, division, station, department,
  group, position title, status); Sub-Department, Cost Center, Reports To and Grade filters removed. Dialog: Reports To
  lists positions; **Held By** added; code blank = next number. Row menu: **Salary Ranges** dialog (history + add).
- HR contacts (phone icon) read the HR department's people from the employee lookup.

### Gaps

Frontend has, backend does not:

- Budget decision remarks are accepted by the API but not asked for (the confirm popup has no box).
- Position title Active / Inactive and title CRUD here (Organisation's; `is_active` missing on `org.job_title`).
- Filters on positions by sub-department, cost centre, reports-to, grade (removed).
- Plan "Planning Year" filter by calendar year (replaced).

Backend has, frontend does not use:

- `GET /manpower/budgets?budgetDurationId&planId&departmentId&status`, `GET /manpower/open-positions?jobTitleId&departmentId&status`
  filters (only search is offered); `GET /manpower/budgets/{id}`, `GET /manpower/open-positions/{id}`,
  `GET /manpower/positions/{id}`, `GET /manpower/budget-durations/{id}` (lists carry everything).
- `manpower.open_positions.export`, `.settings.position_titles.export` codes (no export buttons).

## Benefits

### Routes used

| Screen / action                           | Route                                                                                                                                                                                                          | Permission (button shown with)                                      |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Stats row, Employees (n)                  | `GET /benefits/summary`                                                                                                                                                                                        | `benefits.plan_years.view`                                          |
| Pickers                                   | `GET /benefits/plan-years`, `GET /benefits/plans` (all pages), `GET /employees/lookup?permission=benefits.enrollment_windows.create` (all pages; the people list searches with `q&departmentId&page&pageSize`) | —                                                                   |
| Plan Years list                           | `GET /benefits/plan-years?pageSize=100` (the "Showing:" year filters in the browser)                                                                                                                           | `.plan_years.view`                                                  |
| New Plan Year / Edit Plan Year / New Hire | `POST /benefits/plan-years`, `PUT /benefits/plan-years/{id}` (`PlanYearIn` + `rowVersion`)                                                                                                                     | `.plan_years.create` / `.edit`                                      |
| Delete plan year                          | `DELETE /benefits/plan-years/{id}?rowVersion=`                                                                                                                                                                 | `.plan_years.delete`                                                |
| Open Enrollment / Qualifying Life Event   | `POST /benefits/enrollment-windows` (`kind` open_enrollment / life_event)                                                                                                                                      | `.enrollment_windows.create`                                        |
| Plans list                                | `GET /benefits/plans?planYearId`                                                                                                                                                                               | `.plans.view`                                                       |
| Add {Category} Plan                       | `POST /benefits/plans`, then `POST /files` (module `benefits`) and `POST /benefits/plans/{id}/files {fileId}`                                                                                                  | `.plans.create`                                                     |
| Copy / Delete plan                        | `POST /benefits/plans/{id}/duplicate`, `DELETE /benefits/plans/{id}?rowVersion=`                                                                                                                               | `.plans.create` / `.plans.delete`                                   |
| Enrollment Windows list / delete          | `GET /benefits/enrollment-windows?planYearId`, `DELETE …/{id}?rowVersion=`                                                                                                                                     | `.enrollment_windows.view` / `.delete`                              |
| Employees tab                             | `GET /benefits/employees?planYearId&missingOnly&page&pageSize` (pager)                                                                                                                                         | `.elections.view`                                                   |
| Update (missing information)              | `POST /employees/{id}/update-requests {changes: {dateOfBirth?, maritalStatus?, homeAddress?}}`                                                                                                                 | `employees.update_requests.create`                                  |
| Files tab                                 | `GET /benefits/files?planYearId`; Add File: `POST /files` + `POST /benefits/plans/{id}/files`; Remove: `DELETE /benefits/files/{attachmentId}?rowVersion=`                                                     | `.files.view` / `.create` / `.delete`; links with `.files.download` |

### Shape changes

- **Lists** are paginated (`{data, meta}`); the tabs read every page (100 a page) since they show no pager, except
  Employees (25 a page with a pager).
- **Lookups**: `GET /benefits/lookups` is gone; built from plan years, plans and the employee lookup
  (`{id, name, jobTitle, department}` mapped from `jobTitleName/departmentName`; departments are the people's
  department names). Carriers stay a fixed list (the API keeps free text).
- **Plan year**: `newHireStart` values `waiting-period / per-employee → waiting_period / per_employee`; + required
  `waitingPeriodDays` with a waiting period, `planCount`, `windowCount`, `rowVersion`, server `status`.
- **Plan**: `planTypeId → planTypeRef`; `attachmentName/Size`, `eligibility`, `notEnrolled` gone; + `description`,
  `status`, `enrolled`, `pending`, `fileCount`, `planYearIds`, `rowVersion`.
- **Enrollment window**: `enrollmentEndDate → closesOn`; + `kind`, `description`, `electionCount`, `rowVersion`;
  `employeeIds: []` means everyone.
- **Employees tab**: `{elections[], missing (labels), profile}` → `BenefitEmployeeOut` (`code`, `jobTitleName`,
  `departmentName`, `dateOfBirth`, `maritalStatus`, `missing: ['date_of_birth' | 'marital_status']`, one
  `electionId/electionStatus` for the chosen plan year). Election status adds `rejected`.
- **Files**: `{fileName, size, addedOn}` → `BenefitFileOut` (`id` = attachment, `fileId`, `sizeBytes`, `file {url}`,
  `createdAt`, `rowVersion`).
- **Profile update**: `PUT /benefits/employees/{id}/profile` → the Employees module's Update Information request;
  marital status values are lower case.

### UI changes

- New Hires step: **How many days is the waiting period?** appears with "After a waiting period" (required).
- Enrollment window: works from the Qualifying Life Event item as kind `life_event` (title "New Qualifying Life Event
  Window"); step 2 may be left empty (everyone may enroll), said under its question; `closesOn` is the last day.
- Enrollment Windows tab: + Kind and Elections columns; Employees shows "Everyone" for an open window.
- Plans tab: "Eligible" (always Full-Time, not in the API) → **Carrier** (carrier · type) and **Status** (Active /
  Inactive); the old Status text → **Elections** ("n enrolled, n pending").
- Add Plan: **Description** added; the attachment is optional (uploaded after the plan is saved; a failed upload
  keeps the plan and says so).
- Employees tab: **Election** column for the chosen plan year ("Choose a plan year" otherwise), code under the name,
  pager. Update Information sends a request HR approves ("Send to HR"); Home Address is optional.
- Files tab: names link to the signed URL; **Add File** and remove.
- Plan Years: a refused delete closes the confirm and shows the server's message.

### Gaps

Frontend has, backend does not:

- "Eligible" (Full-Time) on plans; the Coverage Options / Eligibility & Cost / Enrollment Details / Payroll deduction
  steps of Add Plan (still disabled).
- Home address is not in the "missing information" the API reports (only date of birth and marital status).

Backend has, frontend has no screen for:

- **Elections**: `GET/POST /benefits/elections`, `GET/PUT /benefits/elections/{id}`,
  `POST /benefits/elections/{id}/approve|reject` (`benefits.elections.*`). The Employees tab shows each person's
  election status only; electing, waiving and approving have no screen (types `Election` are ready).
- **Health benefits**: `GET/POST /benefits/health-benefits`, `GET/PUT/DELETE …/{id}` (`benefits.health.*`, with a
  `documentFileId` upload, module `benefits`). Not built.
- **Perks**: `GET/POST /benefits/perks`, `GET/PUT/DELETE …/{id}` (`benefits.perks.*`, occasions eid_ul_adha,
  eid_ul_fitr, birthday, ramadan, new_year). Not built.
- Plan edit (`PUT /benefits/plans/{id}`), window edit (`PUT /benefits/enrollment-windows/{id}`) and `GET …/{id}`
  routes: the frontend has no edit screens for them.

## Backend observations

- `DELETE /manpower/budget-durations/{id}` for a duration in use answers 409 with code `CONFLICT` and no field error,
  although the procedure throws `DURATION_IN_USE` (the message is right).
- Approving an already-decided budget with its old `rowVersion` answers the generic 409 `CONFLICT` ("Someone else
  changed this budget") rather than `BUDGET_DECIDED`; the UI disables Approve / Reject on decided rows anyway.
- ~~`GET /employees/lookup` caps `limit` at 100~~: resolved — the lookup is searched (`q`) and paged on the server
  and returns `departmentId` / `branchId`; see Employee pickers.
- `POST /manpower/positions/{id}/salary-ranges` with a past effective date does not change the band shown on the
  position when a later range exists (the band is the latest range not after today) — as designed, noted for users.

## Employee pickers

Every people picker calls `GET /employees/lookup` with `q` (code or name, debounced 300 ms) and reads the paged
`{data, meta}` 50 at a time, with **Load more** while more pages remain, so more than 100 people work:

- Manpower Planning: the plan's existing-position **Employee** cell and the Employee Position dialog's **Held By**
  (Payroll's `EmployeeSearchSelect`; the line's / seat's person is passed as `known` so it keeps its name).
  **Import Existing Employees** and the HR contacts read every page (`manpowerApi.allEmployees`).
  `manpowerApi.employees` takes `q`, `page`, `pageSize` and returns one page.
- Benefits: the enrollment window's **Available Employees** list searches on the server, filters by `departmentId`
  ("All Employees" lists departments by id) and has **Load more**; "Add everyone listed" adds the loaded rows.
  `benefitsApi.lookups` reads every lookup page (names the selected people, lists departments and HR contacts).

## Decisions

- Mock data for Organisation's pickers and the employee lookup lives in `src/mocks/manpower-planning/org-lookups.ts`
  (both features' handler lists include it). The tests put these handlers first (`server.use`) so other features'
  mocks of the same shared routes cannot change their data.
- Ids are sent as the strings the API returns (the API accepts numeric strings).
- The plan form keeps month boxes for new positions (the design) and sends whole months.
- Benefits plan years are listed whole and filtered by the "Showing:" year in the browser (the API has no id filter).

## Needs from shared files

- `src/mocks/files/handlers.ts`: `POST /files` fails in jsdom (undici's multipart parser rejects jsdom's `File`), so
  every upload in a Vitest run gets a 500. These tests answer `POST /files` themselves (`acceptUploads`). A fix there
  (e.g. read `request.text()` and parse the name, or polyfill `File`) would let tests use the shared mock; exporting a
  way to read an upload's name would let mocks show real file names (they now name attached files by id).
- `src/mocks/handlers.ts`: no change needed; a shared `src/mocks/organisation` lookup mock would let every feature
  agree on one sample company.
