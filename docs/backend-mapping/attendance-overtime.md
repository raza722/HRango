# Attendance → Overtime: frontend ↔ backend mapping

Feature: `src/features/attendance` (`components/overtime/**`, `api/overtime.api.ts`, `hooks/use-overtime.ts`,
`schemas/overtime.schema.ts`, `types/overtime.types.ts`, `utils/overtime-*.ts`, `overtime-routing.ts`). Route:
`src/routes/_app/attendance/overtime.tsx`. Mocks: `src/mocks/requests/standard/kinds/overtime.ts` (the requests),
`src/mocks/attendance/overtime-db.ts` and `overtime-handlers.ts` (policies and settings).
Backend: overtime is a **request type** of the request engine (`/api/requests/overtime`, approved through the shared
`/api/requests/approvals`, see [requests.md](./requests.md)); policies and settings are Attendance settings
(`/api/attendance/settings/overtime-policies`, `/api/attendance/settings/overtime`). Written from the OpenAPI spec of
26 Oct 2026 (`Design/Attendance overtime/openapi-2026-10-26.json`, extracts `api-overtime-openapi.md`,
`api-request-approvals-openapi.md`); the routes were **not** called against the dev API for this change.

The invented `/attendance/overtime/applications|bulk|policies` routes of the first build are gone, with their mock
tables (applications, bulk requests, bulk rows) and fields (`type`, `earned`, `inUse`, `bulkRegNo`).

## Routes used

URL: `/attendance/overtime?tab=my|applications|bulk-applications|bulk-overtime|policy|settings&page=` plus the tab's
filters: `status` (a request status, or `unapproved`), `box` (Applications: `delegates|cancellations`, Requested when
left out), `q`, `from`, `to`, `employeeId`, `period` (Overtime Policy: `daily|monthly`). `tab=my` and `page=1` are
stripped.

| Screen / action                                    | Route                                                                                                                                                                                                                                                                                | Permission (shown with)                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| My Overtime list (+ Filter: From, To, Status)      | `GET /requests/overtime?view=my&status&from&to&page&pageSize` → `RequestPage` (`counts` unused)                                                                                                                                                                                      | `requests.overtime.view` (route)                                               |
| + Apply Overtime → Apply                           | `POST /requests/overtime` `{fromDate, toDate, reason, attachments:[fileId], details:{departmentId, locationId, branchId, overtimeDate, startTime, endTime, appliedMinutes}}`                                                                                                         | `requests.overtime.create`, and `user.employeeId !== null`                     |
| Apply: Department / Location / Branch              | `GET /organisation/lookups/{departments,locations,branches}`                                                                                                                                                                                                                         | —                                                                              |
| Apply: Add Images                                  | `POST /files` (module `requests`), ids in `attachments`                                                                                                                                                                                                                              | —                                                                              |
| View (every tab)                                   | `GET /requests/overtime/{id}` (Applications: `GET /requests/approvals/{id}`) → steps, attachments, actions                                                                                                                                                                           | —                                                                              |
| Cancel (pending: withdraw; approved: cancellation) | `GET /requests/overtime/{id}` (rowVersion, `actions` has `cancel`) → `POST /requests/overtime/{id}/cancel {reason, rowVersion}`                                                                                                                                                      | `requests.overtime.cancel`                                                     |
| Edit (pending)                                     | `GET /requests/overtime/{id}` (rowVersion, attachments, `actions` has `edit`) → `PUT /requests/overtime/{id}` (the Apply body + rowVersion), then `DELETE …/attachments/{attachmentId}` for images taken off and `POST …/attachments {fileId}` for new ones                          | `requests.overtime.create` (as Requests' Edit)                                 |
| Delete (pending)                                   | `GET /requests/overtime/{id}` (rowVersion, `actions` has `delete`) → `DELETE /requests/overtime/{id}?rowVersion`                                                                                                                                                                     | `requests.overtime.cancel` (as Requests' Delete)                               |
| View → Add Images / × (your own request)           | `POST /files` (module `requests`) → `POST /requests/overtime/{id}/attachments {fileId, label: null}`; × `DELETE /requests/overtime/{id}/attachments/{attachmentId}`. Add while pending or approved, × while pending                                                                  | `requests.overtime.create`                                                     |
| Export (My Overtime, Bulk Applications)            | `GET /requests/overtime/export?view=my\|all&status&from&to` → saved as `overtime-<view>-<date>.csv` (format unconfirmed, [R4](../backend-dependencies.md))                                                                                                                           | — (the list's own)                                                             |
| Applications → Forward                             | `GET /requests/approvals/{id}` (rowVersion, `actions` has `forward`) → `POST /requests/approvals/{id}/forward {employeeId, remarks, rowVersion}`; picker `GET /employees/lookup?permission=requests.approvals.view`                                                                  | `requests.approvals.approve`                                                   |
| Applications → Consents box → Consent              | `GET /requests/approvals?box=consents&type=overtime…`; `GET /requests/approvals/{id}` (`actions` has `consent` / `disagree`) → `POST /requests/approvals/{id}/consent {agree, remarks, rowVersion}` (remarks required to disagree)                                                   | —                                                                              |
| Applications → Reject Selected                     | the ticked rows waiting for you → `POST /requests/approvals/bulk-reject {items:[{id,rowVersion}], remarks}` → per-row results; refused rows listed with the API's message                                                                                                            | `requests.approvals.reject`                                                    |
| Applications list                                  | `GET /requests/approvals?box=requested\|delegates\|cancellations&type=overtime&status&q&employeeId&from&to&page&pageSize`                                                                                                                                                            | `requests.approvals.view` (Employee filter's lookup code)                      |
| Approved / Unapproved                              | the same list with `status=approved` / `status=pending` (pending in Approvals = waiting for you)                                                                                                                                                                                     | —                                                                              |
| Approve / Reject (also a cancellation)             | `GET /requests/approvals/{id}` (rowVersion, `actions`) → `POST /requests/approvals/{id}/approve {remarks, details:{approvedMinutes}, rowVersion}` / `…/reject {remarks, rowVersion}`                                                                                                 | `requests.approvals.approve` / `.reject`; enabled only when `actions` lists it |
| Bulk Applications                                  | `GET /requests/overtime?view=all&page&pageSize`                                                                                                                                                                                                                                      | —                                                                              |
| Create Bulk Overtime Request → Create              | one `POST /requests/overtime` per chosen person with `employeeId` (on their behalf); picker `GET /employees/lookup?permission=requests.overtime.create&q&page&pageSize`                                                                                                              | `requests.overtime.create`                                                     |
| Bulk Overtime sheet                                | `GET /requests/overtime?view=all&status=pending&page=1&pageSize=100` (your own rows left out)                                                                                                                                                                                        | —                                                                              |
| Bulk Save                                          | changed applied minutes: `PUT /requests/overtime/{id}` (the row rebuilt + rowVersion); rows approving exactly the applied minutes: `POST /requests/approvals/bulk-approve {items:[{id,rowVersion}]}`; others: `POST /requests/approvals/{id}/approve` with `details.approvedMinutes` | approved boxes need `requests.approvals.approve`                               |
| Overtime Policy list (+ Filter: Name, Type)        | `GET /attendance/settings/overtime-policies?q&period&page&pageSize`                                                                                                                                                                                                                  | `attendance.settings.overtime_policies.view` (assumed)                         |
| + Create / Edit / View                             | `POST /attendance/settings/overtime-policies`, `PUT …/{id}` (`OvertimePolicyIn` with the slabs whole + rowVersion); View uses the list row                                                                                                                                           | `.create` / `.edit` (assumed)                                                  |
| Delete                                             | `DELETE /attendance/settings/overtime-policies/{id}?rowVersion`                                                                                                                                                                                                                      | `.delete` (assumed)                                                            |
| Slab Encashment Type (leave types)                 | `GET /leaves/types?page=1&pageSize=100`                                                                                                                                                                                                                                              | `leaves.settings.types.view` (the API's)                                       |
| Settings                                           | `GET /attendance/settings/overtime`, `PUT /attendance/settings/overtime {…, rowVersion}`                                                                                                                                                                                             | `attendance.settings.overtime.edit` (assumed; read-only without it)            |

The permission codes of the attendance settings were not in the spec: `attendance.settings.overtime[_policies].*` follow
the pattern of `attendance.settings.basic.*`. In mock mode (no permissions list) everything shows.

## Shape mapping

- **Request → `OvertimeApplication`** (`toOvertimeApplication`): header `id, code, employeeId/Code/Name, status,
reason, submittedAt, decidedAt, cancelReason, nextApproverId/Name, finalAuthorityName, rowVersion, isWaiting,
delegatorName`; from `details`: `overtimeDate` (else `fromDate`), `startTime`/`endTime` (`HH:mm:ss` → `HH:mm`),
  `appliedMinutes` (else the window), `approvedMinutes`, `departmentId/Name`, `locationId/Name`, `branchId/Name` (each
  falling back to the header's, which are the employee's own). The spec types `details` as `Record<string, any>`, so
  the output fields are an assumption (the input names, plus names and `approvedMinutes`).
- **Detail** adds `steps` (shown as History in View), `attachments`, `actions`.
- **Statuses**: the API's five (`pending, approved, rejected, cancelling, cancelled`); chips for the last two added.
- **Policy** (`OvertimePolicyOut`): `type` → `period`; `isActive`, `slabCount`, `description` (nullable), `updatedAt`,
  `rowVersion` added; `slabs` may be null (read as `[]`). **Slab**: `{minMinutes, maxMinutes, encashmentType:
full_day|leave, leaveTypeId, leaveTypeName}` (was `fullDay` + `casual_leave|sick_leave`).
- **Settings** (`OvertimeSettings`): six switches and `encashmentShiftMinutes`; the form shows the shift in hours
  (7.5 → 450) as the requirements word it.
- Field errors are read with or without a `details.` prefix (`overtimeDate`, `appliedMinutes` → Date, Overtime Hours).

## UI changes (departures from the first build and the design)

- **Settings tab** (new): drawn in the frames' tab row, its page is not. Built like Attendance Settings → Basic
  (switch rows, one number field, Save Changes) with the requirements' wording: Overtime Applicable on Check-in, on
  Checkout, Overtime Approval Required, Do Not Auto-Create Overtime Requests, Is Overtime Applicable on Holidays,
  Overtime Applicable After Duty Duration, Shift Hours for Overtime Encashment.
- **Slabs**: the Full Day checkbox is `encashmentType: full_day` (Encashment Type is then disabled and shows "Full
  Day"); unticked, Encashment Type lists the leave types (`leave` + `leaveTypeId`). The first build's half-day reading
  is gone. The slab table's Encashment Type column shows "Full Day" or the leave type; the Full Day column is dropped.
- **Policy popup**: an **Active** switch (the API's `isActive`, not drawn); inactive policies carry an "Inactive" chip
  in the list.
- **Applications** is the approvals list, not everyone's requests: Requested by default, Delegates and Cancellations
  through the Filter panel's **Approvals** select (not drawn). **Unapproved** = waiting for your decision (was pending
  - rejected). Approve/Reject is offered on rows that wait for you and enabled by the detail's `actions`; a
    cancellation is approved or rejected without minutes.
- **Approved minutes**: default the applied minutes, capped by the active daily policy's top slab in the browser (an
  error, not a silent cut); the slab they fall in is shown as a hint. Nothing records what a slab "earned".
- **My Overtime**: Cancel on pending (withdrawn at once) and approved (a cancellation) requests, with a required
  reason (the API needs one); was a yes/no confirm for pending only.
- **Bulk**: Create Bulk Overtime Request files one request per person; **Department** is now required (the API's
  `details.departmentId`); people refused are listed with the reason and stay chosen. The **Bulk Overtime** sheet is
  everyone's pending overtime (own excluded) and its **Type** column became **Waits For** (the next approver); Bulk Save
  reports per row what the API refused. **Bulk Applications** lists every overtime request; Reg No# is the request
  code; **Type** became **Status**.
- Dates: Apply keeps today as the latest date; Create Bulk Overtime Request allows planned (future) days.

## Mocks

- `src/mocks/requests/standard/kinds/overtime.ts`: the overtime kind on the standard request engine (code `OT-0001`
  …), registered in `standard/index.ts` (`overtimeServer`, `bindOvertimeRecords`); `engine.ts` gained
  `MockStandardKind = StandardKind | 'overtime'` so the engine can store a kind the Requests pages do not show.
  `/requests/overtime` and `/requests/approvals` answer it like the other kinds; the flow comes from Request Settings
  (General Flow: line manager → HR manager; Shelley's own reports wait for her alone, Haroon's for Bilal first).
  Checks: department known, end after start, applied minutes within the window, **one live request per person and
  day** (`422`, `fieldErrors.overtimeDate`). Approve takes `details.approvedMinutes` (≤ applied; the applied minutes
  when left out, as bulk approve sends nothing) — the mock does **not** apply the policy cap. The last approval writes
  `approvedOvertimeMinutes` onto the person's day (time sheet → Approved Overtime); an approved cancellation puts the
  earlier value back.
- `src/mocks/attendance/overtime-db.ts`, `overtime-handlers.ts`: policies (`Overtime` daily: 60–119 Casual Leaves,
  120–179 Sick Leave, 180–240 Full Day; `New Overtime` monthly) and settings, in the API's shapes, with rowVersion
  checks, `409 CONFLICT` on a duplicate name and leave type names from the Leaves mock. Delete is refused (`409
IN_USE`, "… fell under this policy. Make it inactive instead.") for an active policy with overtime approved since it
  was created — the mock's own rule.
- `GET /requests/overtime/export` answers CSV from the engine's shared export (Code, Employee Code, Employee,
  Department, Status, From, To, Reason, Submitted At) plus Overtime's columns (Overtime Date, Start Time, End Time,
  Applied Minutes, Approved Minutes, Location, Branch), with the list's view and filters and no paging.
- An attachment keeps the name it was uploaded with (`mockUploadName`), as the API returns it.
- For the rest of Attendance: `approvedOvertimeInMonth(employeeId, 'yyyy-MM')` (minutes and the active monthly slab)
  and `approvedOvertimeOn(employeeId, date)`, exported from `src/mocks/attendance/overtime-handlers.ts`.
- `resetAttendanceOvertimeDb` resets policies and settings; the requests reset with `resetStandardRequestsDb`.

## Gaps both ways

Backend lacks (screens or design need):

- **No bulk request**: nothing marks a request as filed in bulk, and no Type (Mandatory / Voluntary) is kept, so Bulk
  Applications cannot be told apart from the rest; filing is one call per person (no all-or-nothing).
- **Bulk approve takes no `details`**: only rows approving exactly the applied minutes go through
  `bulk-approve` (assumed to keep the applied minutes, as it prefills a loan's amount); others are approved one by one.
- `RequestOut.details` of overtime is untyped in the spec; names (`departmentName` …) and `approvedMinutes` are assumed.
- **Policy ↔ request**: no field says which policy / slab an approval fell under or what it encashes; whether the API
  caps approved minutes by the slabs, and when encashment happens, is not documented. The screens only hint and cap.
- No usage count on `OvertimePolicyOut`; what `DELETE` refuses is unknown.
- Slab leave types need `GET /leaves/types` (`leaves.settings.types.view`); a policy editor without it sees an empty
  Encashment Type list. No option route like `/requests/options/leave-types` for this.
- No rule on past / future overtime dates in the spec.

- `GET /requests/overtime/export` declares no format (see R4); the screens save it as CSV.
- No permission codes in the spec for overtime requests; the screens use the other request types' pattern (R4).

Frontend lacks (API has):

- `view=subordinates` and the list filters `departmentId`, `branchId`, `locationId` (no frame draws them).
- Bulk approve from Applications: left on the Bulk Overtime sheet on purpose, since `bulk-approve` takes no
  approved minutes and the sheet checks them against the daily policy first.

Added 27 Oct 2026 (Phase 2): Edit and Delete of a pending request, images added after filing (View), Export on
My Overtime and Bulk Applications, Forward, the Consents box with Agree / Disagree, and Reject Selected (ticked
rows, `bulk-reject`) on Applications. Edit and Delete appear on pending rows and the popup reads the request
first; when its `actions` no longer list them (an approver has acted) the popup says so and Save / Delete stays
off.
