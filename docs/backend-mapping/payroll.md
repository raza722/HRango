# Payroll: frontend ↔ backend mapping

Feature `src/features/payroll`, mocks `src/mocks/payroll`, routes `src/routes/_app/payroll/**`.
Backend: `backend/app/routers/payroll*.py`, schemas `backend/app/schemas/payroll_*.py`, codes
`backend/app/catalogue/payroll.py`. Everything is under `/api/payroll` unless noted.

## Contract as used

- Envelopes `{data}` / `{data, meta}`; paging `?page&pageSize` (max 100); search `?q=` (was `?search=`;
  `ListParams.search` renamed `q`).
- Ids are strings; money is a JSON **number** (float) in every response; inputs send numbers.
- Months are `yyyy-MM-01` (`payrollMonth`, `payslipMonth`, `balanceMonth`, `entryMonth`, `applicableMonth`,
  `?month=`). Month pickers still hold `yyyy-MM`; `monthStart()` / `monthOf()` in `utils/format.ts` convert.
- Enum values are the API's snake_case (`employee_data`, `current_month`, `leave_quota`, `on_hold`,
  `bank_transfer`, `earned_salary` …); labels in `constants.ts`.
- Edits send `rowVersion`; deletes send `?rowVersion=` (the API answers 422 without it). Delete hooks take
  `{id, rowVersion}`. A stale version answers 409, shown as the API's message.
- Files: `UploadField` (`components/shared/upload-field.tsx`, exported) uploads with `uploadFile(file,'payroll')`
  as soon as a file is chosen, keeps `{id, name, url}` and the form sends `fileId`; saved records show
  `file.name` as a signed link. The old `AttachmentField` (name only) stays exported for other features.
- Imports (opening balances, employee accounts, salary revisions): the CSV is uploaded, then
  `POST …/import {fileId}`; the `{created, errors}` result is shown. Templates use the backend columns.
- Permissions: buttons hidden with `useCan('payroll.<screen>.<action>')` (`PAYROLL_CODES` in constants);
  mock mode has no permission list, so everything shows.
- The old `GET /payroll/lookups` aggregate does not exist. Pickers now come from
  `GET /employees/lookup?permission=<screen view code>[&includeInactive=true]&q&page&pageSize` (see Employee pickers),
  `GET /organisation/lookups/{branches|departments|designations|locations}`,
  `GET /scheduling/options/time-slots`, `GET /leaves/types` and the payroll settings lists
  (`lookupApi` in `api/payroll.api.ts`, `usePayrollOptions()` in `hooks/use-payroll-records.ts`).

## Screens

### Settings → General (+ Leave configuration)

`GET/PUT /settings/general` (`payroll.settings.general.view/edit`).

- One flat object (was `{configuration, leave}`), with `rowVersion` (null until first save).
- Renamed/reshaped keys: `hidePayslipAfterRun` (boolean; was a rounding select by mistake),
  `salaryReportRounding`, `taxRounding`, `prorationRounding` (`floor/ceil/round/actual`), `payslipColor`
  (text; was a checkbox), `notesEnglishEnabled` + `notesEnglish`, `printSignature`, `sendCloseEmail`,
  `showOnHoldAmounts`, `useShiftHours`, `showEmployeePayItems`. Added inputs: `revisionFixedDate` (MM-DD),
  `revisionShiftDays`, `cutoffDay` (1–28). Removed: "prorate by shift" duplicate, calendar/working-days prorate.
- Leave: `cplLeaveTypeId` (leave types picker), `maxEarnedCpl`, `deductCasualLeaves`, `deductSickLeaves`,
  `leaveYearBasis`, `fiscalYearStartMonth/EndMonth`.

### Settings → Tax

`/tax-structures` CRUD, `/tax-rebates` CRUD (`?employeeId&from&to`) (`payroll.settings.tax.*`).

- Slabs `minAmount/maxAmount/fixedAmount/percentage`; surcharge is `surchargeType` + `surchargeValue`
  (the "when annual tax is > amount" condition is gone). At least one slab. Code `TXS-`.
- Rebate: `rebateDate`, flat employee fields, `fileId` + `file` (real upload), `description` added.

### Settings → Rewards

`/benefits`, `/incentives` CRUD (`payroll.settings.rewards.*`).

- Benefit types `allowance/bonus/reward/other`; formula on the benefit (was per member); members are an
  employee **or** an employee group; fields gain `date`, min/max value/length, `fieldValue`.
- Incentive: `applicableMonth`, `incentiveType` (`reimbursement/part_of_salary`), `targetAmount`,
  `valueType`, `rewardValue`, `description`; branch from organisation lookup; no code. Stored only (no payroll effect).

### Settings → Pay components

`/pay-items` (`?itemType`), `/formulas`, `/rules` CRUD; `/settings/variables`, `/settings/expressions/check`
(`payroll.settings.pay_components.*`).

- Pay item: calculation `fixed/manual/formula`; formula requires `employeeFormulaId`, optional
  `employerFormulaId`; `isTaxable`, `isDisplayOnly`, `isBenefit`, `isAdvancePayment`, `eligibilityExpression`,
  `description`. The expression shown is read only (from the formula). The nine system items (`systemCode`)
  cannot be deleted; their type and calculation are locked.
- Formulas show `reference`; system formulas (`isCustom=false`) cannot be deleted.
- Rules require `accountTypeId`; `isCustom` removed. Variable helper lists the API's variables (was hard-coded).

### Settings → Account type / Disbursement banks

`/account-types` (`?category`), `/disbursement-banks` (was `/banks`) CRUD.

- Account type: `category` (`benefit/leave_quota/custom_pay_item`) + `refId` (benefit, leave type or pay item);
  code `ACT-`; edit added.
- Bank: `branchCode`, `branchLocation`, `taxPayerId` required; `branchName`, `effectiveDate`, `description`
  optional; `bankCode` removed.

### Payrolls → Monthly

`/payrolls` CRUD (`?status&month`), `GET/PUT /payrolls/{id}/employees`, `POST …/employees/add` (filter),
`POST …/run` (RunLog), `…/close {rowVersion}`, `…/hold`, `…/unhold`, `…/history`, `…/errors`
(`payroll.payrolls.view/create/edit/delete/process/close`).

- Form: added Payroll Month; processing day → `processingMode` + `processingDate`; `disbursementBankId` and
  `taxStructureId` required; pay item rows `isTaxable/arrearApplicable/finalSettlement/calculateOnly`;
  empty list on create → every pay item.
- Statuses `open` (shown Pending) / `running` (Run) / `on_hold` / `closed`. Per-row Hold / Release Hold replaces
  bulk hold; Close and Delete added. Employments dialog uses the lookup picker, can add by branch/department.
  History = run logs (kind, counts, who).
- Calculation is done by the server; the mock engine shrank to a simple fixture calculation.

### Payrolls → Daily wages

`/daily-wages` CRUD (`?status&from&to&timeSlotId`), `PUT …/employees`, `POST …/process`, `…/close`,
`…/vouchers`, `GET …/errors` (`payroll.daily_wages.*`, vouchers need `payroll.vouchers.create`).

- Create `{name, workDate, timeSlotId, employeeIds}`; edit sends earnings/deductions + `rowVersion`
  (the wage itself is not editable on the API). Rows carry check-in/out, minutes, payslip and voucher.

### Salary sheet

`GET /salary-sheet?payrollId|month` (`payroll.salary_sheet.view`).

- One column per pay item (from `columns`) plus fixed totals; `rounding`, `printSignature` (signature lines
  on print). Defaults to the latest payroll (the API answers 422 with neither parameter).

### Pay slips (my / all)

`GET /payslips?scope=my|all` with `q, payrollId, month, status, employeeId, branchId, departmentId,
employmentStatus, finalSettlement, earningsFrom/To, deductionFrom/To, netFrom/To`; `GET/PUT /payslips/{id}`
(`{lines, rowVersion}`); `POST /payslips/{id}/hold|unhold|pay|recalculate`; bulk `POST /payslips/hold|unhold|
pay|recalculate {ids}`; `GET /payslips/{id}/history`; `GET /payslips/summary` (`payroll.payslips.*`).

- Detail is `lines` + `display` (template, colour, breakdown, notes); the PDF/print is drawn by the frontend.
- Statuses `ready/on_hold/released`; "Released With FS" = `isFinalSettlement` + `released`; Paid marker from `paidAt`.
- Edit sends changed lines only; the "Manually Updated" box is read only. My Accounts panel = `accounts[]`,
  `outstandingLoan`, `advancesPaid` (was fixed PF/EOBI/loan).

### Vouchers / Employee vouchers

One resource: `/vouchers` CRUD (filters `q, employeeId, departmentId, designationId, type, status,
voucherCode, payrollId, from, to, amountFrom/To`), `POST /vouchers/{id}/approve|reject|verify
{remarks, rowVersion}` (`payroll.vouchers.*`). The old `/employee-vouchers` resource is gone.

- Voucher list now includes `daily_wage` vouchers; `leave-encashment` voucher lines no longer exist.
- Form: `voucherNo` optional (server `VCH-`), `currency`, `pay_order` method, `purpose` required, `notes`,
  attachment upload, `requestedById`. Approved/verified by and dates are read only (set by the decisions).
  Statuses `pending → approved/rejected → processed` (shown "Verified").

### Final settlement

`GET /final-settlements` (`q, status, month, branchId, departmentId, locationId, employmentStatus`), `/{id}`,
`/{id}/payslip`, `POST /{id}/recalculate`, `POST /{id}/close {rowVersion, fileId?}` (`payroll.final_settlement.*`).

- Rows are leavers from off-boarding (`id` = end-of-employment record). Status `pending/open/closed`
  (was `pending/completed`). Close asks for the signed settlement letter (upload). View is read only.

### Balances

- Opening balance: `GET /opening-balances` (one row per person: `netAmount, entryCount, lastMonth`; no code),
  `GET /opening-balances/employees/{employeeId}` (entries), `POST/PUT/DELETE /opening-balances/{id}`,
  `POST /opening-balances/import`. Added `kind` (opening/adjustment); locked entries read only.
- Employee accounts: `/employee-accounts` CRUD (`scope, employeeId, accountTypeId, month`) + import;
  input `direction` + `amount`, `isProcessed`, `description`; delete added.
- Account statement: `GET /account-statement?employeeId&accountTypeId&from&to` with running `balance`.

### Salary revision

`/salary-revisions` CRUD (`q, employeeId, from, to, salaryFrom/To`), `GET /salary-revisions/current/{id}?date=`,
`POST /salary-revisions/import` (`payroll.salary_revision.*`).

- Input is `changeType` (`flat|percent`) + `changeValue`: **flat adds** the value to the previous salary (the
  old form set the new salary). Previous/new salary read only. Edit/Delete only when `canEdit`; no code column.

### Leave encashment

`/payroll/leave-encashments` CRUD (`q, leaveTypeId, year, employeeId`) (`payroll.leave_encashment.*`).

- Decision: the backend exposes leave encashment twice — `/api/payroll/leave-encashments` (payroll router,
  codes `payroll.leave_encashment.*`) and `/api/leaves/encashments` (leaves router, `leaves.encashments.*`,
  used by `features/leaves`). The payroll screen keeps the **payroll** routes so its permission codes match its
  menu entry; both write the same `lv.leave_encashment` tables.
- Input `{leaveTypeId (from /leaves/types), fiscalYear, allEmployees, employeeIds, mode, basis,
amountPerLeave}`; `amountPerLeave` required unless basis `earned_salary`. `isPaid` locks editing.
- Limits: the picker reads `allowEncashment`, `encashmentMin`, `encashmentMax` (days per person) from
  `GET /leaves/types`; the form shows them under Leave Type and refuses a type with Encashment off. How the API
  applies min / max to each person's days is assumed (Backend Dependencies P4); the server's `leaveTypeId` and
  `employeeIds` field errors land on those fields. The mock leaves out people under the minimum, pays the
  maximum to those above it, and the seed turns Encashment on for Casual Leaves (2–10), Sick Leave (1–8) and
  Annual Leave (1–10).

### Reports

`GET /reports/employee-accounts` (`from, to, q, departmentId`), `/reports/employee-wise`, `/reports/daily-wages`,
`/reports/payroll-summary/{payrollId}` (`payroll.reports.view`). The one reports route now has four tabs.
Employee account report shows `accounts[]`, `taxPaid`, `taxRebate` (was fixed provident fund).

### Dashboard

The drawn dashboard (28 Oct 2026), from endpoints that exist:

- Payroll Comparison Yearly: `GET /dashboard?year` for this year and last year, `salaryStatistics[].netPayable`.
- Expenses Month Wise: this year's `salaryStatistics[].gross` (gross pay as the payroll expense).
- Expense Report: `GET /dashboard?year&month` → `salaryBreakup` (pay item totals of the month; with no month,
  the latest month that has payslips).
- Month Wise Loan & Advance: `GET /loans/installments?monthFrom&monthTo` (every page) added up per `dueMonth`:
  `amount` (due) and `paidAmount` (repaid). Needs the Loans module's read permission; an error shows in the card.
- Employee Month Wise Earning: `GET /payroll/payslips?scope=all&employeeId` (final settlements left out),
  `totalEarnings` (else `gross`) per month, the last 12; it opens on the person of the latest payslip
  (`pageSize=1`), and the picker is `GET /employees/lookup?permission=payroll.payslips.view`.
- The tiles in `GET /dashboard` are not drawn and not shown. A dashboard aggregate for the loans would save
  reading every instalment page of a large company.

## Employee pickers

- No screen preloads people any more. Every employee picker is `EmployeeSearchSelect(Field)` /
  `EmployeeMultiSearchSelect(Field)` (or a Filters field of kind `employee`): it searches `GET /employees/lookup`
  on the server (`q`, code or name, debounced) and reads a page at a time (`pageSize` 50, `{data, meta}`) with
  **Load more**, so it works past 100 people. `usePayrollOptions()` now gives `employeeFilters` (former staff too)
  and `activeEmployeeFilters` (new records) instead of people lists; `lookupApi.employees` returns one page.
- Pickers: Filters "Employee(s)" on Account statement, Employee accounts, Opening balance, Leave encashment, Pay
  slips, Employee account report, Salary revision, Vouchers, Employee vouchers; dialogs Employee account, Opening
  balance, Salary revision create, Employee voucher (employee and Requested By), Leave encashment (multi), Monthly
  "Select Employees", Daily wages create / employees, Settings → Rewards members and Tax rebate.
- A record's own person keeps their name when no page read has them (`known`, from the row).
- Import templates read one employee code (`pageSize=1`) when the template is downloaded.

## Mocks

`src/mocks/payroll`: `db.ts` re-exports `db-settings.ts`, `db-runs.ts`, `db-records.ts` (API shapes; storage keys
`hrms-mock-payroll-v2-*`), seeds in `seed-settings.ts`, `seed-runs.ts`, `seed-records.ts`; handlers rewritten to the
routes above; `lookup-handlers.ts` (registered inside `payrollSettingsHandlers`) mocks `/employees/lookup`,
`/organisation/lookups/:kind`, `/scheduling/options/time-slots`. Kept for other mocks: `engine.ts` re-exports
`employeeRef/employeeProfile/isActive/salaryOn` (from `people.ts`); `salaryRevisions` (legacy shape, Requests →
promotion) and `finalSettlements` (`StoredFinalSettlement`, Off-boarding) keep their stored shapes and are mapped
in the handlers. The old `seed.ts` was removed.

## Gaps

Frontend had, backend lacks: `/lookups` aggregate; bulk payroll hold; voucher lines from leave encashment;
editing a daily wage's rate; dashboard extra charts; payslip "manually updated" toggle; tax surcharge condition;
benefit formula per member; bank code; payroll/revision/balance codes.

Backend has, frontend added: run errors per run, payroll delete, add-employees-by-filter, payslip unhold and bulk
pay/recalculate, voucher reject/verify, FS settlement letter, opening balance kind/lock, account entry delete,
three extra reports, expression check, account type `refId`.

Limits: time slots and leave types need `scheduling.*` / `leaves.settings.types.view`, otherwise the pickers are empty.

## Backend bugs / issues found

- `POST /payrolls/{id}/run` and `/daily-wages/{id}/process`: returned RunLog has `runByUserId/runByName` null
  (history has them).
- `GET /reports/daily-wages`: `employeeCount` 0 for a run with 3 employees.
- `GET /payslips/summary` without `employeeId`: 404 for a user with no employee record (dev administrator).
- `POST /vouchers/{id}/approve|reject|verify` stores the decider's employee id; a user with no employee record
  leaves `approvedBy/verifiedBy` null (no trace of who decided).
- Benefit group member comes back with `employeeName: " "` instead of null.
- `GET /salary-revisions` rows have null department/location/branch (only GET by id fills them).
- `voucherCode` filter is exact match only; import with neither rows nor fileId reports under
  `fieldErrors.request`; `POST /account-types` requires `refId` for `custom_pay_item` (not in the schema).
- Stamps (`lastRunAt`, `createdAt` …) have no time zone (UTC without `Z`).
- Lists of tax structures and benefits omit slabs/members/fields: dialogs fetch the record first.

## Verified against the running API (hrango_dev)

Every settings resource create/get/update/stale-409/delete; monthly payroll PR-00001 (Sep 2026, 3 employees):
create → set employees → run (3 payslips, tax computed) → edit/hold/unhold/recalculate/pay → salary sheet,
summary, reports, dashboard → close (payslips released). Vouchers create/approve/reject/verify/delete; opening
balance, account entries, statement, salary revision CRUD; the three CSV imports by `fileId`. Daily wages:
created/processed, but processing fails "No time sheet for the day" (no attendance in the dev DB), so close and
vouchers were not exercised on the real API. Final settlement and leave encashment: list/404 only (no leavers,
no leave balances in the dev DB).
