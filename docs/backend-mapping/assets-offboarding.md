# Assets and Off-boarding: frontend ↔ backend mapping

State on 26 Oct 2026. The screens under `src/features/assets` and `src/features/offboarding` now
call the backend routes in `backend/app/routers/assets.py` (`/api/assets`) and
`backend/app/routers/offboarding.py` (`/api/offboarding`). The frontend adapts to the backend:
types in `src/features/*/types/*.types.ts` are the backend's `*Out` / `*In` schemas, camelCase,
ids as strings, `rowVersion` sent on every edit / delete / state change. The MSW mocks in
`src/mocks/assets` and `src/mocks/offboarding` serve the same routes and shapes (201 on create,
204 on delete, 409 on a stale `rowVersion`, the backend's error messages and codes).

Every route below was called against the dev backend (`hrango_dev`, two test employees created
for it) and the JSON compared with the types; the shapes match.

## Shared pieces

| Need                       | Route                                                                                                                        | Where                                                                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Employee pickers / filters | `GET /employees/lookup?permission=<screen code>&q&page&pageSize` → `{data, meta}` (+ `includeInactive=true` on list filters) | Payroll's `EmployeeSearchSelectField` / filter kind `employee`; `features/assets/api/lookups.api.ts` (`lookupsApi.employees` one page, `personHint`) |
| Organisation filters       | `GET /organisation/lookups/{departments,designations,branches,locations}`                                                    | same file (`useOrgLookup`)                                                                                                                           |
| Attachments                | `POST /files` (module `assets` / `offboarding`) then the record sends `fileId`; records return `file: {id, name, url}`       | `features/assets/components/shared/upload-field.tsx` (`UploadField`, `FileLink`)                                                                     |
| Permissions                | `useCan(code)` from `src/lib/permissions.ts`                                                                                 | every page; mock mode allows everything                                                                                                              |

The permission passed to the employee lookup is the screen's own code: `assets.allocations.assign`
(Allocate), `assets.allocations.view` (filters), `assets.clearance.create` (clearance pickers),
`offboarding.end_of_employment.create` (EOE dialog), `offboarding.end_of_employment.view` (filters).

### Employee pickers

Every employee picker searches the lookup on the server: typing sends `q` (code or name,
debounced 300 ms), the list reads `page` / `pageSize=50` and shows **Load more** while
`meta.page < meta.totalPages`, so companies with more than 100 people work. Pickers switched:
Allocate (Employee), Allocations filters (Employees), Clearance form (Employee Name, Checked By,
Clearance Approved By), End of Employment dialog (Employee, Replacement, Delegatee — the leaving
person is left out of the last two) and End of Employment filters (Employees). A record's own
people (and the listed people, for saved filters) are passed as `known`, so they keep their names
before the lookup reads them. The picked lookup row fills the clearance form's Employee ID and
Department and the EOE card. `lookupsApi.employees` now takes `q`, `page`, `pageSize` and returns
`{data, meta}`; `EmployeeLookupItem` gained `departmentId` and `branchId`.

## Asset Types (`/assets/types`)

- Routes: `GET /assets/types?q&isActive&page&pageSize`, `GET /assets/types/{id}`, `POST`, `PUT /{id}`
  (`rowVersion` in body), `DELETE /{id}?rowVersion=`.
- Shape: `active` → `isActive`; `description` nullable; added `assetCount`, `updatedAt`,
  `rowVersion`. Code prefix is `AITP-` (was `ATP-`).
- UI: Filters are Status (→ `isActive`) and one Search box (→ `q`, name or code) instead of Name.
  Create / Edit / Delete hidden without `assets.types.create/edit/delete`. Name up to 200 chars.

## Company Assets (`/assets/company-assets`)

- Routes: `GET /assets/company-assets?q&status&availability&assetTypeId`, `GET /{id}`,
  `GET /{id}/history`, `POST`, `PUT /{id}`, `PATCH /{id}/deactivate|activate {rowVersion}`,
  `DELETE /{id}?rowVersion=`. (Were `/assets/items…`, POST for activate / deactivate.)
- Shape: `identificationNumber` → `identificationNo` (optional), `taxable` → `isTaxable`,
  `condition` → `assetCondition` (`old | new | fair`), `attachmentName` → `fileId` + `file`,
  `currentValue` / `acquiredDate` optional, `active` → `status` (`active | damaged | lost |
decommissioned`) plus the computed `availability` (`available | allocated | unavailable`) the
  Status column shows; `assetTypeName`, `holderId/Code/Name` on every row (the separate
  `AssetRow` / `AssetDetail` types are gone).
- UI changes: Condition is a three-option select (was the Old / New switch; the backend adds
  Fair). Identification Number, Current Value and Acquired date are no longer required (the
  backend takes them as optional). Attachment uploads for real. View shows the record status and
  holder. Filters: Availability, Asset Status, Search (name, code or identification number), Asset
  Type (were Status, Name, Code, Identification Number, Asset Type). Activate shows for any
  status other than active.
- **Removed: Import File ⌄ (Assets CSV, Sample File)** — the backend has no import route
  ("not in first build: no file format defined").
- Asset History: the backend returns one row per changed field
  (`{action, fieldName, oldValue, newValue, performedAt, performedByUserId, performedByName}`,
  column names like `identification_no`, `holder`, `status`). The dialog groups rows of the same
  action / moment / person into one line, labels the columns, shows asset type ids as names (from
  the type list), `is_taxable` 0/1 as No/Yes, a clearance's return status as its label. The first
  column is now "Performed By" (a user name, not an employee card).

## Asset Allocations (`/assets/allocations`)

- Routes: `GET /assets/allocations?q&employeeId&assetTypeId&assetId&status&from&to`,
  `GET /{id}`, `POST`, `PATCH /{id}/deallocate {deallocatedOn, returnCondition, remarks, rowVersion}`.
- Shape: `allocationDate` → `allocatedOn`, `deallocationDate` → `deallocatedOn`, flat
  `employeeName/Code`, `companyName`, `assetName/Code`, `identificationNo`, `assetTypeName`,
  added `returnCondition`, `deallocationRemarks`, `assetClearanceId`, `file`, `rowVersion`.
- UI changes: Allocate's pickers come from the employee lookup, `GET /assets/types` (active
  ones) and `GET /assets/company-assets?assetTypeId&availability=available`. Deallocate now also
  asks **Return Condition** (good / fair / damaged; damaged marks the asset damaged) and
  **Remarks**; View shows them. Search box added to Filters. Allocate / Deallocate hidden without
  `assets.allocations.assign`.

## Asset Clearance Form (`/assets/clearance-form`) and `ClearanceFormDialog`

- Routes: `GET /assets/clearance-forms?q&status&employeeId&departmentId&endOfEmploymentId`,
  `GET /clearance-forms/prefill?employeeId=`, `GET /{id}`, `POST`, `PUT /{id}`,
  `DELETE /{id}?rowVersion=`, `PATCH /clearance-forms/approve|unapprove {forms: [{id, rowVersion}]}`
  (all or nothing; returns the rows).
- Shape: status `pending` → `in_progress` (chip "In Progress", was "Pending by HR"); rows carry
  `employeeCode/Name`, `departmentId/Name`, `itemCount`, `approvalDate`; `lines` → `items` keyed
  by `assetAllocationId` (`conditionAtClearance`, `reason`, `returnStatus`
  `complete | partial | not_returned`, `comments`); `checkedByName`, `approvedByName`, `file`.
- UI changes: each Asset Details block picks one of the person's open allocations (prefill)
  instead of an asset; Asset ID and Date Allocated are read-only boxes from the allocation.
  **Return Status is now required** (backend requires it). Checked By, Clearance Approved By and
  Approval Date are optional (backend: optional; approval sets the date). The bulk buttons send
  each ticked row's `rowVersion`. Filters: Search (→ `q`, ID or name), Status, Department (→
  `departmentId`) — the Clearance Date filter is gone (no backend filter). Tick boxes and the
  Approved / Unapproved buttons only show with `assets.clearance.approve`; Create / Edit / Delete
  follow their codes. A form opened from End of Employment sends `endOfEmploymentId`; one made
  from the Assets menu sends the prefill's pending `endOfEmploymentId` (the backend links it
  anyway).

## End of Employment (`/end-of-employment/all|pending|completed`)

- Routes: `GET /offboarding/end-of-employment?q&status&employeeId&departmentId&branchId&locationId&designationId&serveNotice&from&to`,
  `GET /end-of-employment/checklist-fields`, `GET /{id}`, `POST`, `PUT /{id}`,
  `PUT /{id}/checklist {answers: [{checklistFieldId, answer}], rowVersion}`,
  `PATCH /{id}/complete {rowVersion}`, `PATCH /{id}/rehire {joiningDate, rowVersion}`,
  `DELETE /{id}?rowVersion=`. The sidebar scope is the `status` filter (Pending / Completed); on
  All the Status filter sets it.
- Shape: `noticePeriod` → `serveNotice`, `finalSettlement` → `needsFinalSettlement`,
  `assetClearance` → `needsAssetClearance`, `attachmentName` → `fileId` + `file`, `rehire` →
  `isRehired` / `rehireJoiningDate`, `checklist` map → `answers[]` (text) saved separately,
  `waitingFor` → `[{item, label}]`, `lastWorkingDate` always set, flat `employeeName/Code`,
  `branchName`, `locationName`, `departmentName`, `designationName`. The employee card is built
  from `employeeEmail`, `employeePhone`, `dateOfBirth` (age), `joiningDate` → `lastWorkingDate`
  (experience), `photoUrl`. Reason `transfer` removed (backend: resignation / termination /
  retirement / other).
- Added inputs: **Notice Period Days** (with Notice Period), **Asset Clear** date
  (`assetClearByDate`, with Asset Clearance — the FRD's fixed "Asset Clear" date; the sample
  checklist field of that name is now "Access Card Returned"), **Replacement** (beside Delegatee).
- Save is two calls: the record, then (when the Checklist tab was touched) its answers with the
  new `rowVersion`. If the answers fail after a create, the dialog keeps the saved record and
  shows the error; the next Save edits it. Range / length checks run before saving; **required
  answers no longer block Save** — the backend lists them under "Waiting for" and completes the
  record once given.
- Row menu: pending → Edit, View, **Complete** (new; the backend answers 409 "Waiting for: …"
  which shows as a toast), Delete; completed → View, Rehire (hidden once rehired or without
  `offboarding.rehire.process`). "Waiting for" shows the backend's labels in Edit and View.
- After saving with Asset Clearance ticked and no clearance yet, the clearance form opens filled
  in (unless the person holds nothing, or the user lacks `assets.clearance.create`).
- Filters: Location, Branch, Department, Designation now send ids from the organisation lookups;
  Notice Period → `serveNotice`; Search box added.
- **Removed: Import File** (no backend route; "no file layout defined").

## Settings → Off Boarding Checklist (`/settings/off-boarding/checklist`)

- Routes: `GET /offboarding/settings/checklists?q&isActive`, `GET /{id}`, `POST`, `PUT /{id}`,
  `DELETE /{id}?rowVersion=` (were `/offboarding/checklists`).
- Shape: `active` → `isActive`, field `type` → `fieldType`, `required` → `isRequired`, `min/max`
  split into `minValue/maxValue` (Number) and `minLength/maxLength` (String), `sortOrder`,
  `fieldCount`, `rowVersion`; lists come without `fields`.
- UI: **Delete** added to the row menu (backend has it). Filters: Search (name or code) and
  Status. Removing a field that has answers is refused by the server ("A removed field has
  answers on an end of employment. Keep it, or deactivate the checklist."), shown in the dialog.

## Mocks

- Tables keep the backend's columns (`src/mocks/assets/db.ts`, `src/mocks/offboarding/db.ts`,
  storage keys bumped to `-v2-`). `StoredEndOfEmployment` keeps the names the Requests mock writes
  when a resignation is approved (`noticePeriod`, `finalSettlement`, `assetClearance`,
  `attachmentName`, `checklist`, `rehire` …); the backend-only columns are optional, so that mock
  keeps working unchanged. Final Settlement ticked still makes / updates Payroll's
  `finalSettlements` rows (`src/mocks/payroll/db`), so payroll's mocks and tests see the same data.
- Shared helpers for both mocks: `src/mocks/assets/http.ts` (responses, rowVersion checks,
  `fileRef`) and `src/mocks/assets/people.ts` (people from the mock directory).
- `GET /employees/lookup` and `/organisation/lookups/{kind}` are not mocked here: the Settings
  and Payroll mocks already serve them (Settings' handlers come first).

## Gaps and backend issues

Backend → frontend (backend has, the UI does not use yet):

- `assets.*.export` / `offboarding.*.export` codes have no endpoint; no Export buttons.
- `resignationRequestId`, `photoFileId`, `finalSettlementStatus`, `clearanceStatus` are typed but
  not shown beyond "Waiting for".

Frontend → backend (UI had, backend lacks):

- Asset and End of Employment **Import File** (CSV) — removed.
- Clearance list filter by **Clearance Date** — removed.
- A card for the chosen employee **before** the record exists: the lookup has no email, phone,
  date of birth or joining date, so Create shows "—" for Age / Email / Phone / Experience until saved.

Backend bugs / questions found while calling it:

1. `PATCH /api/assets/clearance-forms/unapprove` refuses with 409 "An asset on a chosen form has
   been allocated again since." when the same asset had an earlier allocation **on the same day**
   (allocate, deallocate, allocate again, clear, approve, unapprove). `usp_asset_clearance_unapprove`
   checks `o.allocated_on >= al.allocated_on` for any other allocation; it should only count
   allocations made after the closed one (e.g. `o.id > al.id`).
2. `PATCH /clearance-forms/approve|unapprove` with an empty list reports the error on field `ids`;
   the body field is `forms`.
3. `DELETE /assets/types/{id}` in use answers code `CONFLICT` (no specific code), unlike the other
   refusals (`ASSET_ALLOCATED`, `ASSET_DUPLICATE` …).
4. Asset History stores `asset_type_id` and `file_id` as ids and `is_taxable` as 0/1; the screen
   resolves type names itself. Names in the audit rows would make the history self-contained.
5. `FileRef.url` is root-relative (`/api/files/8/download?token=…`): fine behind the Vite proxy /
   same origin; a frontend on another origin would need the API host prefixed (`src/lib/files.ts`).
6. ~~`GET /employees/lookup` returns at most 100 people~~: resolved — the lookup is searched and
   paged on the server (`q`, `page`, `pageSize`) and every picker uses it (see Employee pickers).

## Needs from shared files (not edited here)

- `src/mocks/files/handlers.ts`: a way for other mocks to read an upload's name (e.g.
  `mockUploadName(id)`), so mocked records show the real file name instead of "Attachment".
- One owner for the `GET /employees/lookup` and `/organisation/lookups/{kind}` mocks: Settings,
  Payroll and Project Management each build them, with different employee codes and department
  ids (`dep_human-resource-management` vs `dep_human_resource_management`); Settings' version
  returns no departments or designations. The assets / off-boarding mocks match department ids
  by name to cope.
- Frontend README "Assets and off-boarding" table and notes describe the mock-era behaviour
  (Import File, Old/New condition, "Pending by HR", auto-revert to pending, required checklist
  answers on Save); they should point to this file.
