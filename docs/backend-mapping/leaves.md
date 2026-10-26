# Leaves: frontend ↔ backend mapping

Feature: `src/features/leaves` (sidebar → Leaves). Mocks: `src/mocks/leaves`. Routes: `src/routes/_app/leaves/**`
(unchanged files; only the search schemas in `features/leaves/routing.ts` changed).
Backend: `backend/app/routers/leaves.py`, `schemas/leaves.py`, `catalogue/leaves.py`; leave requests through
`routers/requests.py` (kind `leave`). Checked against the running API (dev company, 26 Oct 2026).

The frontend now uses the backend's names everywhere (types in `types/leaves.types.ts` mirror `LeaveTypeOut`,
`LeavePolicyOut`, `LeaveApplicationOut` …); there is no mapping layer. It no longer imports anything from
`features/requests` (statuses, counts and people types are its own), so the requests rewrite cannot break it.

## Routes used

| Screen / action                            | Route                                                                                                                                                                                                                            | Permission (button shown with)                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| My Leaves list                             | `GET /leaves/applications?tab=my&status&page&pageSize&leaveTypeId&fromDate&toDate&q`                                                                                                                                             | `leaves.applications.view` (route)                                              |
| Leave Applications list                    | same with `tab=all` or `tab=subordinates` (+ `employeeId`, `departmentId`)                                                                                                                                                       | `leaves.applications.view`                                                      |
| "All Requests (n)" dropdown                | `GET /leaves/applications/counts?tab&…filters` (no status)                                                                                                                                                                       | —                                                                               |
| View                                       | `GET /leaves/applications/{id}` (balance) + `GET /requests/leave/{id}` (steps, attachments)                                                                                                                                      | steps/attachments only with `requests.leave.view`                               |
| + Apply Leave                              | `POST /requests/leave` (`RequestIn<LeaveDetails>`)                                                                                                                                                                               | `requests.leave.create`; My Leaves also needs `user.employeeId !== null`        |
| Apply: attachment                          | `POST /files` (module `requests`), id in `attachments[]`; Remove → `DELETE /files/{id}`                                                                                                                                          | any signed-in user                                                              |
| Apply: leave types / balance / rules       | `GET /requests/options/leave-types?employeeId&asOf` (the picked person; yourself without `employeeId`)                                                                                                                           | `requests.leave.create`                                                         |
| Apply on behalf (Leave Applications)       | `GET /employees/lookup?permission=requests.leave.create&q&page&pageSize` (server search, Load more)                                                                                                                              | `requests.leave.create`                                                         |
| Cancel / Withdraw                          | `GET /requests/leave/{id}` (rowVersion, `actions` has `cancel`) → `POST /requests/leave/{id}/cancel {reason,rowVersion}`                                                                                                         | `requests.leave.cancel`                                                         |
| Approve / Reject (also of a cancellation)  | `GET /requests/leave/{id}` (rowVersion, `actions`) → `POST /requests/approvals/{id}/approve                                                                                                                                      | reject {remarks,rowVersion}`                                                    | `requests.approvals.approve` / `.reject`; enabled only when `actions` includes it |
| Filters: employee, department              | `GET /employees/lookup?permission=leaves.applications.view&includeInactive=true&q&page&pageSize` (server search, Load more), `GET /organisation/lookups/departments`                                                             | —                                                                               |
| General Settings                           | `GET /leaves/settings`, `PUT /leaves/settings {…, rowVersion}`                                                                                                                                                                   | tab: `.settings.general.view`; Save/Cancel and inputs: `.settings.general.edit` |
| Leave Types list                           | `GET /leaves/types?page&pageSize`                                                                                                                                                                                                | tab: `.settings.types.view`                                                     |
| Add / Edit / switches                      | `POST /leaves/types`, `PUT /leaves/types/{id}` (whole type + rowVersion)                                                                                                                                                         | `.types.create` (+ Add New), `.types.edit` (pencil, switches)                   |
| Delete type                                | `DELETE /leaves/types/{id}?rowVersion=`                                                                                                                                                                                          | `.types.delete`                                                                 |
| Allotment (new)                            | `POST /leaves/allotment/process {fiscalYear, leaveTypeId?}`, `POST /leaves/carry-forward/process {fromFiscalYear, leaveTypeId?}`                                                                                                 | `leaves.allotment.process`                                                      |
| Leave Policies list                        | `GET /leaves/policies`                                                                                                                                                                                                           | tab: `.settings.policies.view`                                                  |
| Add / Edit / Status switch                 | `POST /leaves/policies`, `PUT /leaves/policies/{id}`                                                                                                                                                                             | `.policies.create` / `.policies.edit`                                           |
| Delete policy                              | `DELETE /leaves/policies/{id}?rowVersion=`                                                                                                                                                                                       | `.policies.delete`                                                              |
| Enroll Employee                            | `GET /leaves/policies/{id}/employees`, `POST …/employees {employeeIds}`, `DELETE …/employees/{employeeId}`, picker `GET /employees/lookup?permission=leaves.settings.policies.enroll&q&page&pageSize` (server search, Load more) | `.policies.enroll`                                                              |
| (API only, for Payroll → Leave Encashment) | `GET/POST /leaves/encashments`, `GET/PUT/DELETE /leaves/encashments/{id}` in `leavesApi`                                                                                                                                         | `leaves.encashments.*`                                                          |
| (API only)                                 | `GET/POST /leaves/ledger` in `leavesApi`                                                                                                                                                                                         | `leaves.balances.view/edit`                                                     |

In mock mode (`can()` with no permissions list) everything shows.

## Shape changes

- **Statuses**: `completed` → `approved` (the chip still reads "Approved", the dropdown "Completed").
- **Application** (`LeaveApplicationOut`): flat `employeeId/Code/Name`, `departmentId/Name`, `leaveTypeId/Title/Code`,
  `fromDate/toDate`, `days`, `isShort`, `shortLeaveType` (`half_day|quarter_day`), `startTime/endTime`, `reason`,
  `submittedAt`, `decidedAt`, `cancelReason`. Gone: `category`, `dates[]`, `rosterTitle`, `attachment`,
  `attachmentMissing`, `employee.designation/photoUrl`, `nextAuthority`, `flow`, `history`, `actions`, `balance` (now
  only on the detail). The list's page has no `counts`: a second call to `/counts`.
- **Balance**: `{total, availed, pending, available}` → `{entitled, used, pending, available}`.
- **Apply input**: `{category, leaveTypeId, from, to, reason, attachment(name)}` →
  `{employeeId?, fromDate, toDate, reason, attachments: [fileId], details: {leaveTypeId, isShort, shortLeaveType, startTime, endTime}}`.
- **Decision / cancel**: now carry `rowVersion` (read from `GET /requests/leave/{id}`); decisions go to the approvals
  endpoints, not `/leaves/applications/{id}/decision`.
- **Settings**: codes `hr-manager|line-manager|department-head` → `hr_manager|line_manager|department_head`; + `rowVersion`.
- **Leave type** renamed fields: `leavesAllowed→allowance`, `probationType→isProbationType`, `active→isActive`,
  `autoBalanceOnJoiningMonth→autoBalanceOnJoining`, `composite→isComposite`, `shortLeave→isShortLeave`,
  `deductible→isDeductible`, `sandwich→isSandwich`, `earnedBalance→isEarned`, `backDate→allowBackDate`,
  `futureDateLimit→hasFutureLimit`, `encashment→allowEncashment`, `applyInProbation→allowedInProbation`,
  `gapMonths→gapBetweenApplicationsMonths`, `shortLeaveSlabs→shortSlabs`. New: `futureLimitDays`, `updatedAt`,
  `rowVersion`. `minExperienceMonths` nullable. Experience slab `maxMonths` nullable (open end; ranges may not overlap,
  both ends count). Short slab `{name, balance, unit: hours|minutes, value}` → `{name, balance|null, valueType: percentage|flat, value|null}`.
  Limits now follow the backend (title 200, allowance ≤ 366, max applications 1–1000, accumulative 1–50).
- **Policy**: `kind→policyKind` (`half-short→half_short`), `level→policyLevel`, `active→isActive`; dropped `enforced`
  (the "Leave Policy in force" switch) and `enrolled[]`; new `types[{leaveTypeId, allowance}]`, `totalLeaves`,
  `rowVersion`. Enrolment is add (`POST`) + remove (`DELETE` per person), not "replace the list".
- **Look-ups**: the frontend-only `GET /leaves/lookups` (people, departments, offered types, everyone's balances,
  coverage, settings, rosters) is gone; each screen calls the real endpoints above.

## UI changes

- **Leave Applications** gets an **All | Subordinates** switch (`?tab=subordinates`), and "+ Apply Leave" with an
  **Employee** picker (apply on someone's behalf; the backend's "All Requests"). My Leaves applies for yourself and hides
  the button for a user with no employee record (`employeeId: null`, e.g. the dev administrator).
- **Columns**: Rosters dropped (no roster on the application); Category is derived from the dates (Single = one day);
  "No attachment given" note dropped. Applied On = `submittedAt`.
- **Filters**: Category dropped; Search (`q`) added; Department and Employee use ids.
- **Apply Leave**: types, balances and rules come from `GET /requests/options/leave-types` for the person (`asOf` =
  the chosen date), so staff without Leave Types or Balances permissions can apply. Each type shows "Available n of
  m" ("No balance limit" when not deductible); Short Leave is offered only when the type allows half or quarter day,
  and Short Leave Type lists the allowed ones; the date pickers stop at the back-date / future limits (checked again
  on Apply); the attachment is required for `attachmentRule: refuse` and hinted for `note`. A **Short Leave** checkbox on a single day adds Half Day / Quarter Day with Start and
  End Time (required by the backend). "Selected Days" is the calendar count with a note — the server counts the days;
  the frontend no longer checks working days or the balance itself (the old `/requests/leave/schedule` call is gone).
  The attachment is uploaded on choose. Server field errors land on the field (`fromDate`, `toDate`, `leaveTypeId`,
  `isShort`, `startTime`, `employeeId`); others (e.g. `attachment`) show at the bottom.
- **View**: balance table (Total = entitled, Availed = used); History = request steps; Attachments are signed links.
  The flow/history split of the mock is gone.
- **Approve/Reject**: buttons enabled only when `GET /requests/leave/{id}` lists `approve`/`reject`; otherwise a note
  says whom the request waits for. The "records the final approval by …" sentence is gone (settings are stored only).
- **Cancel**: disabled until the request is read; says so when `actions` lacks `cancel`.
- **General Settings**: read-only without `general.edit`; hints say the values are stored only (backend decision).
- **Leave Types form**: Has Future Date Limit reveals **Future Date Limit in Days**; Maximum Months of an experience
  slab is optional ("No limit"); Short Leave Slabs' Type is Percentage / Flat; Value accepts decimals.
- **Allotment** (new, Leave Types title row, `?dialog=allotment`): run allotment for a leave year or carry forward from
  one, optionally for one type. Without it nobody has a balance. Default year: the calendar year.
- **Leave Policies**: columns Policy (kind) and No. of Leaves added; the "Leave Policy (in force)" switch removed.
  Add/Edit Policy lists **Leave Types** with an allowance each for a distribution policy (at least one required).
  Enroll Employee shows the enrolled from the API and refuses someone already in another active policy of the kind.
- Settings tabs, + Add New, pencils, switches and Delete hide or disable per permission code.

## Mocks

`src/mocks/leaves` answers every `/leaves/*` route above in the backend shapes and messages (409 `CONFLICT`,
`LEAVE_TYPE_DUPLICATE`, `LEAVE_POLICY_DUPLICATE`, `LEAVE_POLICY_COMPANY_EXISTS`, `LEAVE_POLICY_ALREADY_ENROLLED`,
"Make it inactive instead" on deleting a used type), keeps its own people, requests, ledger and encashments, allots the
current year on start, and has fallbacks for `/employees/lookup` and `/organisation/lookups/departments` (registered
last, so another mock defining them wins). `GET /leaves/balances` without `employeeId` answers for the mock user
(Shelley) — a simplification.

`leaveRequestHandlers` also answers `GET /requests/options/leave-types` from the Leaves mock (policy types, ledger
balance, Half & Short policy) and refuses half / quarter days with the API's codes. `/employees/lookup` is paged
(`lookupPage` in `src/mocks/employees/lookup.ts`).

`leaveRequestHandlers` (the leave kind of `/requests/leave…` and `/requests/approvals/{id}/approve|reject`) is
exported but **not registered**: the requests mock owns those paths. The Leaves tests add it with `server.use`. In
the browser's mock mode, Apply / Cancel / Approve therefore go to the requests mock and do not show in the Leaves
lists. `leaveTypes` (with `active` / `deductible` aliases) and `entitlementFor` are kept for `src/mocks/requests`.

## Gaps

Backend lacks (frontend had or needs):

- No working-day count before submitting (the old schedule preview); `days` is known only after `POST`.
- `LeaveApplicationOut` has no `rowVersion`, `actions`, attachments or steps: View / Cancel / Approve need a second
  call to `GET /requests/leave/{id}`, which needs `requests.leave.view`.
- No employee photo, designation or roster on the application.
- General settings are stored only (final approver, approve-on-status not applied).
- Allotment year default: the frontend cannot read the company's fiscal start month without
  `organisation` permissions (`asOf=2026-06-01` answered fiscal year 2025 on the dev company).

Frontend lacks (backend has):

- No screens for the ledger (`GET/POST /leaves/ledger`: opening balances, adjustments) or a balances report
  (`GET /leaves/balances` for many people); API functions exist. Adding them needs new routes.
- Leave Encashment screen is Payroll's (`features/payroll`, `/payroll/leave-encashment`); `leavesApi.encashments…` and
  the mock exist for it, the screen itself is not switched here.
- Export (`leaves.applications.export`, `leaves.balances.export`) has no button (no export route for leaves).

## Backend issues seen

- (Fixed) `POST /requests/leave` now refuses `half_day` without `allowHalfDay` (`HALF_DAY_NOT_ALLOWED`) and
  `quarter_day` without `allowShortLeave` (`SHORT_LEAVE_NOT_ALLOWED`), on `shortLeaveType`; the form shows it there.
- Not a bug, but worth knowing: `POST /requests/leave` for a person with no line manager / final authority fails with
  `NO_APPROVER` on `employeeId`, and nobody has a balance until `POST /leaves/allotment/process` runs. The dev
  administrator has no employee record, and the requests and approvals return 403 for them unless they are the approver.

Test data created on the dev database for this check: location/branch/department "Leaves QA …", employees Lena
Leaves, Leo Lead (line manager), Lara Leaves; leave types Casual Leave (CL), Sick Leave (SL, experience slabs);
policies "Half and Short" (company) and "Standard Distribution" (employee level, Lena, Leo and Lara enrolled);
allotment 2026; requests RQ-LV-0001 (pending) and RQ-LV-0002 (cancelled); one ledger adjustment. An encashment was
created, edited and deleted.
