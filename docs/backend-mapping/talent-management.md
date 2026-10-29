# Talent Management → Employees: frontend ↔ backend mapping

Feature: `src/features/talent-management` (sidebar → Talent Management). Mocks: `src/mocks/talent-management`.
Routes: `src/routes/_app/talent-management.tsx` (layout with the sub menu), `talent-management/index.tsx` (redirect),
`talent-management/employees/index.tsx`, `talent-management/employees/$employeeId.tsx`.
Backend: the `/api/employees…` operations of HRango API 0.1.0, as extracted in
`HRango2/Design/talent-management/api/employees-openapi.md` (26 Oct 2026). Not checked against the running API (this
module was built against the extract and the mocks only).

The types in `types/employees.types.ts` mirror `EmployeeOut` / `EmployeeIn` and the child tables' `*Out` / `*In`; there
is no mapping layer. Ids are the API's strings, dates `yyyy-MM-dd`, every edit, state change and delete carries the
`rowVersion` last read (`?rowVersion=` on deletes).

## Routes and search params

| Screen           | Route                                      | Search params                                                                                                                                |
| ---------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| (redirect)       | `/talent-management`                       | → `/talent-management/employees`                                                                                                             |
| Employee Record  | `/talent-management/employees`             | `q`, `status`, `branchId`, `departmentId`, `designationId`, `includeInactive=true`, `page`, `pageSize` (10/20/50), `dialog=add`, `edit=<id>` |
| Employee profile | `/talent-management/employees/$employeeId` | `tab=personal\|work\|documents\|dependents\|benefits\|leave\|skills` (default personal, left out of the URL)                                 |

The layout's sub menu: Employees only. Transfer, Salary Revision and Employee Accounts stay in Requests and
Payroll and are not linked from it (the profile's Related card still links them for the person).

## Routes used

| Screen / action                         | Route                                                                                                                                                                                                                                                                                                       | Permission (button shown with)                    |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Employees table                         | `GET /employees?q&status&includeInactive&branchId&departmentId&designationId&page&pageSize`                                                                                                                                                                                                                 | `employees.directory.view` (sidebar: `employees`) |
| Tiles: Total Employees, Male, Female    | `GET /employees?page=n&pageSize=100` (every page, at most 20; Total = `meta.total`, Male / Female counted from `gender`)                                                                                                                                                                                    | —                                                 |
| Tile: On Probation                      | `GET /employees?status=probation&pageSize=1` → `meta.total`                                                                                                                                                                                                                                                 | —                                                 |
| Filter panel                            | `GET /organisation/lookups/{branches,departments,designations}`                                                                                                                                                                                                                                             | any signed-in user                                |
| HR contacts (phone icon)                | `GET /employees/lookup?permission=employees.directory.view&pageSize=100` (people whose department reads "Human Resource")                                                                                                                                                                                   | —                                                 |
| + Add New                               | `POST /employees` (`EmployeeIn`)                                                                                                                                                                                                                                                                            | `employees.directory.create`                      |
| Edit (row menu, profile ⋮)              | `GET /employees/{id}` (for `rowVersion`), `PUT /employees/{id}` (`EmployeeIn` + `rowVersion`; `cnic` left out)                                                                                                                                                                                              | `employees.directory.edit`                        |
| Form pickers                            | `GET /organisation/lookups/{branches,locations,areas,departments,divisions,cost-centers,designations,job-titles,grades,job-levels,employee-groups,employment-types}`; Line Manager / Final Authority `GET /employees/lookup?permission=employees.directory.view&q&page&pageSize` (server search, Load more) | —                                                 |
| Deactivate / Reactivate                 | `PATCH /employees/{id}/deactivate` · `/reactivate` `{rowVersion}`                                                                                                                                                                                                                                           | `employees.directory.deactivate`                  |
| Profile                                 | `GET /employees/{id}`                                                                                                                                                                                                                                                                                       | `employees.directory.view`                        |
| Camera badge                            | `POST /files` (module `employees`), then `PUT /employees/{id}/photo {fileId, rowVersion}`                                                                                                                                                                                                                   | `employees.directory.edit`                        |
| Update Profile                          | `PUT /employees/{id}` (the whole record with Full Name, Email, Phone, Address, Date of Birth, Marital Status changed), then `PUT /employees/{id}/identity {cnic, rowVersion}` when the CNIC changed                                                                                                         | `.directory.edit`; CNIC `employees.identity.edit` |
| Personal → Emergency Contacts           | `GET/POST /employees/{id}/emergency-contacts`, `PUT/DELETE …/{rowId}`                                                                                                                                                                                                                                       | list: view; buttons `employees.directory.edit`    |
| Work → Payroll History                  | `GET /payroll/payslips?scope=all&employeeId&page=1&pageSize=3` (`payrollApi.payslips`)                                                                                                                                                                                                                      | Payroll's                                         |
| Work → Loan Summary                     | `GET /requests/loan?view=all&employeeId&page=1&pageSize=3` (`standardApi.list('loan-advances')`)                                                                                                                                                                                                            | Requests'                                         |
| Work → Performance Details              | none (no performance API in the app): an empty table that says so                                                                                                                                                                                                                                           | —                                                 |
| Work → Attendance                       | `GET /attendance/time-sheet/summary?tab=all&employeeId&fromDate&toDate` (this month)                                                                                                                                                                                                                        | Attendance's                                      |
| Work → Bank Accounts                    | `GET/POST /employees/{id}/bank-accounts`, `PUT/DELETE …/{accountId}`                                                                                                                                                                                                                                        | buttons `employees.directory.edit`                |
| Documents → Academics                   | `GET/POST /employees/{id}/education`, `PUT/DELETE …/{rowId}`; file `POST /files` → `fileId`                                                                                                                                                                                                                 | buttons `employees.directory.edit`                |
| Documents → Contracts                   | `GET/POST /employees/{id}/contracts`, `PUT/DELETE …/{rowId}`; file → `fileId`                                                                                                                                                                                                                               | same                                              |
| Documents → Documents (Upload Document) | `GET/POST /employees/{id}/documents`, `PUT/DELETE …/{rowId}` (`fileId` required)                                                                                                                                                                                                                            | same                                              |
| Documents → Experience                  | `GET/POST /employees/{id}/experience`, `PUT/DELETE …/{rowId}`; a chosen file → `POST …/documents` (type `experience_letter`)                                                                                                                                                                                | same                                              |
| Dependents                              | `GET/POST /employees/{id}/dependents`, `PUT/DELETE …/{rowId}`                                                                                                                                                                                                                                               | same                                              |
| Benefits → Employee Benefits            | none (the Benefits API has no per-person contributions): an empty table that says so; View Details → `/benefits/employees`                                                                                                                                                                                  | —                                                 |
| Benefits → Benefit Accounts             | `GET /payroll/payslips/summary?employeeId` (`payrollApi.myAccounts`; benefit and pay-item accounts)                                                                                                                                                                                                         | Payroll's                                         |
| Leave → Leave Overview This Month       | `GET /leaves/balances?employeeId&pageSize=100` (entitled per type) + `GET /leaves/applications?tab=all&status=approved&employeeId&fromDate&toDate` (days this month)                                                                                                                                        | Leaves'                                           |
| Leave → list                            | `GET /leaves/applications?tab=all&employeeId&page=1&pageSize=5`                                                                                                                                                                                                                                             | Leaves'                                           |
| Skills                                  | `GET/POST /employees/{id}/skills`, `PUT/DELETE …/{rowId}`                                                                                                                                                                                                                                                   | buttons `employees.directory.edit`                |

**Permission codes are assumptions.** The extract names none for `/employees…`. The screens use the codes other modules
already send (`employees.directory.view` for pickers, `employees.update_requests.create` for Benefits' Update
Information) and extend them: `employees.directory.create`, `.edit`, `.deactivate`, `employees.identity.edit`
(`TM_CODES` in `constants.ts`). Child tables and the photo use `.directory.edit`. Check them against the catalogue.
In mock mode (no permissions list) everything shows.

Query keys: the Work, Benefits and Leave tabs read through the other features' APIs under those features' own keys
(`payrollKeys.list('payslips', …)`, `standardKeys.list('loan-advances', …)`, `attendanceKeys.summary(…)`,
`leavesKeys.applicationList(…)` / `.balances(…)`), so changes made on their screens refresh the profile too. Every
employee write invalidates `['employees']` (lists, tiles, records, child tables, and the shared employee lookup).

## Shape notes

- **Update Profile → `EmployeeIn`**: Full Name is split on the last space (`firstName` = all but the last word,
  `lastName` = the last word); Phone Number is `phone1`, Address `homeAddress`. The rest of the record is sent back as
  read. Server field errors map back (`firstName`/`lastName` → Full Name, `phone1` → Phone Number …).
- **CNIC**: sent on `POST /employees` only. Edits leave `cnic` out of `PUT /employees/{id}` (a masked CNIC must not be
  written back as blank) and change it through `PUT …/identity`. With `canSeeIdentity: false` the Personal tab shows
  "Hidden" and the field is not offered.
- **Experience** has no file in `ExperienceIn`; the popup's Upload Document becomes an `experience_letter` document
  titled "{Job Title} at {Company}". **In Process** on Academics is `isInProcess` (To Date cleared); on Experience and
  Contracts it means no `toDate`.
- **Contract "Status" switch**: `ContractIn` has no status (the API works out upcoming / active / expired from the
  dates), so the drawn switch is "In Process" (no end date). "Contract Duration in Months" sends `durationMonths` (3,
  6, 12, 24, 36) and fills To Date with From + months − 1 day; Custom sends `null` and lets the user pick To Date.
- **Dependents' Male / Female toggle** only narrows the Relation list (the API stores no dependent gender). The card
  icon follows the relation (spouse: opposite of the employee's gender).
- **Tenure**: `tenureMonths` as "2 Years & 3 Months" (from `joiningDate` when the API sends null).

## Mocks

`src/mocks/talent-management` answers every route above under `/employees…`:

- `seed.ts`: an `EmployeeOut` for each person of the shared directory (`src/mocks/employees/seed.ts`), same ids and the
  `EMP-0001` codes `lookup.ts` gives; branches and job titles are Settings' records, departments Payroll's lookup ids
  (`dep_<slug>`), so the filter and form pickers (answered by Payroll's `/organisation/lookups/*` mock in the browser)
  match. Personal data (gender, marital status, date of birth, CNIC, email, phones, addresses, joining dates; four
  people on probation) is seeded; the child tables carry the frames' samples for Shelley Kannes (Ashraf Hussain /
  Fatima Bibi, the seven skill chips, BZU Multan, Project Contract, Resume, HexaTech) and a few others; everyone has a
  primary emergency contact.
- `handlers.ts`: list filters and paging; validation like the API's (required names ≤ 200, job title ≤ 100, phone ≤ 30,
  account number ≤ 50, enum values, dates in order, known branch / location / area / department / designation / people,
  a line manager other than the person); 409 `EMPLOYEE_CODE_DUPLICATE` on `code`, `SKILL_DUPLICATE`,
  `BANK_ACCOUNT_DUPLICATE`, `EMPLOYEE_INACTIVE` / `EMPLOYEE_ACTIVE`; 404 for unknown people and rows; `rowVersion`
  missing → 422 and stale → 409 on identity / photo / deactivate / reactivate, stale → 409 on edits and deletes that
  send one. One primary emergency contact and bank account per person is kept. Uploaded files are named from the files
  mock (`mockUploadName`).
- Registered **last** in `src/mocks/handlers.ts` (+ `resetTalentManagementDb()` in `resetMockDb`), so
  `/employees/lookup` and `/organisation/lookups/*` stay with the modules that already answer them, and
  `POST /employees/{id}/update-requests` with Benefits; `GET /employees/:id` passes `lookup` and `update-requests` on.
- Not mocked (no screen): employment periods, history, changes, salary, and the update-request inbox.
- Other modules' mocks keep reading the directory: a person added or deactivated here does not appear in their
  pickers (`/employees/lookup` answers from the directory).

## Gaps

Backend has, frontend has no screen for:

- `GET/POST/PUT /employees/{id}/employment-periods`, `GET …/history`, `GET …/changes` (a History popup),
  `GET/POST/PUT/DELETE …/salary` (salary is set through Payroll → Salary Revision).
- The update-request inbox (`GET /employees/update-requests`, approve / reject / cancel). Benefits sends requests;
  nobody decides them in this app yet.
- List filters `locationId`, `areaId`, `divisionId`, `jobTitleId`, `gradeId`, `employmentTypeId`, `employeeGroupId`,
  `lineManagerId` (the panel offers status, branch, department, designation and inactive people).
- `homeCityId` (the form keeps the record's city; there is no city picker for addresses).

Frontend draws, backend lacks:

- A gender filter on `GET /employees`: Male / Female are counted in the browser over every page (2,000 people at most;
  the tiles say so when the company is larger). A `summary` endpoint (totals by gender and status) would replace this.
- Benefit contributions per person (Employee / Company Contributions), performance goals (Performance Details).
- A file on experience records; a status on contracts (worked out by the API instead).
- A leave calendar: "View Calendar" opens Leaves → Leave Applications.

## Needs from shared files

- None required. `src/app/modules.ts`: `MODULES.talentManagement` is no longer used by a route (left as is; its
  planned screens list could drop "Employees", or the entry could go).
