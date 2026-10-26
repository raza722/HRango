# Requests: frontend ↔ backend mapping

Feature: `src/features/requests` (every request type, Approvals, Request Settings).
Mocks: `src/mocks/requests/**`. Backend: `backend/app/routers/requests.py`, `loans.py`,
`schemas/requests.py`, `schemas/loans.py`, `db/procedures/req/*`, catalogue `app/catalogue/requests.py`,
`loans.py`. Contract: `backend/README.md`, `comparison/04-requests.md`.

## The engine (shared by every type)

### Routes

| Screen action                                     | Route                                                                                                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requests list (My / All)                          | `GET /requests/<type>?view=my\|subordinates\|all&status&q&employeeId&departmentId&branchId&locationId&from&to&page&pageSize` → `{data, meta, counts}`                                 |
| View / Edit form                                  | `GET /requests/<type>/{id}` (`RequestDetailOut`: steps, attachments, actions)                                                                                                         |
| Create                                            | `POST /requests/<type>` `RequestIn {employeeId?, fromDate, toDate, reason, description, application, attachments:[fileId], details}`                                                  |
| Edit                                              | `PUT /requests/<type>/{id}` (same body + `rowVersion`); files are synced afterwards with `POST/DELETE /requests/<type>/{id}/attachments[/{attachmentId}]` (PUT ignores `attachments`) |
| Delete                                            | `DELETE /requests/<type>/{id}?rowVersion`                                                                                                                                             |
| Withdraw (pending) / Cancel (approved)            | `POST /requests/<type>/{id}/cancel {reason, rowVersion}`                                                                                                                              |
| Approvals tabs                                    | `GET /requests/approvals?box=requested\|delegates\|consents\|cancellations&type=<code>&status&delegatorId&…`                                                                          |
| Approve popup                                     | `GET /requests/approvals/{id}`                                                                                                                                                        |
| Approve / Reject                                  | `POST /requests/approvals/{id}/approve\|reject {remarks, details?, rowVersion}`                                                                                                       |
| Consent (Agree / Disagree)                        | `POST /requests/approvals/{id}/consent {agree, remarks, rowVersion}`                                                                                                                  |
| Forward                                           | `POST /requests/approvals/{id}/forward {employeeId, remarks, rowVersion}`                                                                                                             |
| Approved / Unapproved (bulk)                      | `POST /requests/approvals/bulk-approve\|bulk-reject {items:[{id,rowVersion}], remarks}`                                                                                               |
| Employee pickers                                  | `GET /employees/lookup?permission=requests.<code>.create&q&page&pageSize` → `{data, meta}` (server search, Load more; filters add `includeInactive=true`)                             |
| Form options (staff without settings permissions) | `GET /requests/options/leave-types?employeeId&asOf`, `/options/loan-types?employeeId`, `/options/loan-categories`, `/options/colleagues?q&employeeId&page&pageSize`                   |
| Departments, branches, locations, grades …        | `GET /organisation/lookups/<kind>`                                                                                                                                                    |
| Delegators (Delegates filter)                     | `GET /requests/settings/delegations?delegateeId=<me>&requestType&isActive=true` (only with `requests.settings.delegations.view`)                                                      |
| Uploads                                           | `POST /files` (module `requests`) via `src/lib/files.ts`, then the id                                                                                                                 |

Page slug → type code (`api/backend.ts` `REQUEST_TYPE_CODES`; URL segment = code with hyphens):
punch → punch, shift → shift_swap, transfer → transfer, leave → leave, loan-advances → loan,
work-from-home → work_from_home, promotion → promotion, relaxation → relaxation, rest-days → rest_day,
travel → travel, resignation → resignation, expense → expense, official-visits → official_visit,
air-tickets → air_ticket, requisition → requisition.

### Code

- `api/backend.ts`: backend shapes (`BackendRequest`, `BackendRequestDetail`, `BackendStep`, `RequestBody`,
  `ApprovalDetails`, `BulkResult`), type codes, and adapters to the screens' model (`adaptRequest`,
  `toHistory`, `toCounts`, `rowActions`, `detailActions`).
- `api/engine.api.ts`: every engine call, typed by a payload mapper. `api/lookups.api.ts`: shared pickers.
- `standard/standard.api.ts`, `use-standard.ts`: the standard types on the engine; payload = the API's `details`.
- `components/shared/request-files.tsx` (`RequestFileField`, `RequestFileLinks`), `utils/request-files.ts`
  (`attachmentRef`, `detailFileRef`, `syncAttachments`).

### Shape and model decisions

- Every request model now carries the header (`RequestHeader`: `requestType`, `rowVersion`, `fromDate`,
  `toDate`, `days`, `reason`, `description`, `application`, `submittedAt`, `decidedAt`, `nextApprover`,
  `finalAuthority`, `attachments`, `isWaiting`, `delegator`). The type's `payload` is the API's `details`.
- Status: the API's `approved` is shown as the screens' `completed` (label Completed / Approved). The union
  `RequestStatus` was kept because Leaves imports it; the adapter maps both ways (`toStatus` / `fromStatus`).
- Flow: the API records a step when the flow reaches it, so Flow shows the steps reached so far (no future
  "Waiting" rows). Step states added: informed, forwarded, consented, disagreed. Requester entries
  (`submitted`, `withdrawn`, `cancel_requested`) go to History only.
- Actions: the detail's `actions` (approve/reject → Approve/Reject, consent/disagree → Consent, forward →
  Forward). Lists carry no actions, so a row menu follows from status and tab (`rowActions`); the server
  checks again. Pending rows offer **Withdraw** (cancelled at once), approved rows **Cancel** (cancellation flow).
- Flow and History dialogs load the detail (lists have no steps). Edit forms that show existing files load the
  detail too (lists give `attachments: []`).
- Employee card: `jobTitleName` → designation, company not sent (—), no photo.
- Permissions (`useCan`, everything allowed in mock mode): Create/Edit = `requests.<code>.create`,
  Delete/Withdraw/Cancel = `.cancel`, Approvals tab = `requests.approvals.view`, Approve / Forward / bulk
  Approved = `.approve`, Reject / Unapproved = `.reject`. Settings buttons by their `requests.settings.*`
  and `loans.settings.*` codes.
- Approve / Reject / Agree / Disagree buttons are enabled only when the detail's `actions` lists `approve`,
  `reject`, `consent`, `disagree` (kept on the model as `decisions`); `GET /requests/approvals/{id}` now gives only
  `view` and those (plus `forward`, and `edit` when the flow node allows it — not offered in the popup yet).
- Approvals pill gained **Cancellations** on every standard type (the API decides cancellations only from that
  box) and **Consents** where a type can have consent steps. Forward and Consent dialogs were added.
- Filters were cut to what the API takes: `q`, `employeeId`, `departmentId`, `branchId`, `locationId`,
  `from`, `to`, `status`, `delegatorId` (Approvals). Removed everywhere: Next Requestee, Employment Status,
  per-type filters (leave type, roster, designation, grade, resignation type, punch time range, method).

## Request types

### Punch (`/requests/punch`, own page)

- `{date, punchType, punchTime, description, expectedIn/Out}` → `details {punchDate, punchType, punchTime}`;
  description → header. Types `check-in|check-out|missing-punch` → `check_in|check_out|break_out|break_in`
  ("Missing Punch" removed, Break Out / Break In added). Attachment field added.
- Expected times from `GET /scheduling/schedules?employeeId&from&to`.

### Shift (`/requests/shift` page → `/requests/shift-swap`)

- `{date, rosterGroupId, rosterTitle, swapFrom, swapWith, swapToShift}` → `details {shiftDate, timeSlotId |
withEmployeeId}`; out adds `fromTimeSlotName`, `timeSlotName`, `withEmployeeName`, `toTimeSlotName`.
- Swap To: colleagues from `GET /requests/options/colleagues?q&employeeId&page&pageSize` (searched on the server,
  Load more; `requests.shift_swap.create`, so staff see everyone), with their shift that day added where the
  schedule board shows it. A same shift is refused by the API with `SHIFT_UNCHANGED` on `timeSlotId` or
  `withEmployeeId`, shown on that field. Employee Name ("Myself" when empty) is a server-searched picker.
- "Time Roster" → "Time Slot" (`GET /scheduling/options/time-slots`); slot and swap are either/or. A swap first
  waits for the colleague's consent (Agree / Disagree), then the flow.

### Transfer (`/requests/transfer`, admin only)

- Names → ids: `details {locationId, branchId, departmentId, lineManagerId, finalAuthorityId, effectiveDate}`
  (`*Name` in the response). The letter → header `application`; attachment is an upload. Department chosen by id.
- Pickers: `/organisation/lookups/{locations,branches?parentId,departments}`, `/employees/lookup`.

### Leave (`/requests/leave`)

- `from`/`to` → `fromDate`/`toDate`; `count` → `days`; `short` → `isShort`; `shortType half-day` →
  `shortLeaveType half_day|quarter_day`; short leave sends `startTime`/`endTime` on `fromDate`. Removed
  `dates`, `rosterGroupId`, `rosterTitle`, `balance`, attachment name (now `attachments`). Rosters column removed.
- Leave types, Available Leaves and the form rules from `GET /requests/options/leave-types?employeeId=` (the
  picked person, or the caller without one; `requests.leave.create`). The Leave Type list shows "n available";
  Short is disabled when the type allows neither half nor quarter day, and Short Leave Type offers only
  `allowHalfDay` / `allowShortLeave`; dates are limited by `allowBackDate` / `backDateLimitDays` / `futureLimitDays`
  (checked again on Save); the attachment is required when `attachmentRequired` and `attachmentRule` is `refuse`,
  and only hinted when it is `note`. `HALF_DAY_NOT_ALLOWED` / `SHORT_LEAVE_NOT_ALLOWED` land on Short Leave Type.
  `/leaves/types` is no longer read. Balance card and Approve popup still from `/leaves/balances`; shift strip from
  `/scheduling/schedules`.
- The leaves agent's `leaveRequestHandlers` (src/mocks/leaves/request-handlers.ts) were not wired in: they keep a
  separate store, have no list route and answer `/requests/approvals/:id/:decision` for every type; they stay
  for the Leaves tests (`server.use`). The requests mock still writes leave requests into the shared
  `standardRequests` table the Leaves mock reads.

### Work From Home (`/requests/work-from-home`)

- `fromDate`/`toDate` are the chosen range and `details {dates}` the ticked days (the API now keeps the range);
  `{days:[{requestDate, scheduleId}]}` out; Reason now required.

### Rest Days (`/requests/rest-days` → `/requests/rest-day`)

- `department` (name) → `departmentId`; `rosterTitle` → `rosterGroupName`; `payable` → `isPayable` (new
  checkbox); `dates` → `days[]`. Removed shift, time, duration columns; Days column added. Rosters from
  `GET /scheduling/options/roster-groups`.

### Loan & Advances (`/requests/loan-advances` → `/requests/loan`) and its Settings tab

- `typeId` → `loanTypeId`, `categoryId` → `loanCategoryId`, `requiredAmount` → `amountRequested`; reason → header;
  guarantor files are uploads (`fileId`). Approver fields → approve `details {approvedAmount, paymentMethod
(pay_order not pay-order), repaymentDate, currency}`; totals from `GET /loans/summary`.
- Create form: types from `GET /requests/options/loan-types` (the caller's, from the look-ups; someone else's with
  `?employeeId=` when filing for them) and categories from `GET /requests/options/loan-categories`, so staff without
  `loans.settings.*` see them. Each type shows its terms (installments, months of service, guarantor) and "Not open to
  this contract type" when `eligible` is false (Save refuses it); a type's `guarantorRequired` drives the guarantors.
- Bulk Approved works for loans: the API prefills the approved amount (the amount asked), payment method and repayment
  date when no approval form was filled (the mock does the same).
- Settings: `/loans/types` (isActive, minExperienceMonths, gapBetweenRequestsMonths, installments,
  gapBetweenInstallmentsMonths, formulaId optional, deductionPayItemId required unless non-payable,
  employmentTypeIds), `/loans/categories`, Repayment from `/loans/installments` (request code, approved amount and
  deduction pay item columns dropped).

### Promotion (`/requests/promotion`, admin only)

- Names → `gradeId`, `jobLevelId` (optional), `designationId`, `jobTitleId`; `salary` → `newSalary`; benefits →
  `benefitPayItemIds`; out has `previousSalary` and `benefits[]`. Approval remarks required.

### Resignation (`/requests/resignation`)

- `type` → `resignationType` (resignation, voluntary, retirement, contract_end); notice period in days; Serve
  Notice new; Last Working Date optional on the form; approver sets `lastWorkingDate`, `serveNotice`,
  `noticePeriodDays`.

### Relaxation (`/requests/relaxation`) and Official Visits (new, `/requests/official-visits` → `/requests/official-visit`)

- Kind `time_window`: `details {windowDate, startTime, endTime}`; out adds `durationMinutes`, `timeSlotName`,
  `slotStartTime/EndTime`. Frontend-only slot/minutes fields removed. Relaxation: shift needed, reason and approval
  remarks required. Official Visits: built on the same form (no shift needed; Purpose = reason).

### Travel (`/requests/travel`)

- `details {purpose, extensionNo, altPhone, advanceRequired, advances[], legs[], stays[], tickets[{…, fileId}]}`;
  application → header. The API keeps stays and tickets per request, the form per leg: `travel-codec.ts`
  flattens on send and regroups by dates / places on read. Modes `own-car` → `own_car`, `pool-car` → `pool_car`.

### Expense (new, with Settings tab), Air Tickets (new), Requisition (new)

- Expense: one request, `details.lines [{title, claimDate, expenseCategoryId, amount, description, fileId}]`
  ("Generate Claim" / "Submit All"); approver lowers claims with `details.lines [{id, approvedAmount}]`; categories
  from `GET /requests/expense/categories`. Settings tab: Expense Categories CRUD
  (`/requests/settings/expense-categories`) and Reimbursement (`/requests/settings/reimbursement`, pay items from
  `/payroll/pay-items?itemType=reimbursement`).
- Air tickets: `details {title, claimDate, travelDate, fromPlace, toPlace, amount, description, fileId}`;
  approver may set `approvedAmount`. New menu entry (not in the design).
- Requisition: `details {title, requisitionType, neededByDate, deliveryLocation, lines[]}`, justification =
  reason. New menu entry; no design exists.

## Request Settings

- **Restrictions**: `GET/POST /requests/settings/restrictions`, `GET /{id}`, `PUT /{id} {…, rowVersion}` (row menu
  **Edit**, shown with `requests.settings.restrictions.edit`; the dialog reads the restriction first),
  `DELETE /{id}?rowVersion` (bulk delete loops). `companyId/company` → `companyName`; Company filter removed; Request
  Type column added.
- **Delegation**: `GET/POST /requests/settings/delegations`, `PATCH /{id} {isActive, description, rowVersion}`
  (bulk Active / In Active loops), `DELETE /{id}?rowVersion` (row menu **Delete** and a toolbar Delete for ticked rows,
  looped; shown with `requests.settings.delegations.delete`). `active` → `isActive`; nested people →
  `delegatorName/delegateeName`. Delegator / Delegatee filters search `/employees/lookup` on the server.
- **Request Flows**: `GET /requests/settings/flows?requestType&purpose`, `GET/PUT/DELETE /{id}`, `POST`. The
  page's `?type=<code>-cancel` = `purpose=cancellation`. One table per type + per-employee "assignments" became a
  list of flows per type/purpose with scopes (company, branch, department, employee); an employee-scoped flow
  replaces an assignment. Nodes: `node` → `approverKind` (consentee → employee + canDisagree; hod-finance →
  finance_manager; hod-hr / hod-hr-admin → hr_manager; hod-admin → admin_manager; new role node and authority
  codes), `onLooker` → `isObserver`. An empty Next / If True / If False now means the next node by number. Saving
  creates a new version (new id). "General Flow" / "Retail Employee" chips removed.
- **Authorities** (new tab: `/requests/settings/flows?tab=authorities`): `GET/POST /requests/settings/authorities`,
  `PUT/DELETE /{id}`.
- Request type codes in Settings are the API's codes (`SETTINGS_REQUEST_TYPES`); "Lend", "Benefit Withdrawal",
  "Official Duty" became Loan, (removed), Official Visit; Air Ticket added.

## Employee pickers

Every request form's Employee picker, the Forward dialogs, the Transfer pickers, the Settings pickers (delegation,
flow, authority) and every Filters employee field search `GET /employees/lookup` on the server (`q`, debounced) and
read it page by page (`{data, meta}`, 50 a page, "Load more"), so more than 100 people work. Shared pieces:
`src/hooks/use-employee-lookup.ts` (`useEmployeeLookupSearch`, `fetchEmployeeLookup`), Payroll's
`EmployeeSearchSelect(Field)` / `EmployeeMultiSearchSelect` and FilterField kind `employee`; in Requests
`components/shared/request-employee-field.tsx` (`RequestEmployeeField`, `RequestEmployeeSelect`) and
`request-employee.ts` (`useRequestPerson`, `employeeFilterField`). `lookupsApi.employees` / `useEmployeeOptions` /
`useSettingsEmployees` stay and return the first page.

## Mocks

- `src/mocks/requests/backend.ts`: serializes the mock's stored requests to `RequestOut` / `RequestDetailOut`,
  reads `RequestIn`, checks `rowVersion` (409), and serves the shared Approvals routes over every type that calls
  `registerApprovalSource` (standard engine, punch, shift, transfer).
- `src/mocks/requests/standard/engine.ts`: per-type routes on the backend paths; each type supplies `typeCode`,
  `fromBody`, `header`, `toDetails`, `decision`.
- Form options: `/requests/options/leave-types` (leave kind; rules from the Leaves mock's types and Half & Short
  policy, balance from the requests table), `/options/loan-types` + `/options/loan-categories` (loan kind; `eligible`
  from the person's contract), `/options/colleagues` (paged, `handlers.ts`). Settings: `PUT /restrictions/{id}`,
  `DELETE /delegations/{id}`. Approver reads (`/requests/approvals/{id}` and decision answers) list only the decision
  actions; shift swaps answer `SHIFT_UNCHANGED`; bulk approve prefills a loan's amount and dates.
- Pickers other modules own are answered only as fallbacks (`fallback.ts` `fallbackGet` steps aside when another
  mock serves the route).
- Stored payload shapes and exports the Leaves mock imports were kept.

## Gaps and backend bugs

Backend (route — what is wrong):

- All request routes — datetimes come back without a timezone (`2026-10-26T05:43:41`), so shown times are off
  by the UTC offset.
- `req.fn_request_details` — travel lists and loan guarantors are built without `INCLUDE_NULL_VALUES`, so empty
  fields (fileId, description, distanceKm, travelClass, extensionNo) are missing instead of null.
- `/loans/*`, `/requests/settings/expense-categories` — amounts as decimal strings (`"100000.00"`), while details
  amounts are numbers.
- `PUT /requests/settings/reimbursement` — answers `updatedAt: null` right after saving.
- (Fixed: same-shift swaps now answer `SHIFT_UNCHANGED`; half / quarter day are checked separately.)
- Work from home — the response's `fromDate`/`toDate` shrink to the ticked days; approval does not set the
  schedule's `isWfh`.
- `GET /loans/summary` — a Line Manager gets 404 for their own report, so the approve popup has no totals;
  installments carry no request code, principal or deduction pay item.
- 422 responses use code `VALIDATION_FAILED` even when a specific field is named; expense refusals arrive under
  `fieldErrors.lines`, not per claim.
- Approving an already-approved request returns 403, not 409.

Missing endpoints / permissions for request forms:

- Leave types, loan types / categories and swap colleagues now have form option routes (`/requests/options/*`).
  Still missing for staff: pay items (`payroll.settings.pay_components.view`) and roles for flow role nodes
  (`access.roles.view`, not held by HR Manager).
- No delegation dates (D6), no currency lookup.
- Checked on the dev API (26 Oct 2026, after the database was emptied): created location "Options QA Location",
  branch "Options QA Branch", employee Omar Options (EMP-0001), leave type "Options QA Casual" (OQC), loan category
  "Options QA Personal", loan type "Options QA Advance"; a restriction was created, edited and deleted. Every option
  route and the paged lookup answered the shapes above; `/options/leave-types` without `employeeId` answers 404
  `NOT_FOUND` for a user with no employee record.
- The dev administrator has no employee record: their My lists and Approvals are always empty and they can only
  file for others.

In the documents / frontend but not built: "Missing Punch", "Completed" for WFH, Escalation, fulfilment
tracking for requisitions, ticket-required rule for air/train/bus travel (frontend only), the AI-generated
application (text is stored as sent), overtime under Requests (lives in Attendance).

## Needs from shared files (not edited)

- `src/mocks/auth/handlers.ts`: `DEMO_USER` needs `employeeId: 'em_shelley'` (mock "My" forms run without a
  person id; some forms match the board row by name).
- `src/mocks/settings/handlers.ts`: `/organisation/lookups/{departments,grades,job-levels,designations,employment-types}`
  return `[]`, so those mock dropdowns are empty (tests serve them themselves). Department ids should be
  `dep_<slug>` like the payroll mock.
- `src/mocks/files/handlers.ts`: export a lookup by id so mocked attachments show their real names; its upload
  handler cannot read jsdom multipart bodies (tests answer `POST /files` themselves).
